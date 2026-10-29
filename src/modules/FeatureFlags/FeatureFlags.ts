import { FeatureFlag } from './FeatureFlag';
import {
  FeatureFlagsError,
  type IFeatureFlagsCache,
  type IFeatureFlagValue,
  type TFeatureFlagImpressions,
  type TFeatureFlagsUpdateListener,
} from './FeatureFlags.types';
import { featureFlagsUrl } from './featureFlagsUrl';
import { Logger } from '../../core/logger';
import { type EventBus } from '../../core/modules/EventBus';
import { type Data } from '../Data/Data';

const THROTTLE_MS = 5 * 60 * 1000;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE_LOAD_REFRESH_AGE_MS = 15 * 60 * 1000;
const PERIODIC_REFRESH_MS = 60 * 60 * 1000;
const IMPRESSION_MARK_MS = 30 * 60 * 1000;

export const FEATURE_FLAG_IMPRESSION_EVENT = 'PW_FeatureFlagImpression';

export interface IFeatureFlagsDeps {
  eventBus: EventBus;
  data: Data;
  postEvent: (event: string, attributes: Record<string, unknown>) => Promise<unknown>;
  isCommunicationDisabled: () => boolean;
  isDeviceRegistered: () => boolean;
  fetch?: typeof fetch;
  now?: () => number;
}

export class FeatureFlags {
  private readonly deps: Required<IFeatureFlagsDeps>;
  private readonly listeners = new Set<TFeatureFlagsUpdateListener>();
  private readonly pageImpressions = new Set<string>();

  private cache?: IFeatureFlagsCache;
  // a partial answer serves this page only and never reaches the store
  private isMemoryOnly = false;
  private applicationCode = '';
  private userId = '';
  private lastRequestAt = 0;
  private lastSentUnregistered = false;
  private generation = 0;
  private inFlight?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private isStarted = false;
  private isLoaded = false;
  // the site has used the flags API on this page; until then nothing goes to the network
  private isActivated = false;
  private userChangedWhileLoading = false;

  constructor(deps: IFeatureFlagsDeps) {
    this.deps = {
      fetch: (input, init) => fetch(input, init),
      now: () => Date.now(),
      ...deps,
    };

    // subscribed before start() reads the store, so a User ID set meanwhile is not missed
    this.deps.eventBus.addEventHandler('change-user-id', ({ userId }) => this.onUserChanged(userId));
    this.deps.eventBus.addEventHandler('register', () => this.onRegistered());
  }

  // Reads the cache only; requests and the hourly timer start with the first use of the public API.
  public async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }
    this.isStarted = true;

    this.applicationCode = await this.deps.data.getApplicationCode() || '';
    const storedUserId = await this.deps.data.getUserId() || '';
    if (!this.userChangedWhileLoading) {
      this.userId = storedUserId;
    }
    const stored = await this.deps.data.getFeatureFlags();
    if (stored && stored.applicationCode === this.applicationCode) {
      this.cache = stored;
    }
    this.isLoaded = true;

    if (this.isActivated) {
      // the site used the flags API before the cache loaded: the loaded cache is an update for it
      if (this.visibleSnapshot() !== '') {
        this.notify();
      }
      this.refreshOnPageLoad();
    }
  }

  public get(key: string): FeatureFlag | null {
    this.activate();
    if (!this.cache || !this.hasValidCache()) {
      return null;
    }

    const value = this.cache.flags[key];
    return value ? new FeatureFlag(key, value.enabled, value.rule_id, value.properties) : null;
  }

  public isEnabled(key: string, defaultValue: boolean): boolean {
    const flag = this.get(key);
    return flag ? flag.enabled : defaultValue;
  }

  // At most one request per 5 minutes while a valid cache exists; within that window the cache is the answer.
  public refresh(): Promise<void> {
    this.activate();
    if (this.hasValidCache() && this.deps.now() - this.lastRequestAt < THROTTLE_MS) {
      return Promise.resolve();
    }

    return this.send();
  }

  // Forgets the device: called when its data is removed or communication is turned off; start() begins again.
  public reset(): void {
    clearTimeout(this.timer);
    this.cache = undefined;
    this.isMemoryOnly = false;
    this.generation++;
    this.pageImpressions.clear();
    this.isStarted = false;
    this.isLoaded = false;
    this.userChangedWhileLoading = false;
  }

  public addUpdateListener(listener: TFeatureFlagsUpdateListener): void {
    this.activate();
    this.listeners.add(listener);
  }

  public removeUpdateListener(listener: TFeatureFlagsUpdateListener): void {
    this.listeners.delete(listener);
  }

  // One event per (flag, rule, enabled) per page, and per 30 minutes across tabs of the browser.
  // Never rejects: callers fire and forget it, and a private-mode IndexedDB may refuse every write.
  public async logImpression(key: string): Promise<void> {
    const flag = this.get(key);
    if (!flag || this.deps.isCommunicationDisabled()) {
      return;
    }

    const dedupKey = `${key}|${flag.ruleId}|${flag.enabled}`;
    if (this.pageImpressions.has(dedupKey)) {
      return;
    }
    this.pageImpressions.add(dedupKey);

    try {
      await this.sendImpression(flag, dedupKey);
    } catch (error) {
      this.pageImpressions.delete(dedupKey);
      Logger.error(error, 'Pushwoosh: feature flag impression was not sent');
    }
  }

  private async sendImpression(flag: FeatureFlag, dedupKey: string): Promise<void> {
    const now = this.deps.now();
    const marks = await this.deps.data.getFeatureFlagImpressions();
    if (marks[dedupKey] !== undefined && now - marks[dedupKey] < IMPRESSION_MARK_MS) {
      return;
    }
    await this.deps.data.setFeatureFlagImpressions({ ...freshMarks(marks, now), [dedupKey]: now });

    try {
      await this.deps.postEvent(FEATURE_FLAG_IMPRESSION_EVENT, {
        flag_key: flag.key,
        rule_id: flag.ruleId,
        enabled: flag.enabled,
      });
    } catch (error) {
      const current = await this.deps.data.getFeatureFlagImpressions().catch(() => undefined);
      if (current) {
        delete current[dedupKey];
        await this.deps.data.setFeatureFlagImpressions(current).catch(() => undefined);
      }
      throw error;
    }
  }

  private onUserChanged(userId: string): void {
    if (!this.isLoaded) {
      this.userId = userId;
      this.userChangedWhileLoading = true;
      return;
    }
    if (userId === this.userId) {
      return;
    }

    this.userId = userId;
    this.cache = undefined;
    this.isMemoryOnly = false;
    this.generation++;
    this.pageImpressions.clear();
    void this.deps.data.setFeatureFlags(undefined);
    if (this.isActivated) {
      this.sendAfterInFlight();
    }
  }

  private onRegistered(): void {
    const cachedUnregistered = !!this.cache && !!this.cache.sentUnregistered;
    if (this.isLoaded && this.isActivated && (this.lastSentUnregistered || cachedUnregistered)) {
      this.sendAfterInFlight();
    }
  }

  private activate(): void {
    if (this.isActivated) {
      return;
    }
    this.isActivated = true;
    if (this.isLoaded) {
      this.refreshOnPageLoad();
    }
  }

  private refreshOnPageLoad(): void {
    const age = this.cache ? this.deps.now() - this.cache.fetchedAt : Infinity;
    const registeredSince = !!this.cache && !!this.cache.sentUnregistered && this.deps.isDeviceRegistered();
    if (!this.hasValidCache() || age > PAGE_LOAD_REFRESH_AGE_MS || registeredSince) {
      this.sendInBackground();
    } else {
      this.schedulePeriodicRefresh();
    }
  }

  private sendAfterInFlight(): void {
    const pending = this.inFlight || Promise.resolve();
    void pending.catch(() => undefined).then(() => this.sendInBackground());
  }

  private sendInBackground(): void {
    this.send().catch((error) => Logger.error(error, 'Pushwoosh: feature flags refresh failed'));
  }

  private send(): Promise<void> {
    if (!this.inFlight) {
      this.inFlight = this.request().finally(() => {
        this.inFlight = undefined;
        this.schedulePeriodicRefresh();
      });
    }

    return this.inFlight;
  }

  private async request(): Promise<void> {
    // counted before any refusal, so a failing request waits for the hourly timer instead of looping
    this.lastRequestAt = this.deps.now();
    if (this.deps.isCommunicationDisabled()) {
      throw new FeatureFlagsError('Communication is disabled', 0);
    }

    const generation = this.generation;
    const hwid = await this.deps.data.getHwid();
    if (!hwid || !this.applicationCode) {
      throw new FeatureFlagsError('Pushwoosh SDK is not initialized', 0);
    }

    const body: Record<string, string> = { application: this.applicationCode, hwid };
    if (this.cache && this.hasValidCache() && this.cache.etag) {
      body.etag = this.cache.etag;
    }

    const url = featureFlagsUrl(await this.deps.data.getApiEntrypoint());
    const apiToken = await this.deps.data.getApiToken();
    // the route reads strict proto JSON: a flat body, never the {request: ...} wrapper of /json/1.3
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        ...(apiToken ? { Authorization: `Token ${apiToken}` } : {}),
      },
      body: JSON.stringify(body),
      ...(apiToken ? { credentials: 'include' as RequestCredentials } : {}),
    };

    this.lastSentUnregistered = !this.deps.isDeviceRegistered();

    let response: Response;
    try {
      response = await this.deps.fetch(url, init);
    } catch (error) {
      throw new FeatureFlagsError(`getFeatureFlags request failed: ${error instanceof Error ? error.message : String(error)}`, 0);
    }

    if (response.status !== 200) {
      throw new FeatureFlagsError(`getFeatureFlags answered HTTP ${response.status}`, response.status);
    }

    let envelope: { status_code?: unknown; response?: unknown };
    try {
      envelope = await response.json();
    } catch (_error) {
      throw new FeatureFlagsError('getFeatureFlags answered an unreadable body', response.status);
    }

    if (!envelope || envelope.status_code !== 200 || !isObject(envelope.response)) {
      throw new FeatureFlagsError(`getFeatureFlags answered status_code ${String(envelope && envelope.status_code)}`, response.status);
    }

    if (generation !== this.generation) {
      return;
    }

    await this.apply(envelope.response);
  }

  private async apply(answer: Record<string, unknown>): Promise<void> {
    const before = this.visibleSnapshot();
    const now = this.deps.now();

    if (answer.not_modified === true) {
      if (!this.cache || !this.isCacheOfCurrentUser(this.cache)) {
        return;
      }
      this.cache = { ...this.cache, fetchedAt: now, sentUnregistered: this.lastSentUnregistered };
      if (!this.isMemoryOnly) {
        await this.deps.data.setFeatureFlags(this.cache);
      }
    } else if (answer.partial === true) {
      if (this.hasValidCache()) {
        return;
      }
      this.cache = this.newCache(answer, '', now);
      this.isMemoryOnly = true;
    } else {
      this.cache = this.newCache(answer, typeof answer.etag === 'string' ? answer.etag : '', now);
      this.isMemoryOnly = false;
      await this.deps.data.setFeatureFlags(this.cache);
    }

    if (this.visibleSnapshot() !== before) {
      this.notify();
    }
  }

  private newCache(answer: Record<string, unknown>, etag: string, now: number): IFeatureFlagsCache {
    return {
      applicationCode: this.applicationCode,
      userId: this.userId,
      flags: parseFlags(answer.flags),
      etag,
      fetchedAt: now,
      sentUnregistered: this.lastSentUnregistered,
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        Logger.error(error, 'Pushwoosh: feature flags update listener failed');
      }
    });
  }

  private schedulePeriodicRefresh(): void {
    if (!this.isLoaded) {
      return;
    }

    clearTimeout(this.timer);
    const last = Math.max(this.lastRequestAt, this.cache ? this.cache.fetchedAt : 0);
    const delay = Math.max(0, last + PERIODIC_REFRESH_MS - this.deps.now());
    this.timer = setTimeout(() => this.sendInBackground(), delay);
  }

  private hasValidCache(): boolean {
    if (!this.cache || !this.isCacheOfCurrentUser(this.cache)) {
      return false;
    }

    const age = this.deps.now() - this.cache.fetchedAt;
    return age >= 0 && age <= MAX_CACHE_AGE_MS;
  }

  private isCacheOfCurrentUser(cache: IFeatureFlagsCache): boolean {
    return cache.applicationCode === this.applicationCode && cache.userId === this.userId;
  }

  private visibleSnapshot(): string {
    return this.cache && this.hasValidCache() ? stableStringify(this.cache.flags) : '';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFlags(raw: unknown): Record<string, IFeatureFlagValue> {
  const flags: Record<string, IFeatureFlagValue> = {};
  if (!isObject(raw)) {
    return flags;
  }

  Object.keys(raw).forEach((key) => {
    const value = raw[key];
    if (!isObject(value) || typeof value.enabled !== 'boolean') {
      return;
    }

    flags[key] = {
      enabled: value.enabled,
      rule_id: typeof value.rule_id === 'string' ? value.rule_id : '',
      properties: isObject(value.properties) ? value.properties : {},
    };
  });

  return flags;
}

function freshMarks(marks: TFeatureFlagImpressions, now: number): TFeatureFlagImpressions {
  const fresh: TFeatureFlagImpressions = {};
  Object.keys(marks).forEach((key) => {
    if (now - marks[key] < IMPRESSION_MARK_MS) {
      fresh[key] = marks[key];
    }
  });
  return fresh;
}

// key order of equal answers may differ between responses; listeners fire only on a real change
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
