import * as fs from 'fs';
import * as path from 'path';

import * as CONSTANTS from '../../../core/constants';
import { EventBus } from '../../../core/modules/EventBus';
import { Data } from '../../Data/Data';
import { FEATURE_FLAG_IMPRESSION_EVENT, FeatureFlags } from '../FeatureFlags';
import { FeatureFlagsError } from '../FeatureFlags.types';
import { featureFlagsUrl } from '../featureFlagsUrl';

const APP = '70699-8A0F4';
const HWID = `${APP}_hwid`;
const ENTRYPOINT = 'https://api.pushwoosh.com/json/1.3/';
const URL = 'https://api.pushwoosh.com/api/v2/device-api/getFeatureFlags';
const MINUTE = 60 * 1000;

const FLAGS_V1 = { new_checkout: { enabled: true, rule_id: 'r_1', properties: { color: 'green', limit: 3 } } };
const FLAGS_V2 = { new_checkout: { enabled: false, rule_id: '', properties: { color: 'blue' } } };

type TAnswer = { flags?: object; etag?: string; not_modified?: boolean; partial?: boolean };

// one clock for every instance: a second instance stands for another tab or a page reload
let now = 1_700_000_000_000;

function memoryStore(initial: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = { ...initial };
  return {
    values,
    get: async (key: string, defaultValue?: unknown) => (key in values && values[key] !== undefined ? values[key] : defaultValue),
    set: async (key: string, value: unknown) => {
      values[key] = value;
    },
    getAll: async () => values,
  };
}

// jsdom has no fetch Response; the client reads only status and json()
function fakeResponse(status: number, body: string): Response {
  return <Response><unknown>{ status, json: async () => JSON.parse(body) };
}

function envelope(answer: TAnswer): Response {
  return fakeResponse(200, JSON.stringify({
    status_code: 200,
    status_message: 'OK',
    response: { flags: {}, etag: '', not_modified: false, partial: false, ...answer },
  }));
}

function setup(options: { store?: ReturnType<typeof memoryStore>; userId?: string; communicationDisabled?: boolean } = {}) {
  const store = options.store || memoryStore();
  store.values['params.applicationCode'] = APP;
  store.values['params.hwid'] = HWID;
  store.values['params.apiEntrypoint'] = ENTRYPOINT;
  store.values['params.userId'] = options.userId;

  const answers: Array<Response | Error | Promise<Response>> = [];
  const requests: Array<{ url: string; init: RequestInit; body: Record<string, string> }> = [];
  const postEvent = jest.fn().mockResolvedValue({});
  const eventBus = new EventBus();
  const fetchFn = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), init: init as RequestInit, body: JSON.parse(String(init?.body)) });
    const answer = answers.shift();
    if (!answer) {
      throw new Error('unexpected request');
    }
    if (answer instanceof Error) {
      throw answer;
    }
    return answer;
  });

  const flags = new FeatureFlags({
    eventBus,
    data: new Data(store as never),
    postEvent,
    isCommunicationDisabled: () => !!options.communicationDisabled,
    isDeviceRegistered: () => localStorage.getItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS) === CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED,
    fetch: fetchFn as unknown as typeof fetch,
    now: () => now,
  });

  return {
    flags,
    store,
    eventBus,
    postEvent,
    requests,
    answer: (value: TAnswer) => answers.push(envelope(value)),
    answerRaw: (value: Response | Error) => answers.push(value),
    answerLater: (value: TAnswer) => {
      let release: () => void = () => undefined;
      answers.push(new Promise<Response>((resolve) => {
        release = () => resolve(envelope(value));
      }));
      return () => release();
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

// the client stays off the network until the site touches the flags API
function useFlags(t: { flags: FeatureFlags }): void {
  t.flags.get('__any__');
}

// lets the async event bus and the background requests settle
async function settle(): Promise<void> {
  await jest.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  now = 1_700_000_000_000;
  jest.useFakeTimers();
  localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED);
});

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
});

describe('featureFlagsUrl', () => {
  it('swaps the legacy path for the device API path on every host form', () => {
    expect(featureFlagsUrl(ENTRYPOINT)).toBe(URL);
    expect(featureFlagsUrl('https://api.pushwoosh.us/json/1.3/')).toBe('https://api.pushwoosh.us/api/v2/device-api/getFeatureFlags');
    expect(featureFlagsUrl('https://proxy.example.com/pw/json/1.3/')).toBe('https://proxy.example.com/pw/api/v2/device-api/getFeatureFlags');
    expect(featureFlagsUrl('https://api.wavesend.ru/json/1.3')).toBe('https://api.wavesend.ru/api/v2/device-api/getFeatureFlags');
  });

  it('keeps the host of any other entrypoint and defaults to the SDK default host', () => {
    expect(featureFlagsUrl('https://api.pushwoosh.us/custom/')).toBe('https://api.pushwoosh.us/api/v2/device-api/getFeatureFlags');
    expect(featureFlagsUrl(undefined)).toBe(URL);
    expect(featureFlagsUrl('not a url')).toBe(URL);
  });
});

describe('FeatureFlags', () => {
  it('sends nothing and keeps no timer while the site never uses the flags API', async () => {
    const t = setup();
    await t.flags.start();
    await settle();
    t.eventBus.dispatchEvent('change-user-id', { userId: 'u2' });
    t.eventBus.dispatchEvent('register', {});
    await settle();
    await jest.advanceTimersByTimeAsync(2 * 60 * MINUTE);

    expect(t.requests).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('serves the cache on the first get() of a page and only then refreshes it', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.advance(20 * MINUTE);
    const reload = setup({ store: t.store });
    reload.answer({ etag: 'e1', not_modified: true });
    await reload.flags.start();
    await settle();
    expect(reload.requests).toHaveLength(0);

    expect(reload.flags.get('new_checkout')?.enabled).toBe(true);
    await settle();
    expect(reload.requests).toHaveLength(1);
  });

  it('notifies a listener added before the cache loads once a fresh cache appears', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.advance(MINUTE);
    const reload = setup({ store: t.store });
    const listener = jest.fn();
    reload.flags.addUpdateListener(listener);
    expect(reload.flags.get('new_checkout')).toBeNull();
    await reload.flags.start();
    await settle();

    expect(reload.requests).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(reload.flags.get('new_checkout')?.enabled).toBe(true);
  });

  it('notifies a listener added before the cache loads when the refresh answers not_modified', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.advance(20 * MINUTE);
    const reload = setup({ store: t.store });
    reload.answer({ etag: 'e1', not_modified: true });
    const listener = jest.fn();
    reload.flags.addUpdateListener(listener);
    expect(reload.flags.isEnabled('new_checkout', false)).toBe(false);
    await reload.flags.start();
    await settle();

    expect(reload.requests).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(reload.flags.isEnabled('new_checkout', false)).toBe(true);
  });

  it('does not notify on load when nobody read the flags before it', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.advance(MINUTE);
    const reload = setup({ store: t.store });
    await reload.flags.start();
    const listener = jest.fn();
    reload.flags.addUpdateListener(listener);
    await settle();

    expect(listener).not.toHaveBeenCalled();
    expect(reload.flags.get('new_checkout')?.enabled).toBe(true);
  });

  it('requests on page load without a cache and serves typed getters with defaults', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });

    await t.flags.start();

    useFlags(t);
    await settle();

    expect(t.requests).toHaveLength(1);
    expect(t.requests[0].url).toBe(URL);
    expect(t.requests[0].body).toEqual({ application: APP, hwid: HWID });
    expect((t.requests[0].init.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=UTF-8');

    const flag = t.flags.get('new_checkout');
    expect(flag?.enabled).toBe(true);
    expect(flag?.ruleId).toBe('r_1');
    expect(flag?.getString('color', 'x')).toBe('green');
    expect(flag?.getNumber('limit', 0)).toBe(3);
    expect(flag?.getNumber('color', 7)).toBe(7);
    expect(flag?.getBool('missing', true)).toBe(true);
    expect(t.flags.get('absent')).toBeNull();
    expect(t.flags.isEnabled('absent', true)).toBe(true);
  });

  it('sends the etag, keeps the cache on not_modified and does not notify', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();
    const listener = jest.fn();
    t.flags.addUpdateListener(listener);

    t.advance(6 * MINUTE);
    t.answer({ etag: 'e1', not_modified: true });
    await t.flags.refresh();

    expect(t.requests[1].body.etag).toBe('e1');
    expect(t.flags.get('new_checkout')?.enabled).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('replaces the cache with a full answer, drops missing keys and notifies', async () => {
    const t = setup();
    t.answer({ flags: { ...FLAGS_V1, other: FLAGS_V2.new_checkout }, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();
    const listener = jest.fn();
    t.flags.addUpdateListener(listener);

    t.advance(6 * MINUTE);
    t.answer({ flags: FLAGS_V2, etag: 'e2' });
    await t.flags.refresh();

    expect(t.flags.get('new_checkout')?.enabled).toBe(false);
    expect(t.flags.get('new_checkout')?.ruleId).toBe('');
    expect(t.flags.get('other')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    expect((t.store.values['params.featureFlags'] as { etag: string }).etag).toBe('e2');
  });

  it('keeps a partial answer in memory only and ignores it over a valid cache', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, partial: true });
    await t.flags.start();
    useFlags(t);
    await settle();

    expect(t.flags.get('new_checkout')?.enabled).toBe(true);
    expect(t.store.values['params.featureFlags']).toBeUndefined();

    const u = setup();
    u.answer({ flags: FLAGS_V1, etag: 'e1' });
    await u.flags.start();
    useFlags(u);
    await settle();
    u.advance(6 * MINUTE);
    u.answer({ flags: FLAGS_V2, partial: true });
    await u.flags.refresh();

    expect(u.flags.get('new_checkout')?.enabled).toBe(true);
  });

  it('rejects by HTTP status and keeps the cache', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.advance(6 * MINUTE);
    t.answerRaw(fakeResponse(400, JSON.stringify({ status_code: 210, status_message: 'hwid is not valid' })));
    await expect(t.flags.refresh()).rejects.toMatchObject({ name: 'FeatureFlagsError', httpStatus: 400 });

    t.advance(6 * MINUTE);
    t.answerRaw(fakeResponse(401, ''));
    await expect(t.flags.refresh()).rejects.toBeInstanceOf(FeatureFlagsError);

    expect(t.flags.get('new_checkout')?.enabled).toBe(true);
  });

  it('throttles refresh for 5 minutes while a valid cache exists', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    await t.flags.refresh();
    expect(t.requests).toHaveLength(1);

    t.advance(5 * MINUTE);
    t.answer({ etag: 'e1', not_modified: true });
    await t.flags.refresh();
    expect(t.requests).toHaveLength(2);
  });

  it('does not throttle when there is no cache', async () => {
    const t = setup();
    t.answerRaw(new Error('offline'));
    await t.flags.start();
    useFlags(t);
    await settle();

    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.refresh();

    expect(t.requests).toHaveLength(2);
    expect(t.flags.get('new_checkout')).not.toBeNull();
  });

  it('on a user change clears cache and etag and refreshes past the throttle', async () => {
    const t = setup({ userId: 'u1' });
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.answer({ flags: FLAGS_V2, etag: 'e2' });
    t.eventBus.dispatchEvent('change-user-id', { userId: 'u2' });
    await settle();

    expect(t.requests).toHaveLength(2);
    expect(t.requests[1].body.etag).toBeUndefined();
    expect(t.flags.get('new_checkout')?.enabled).toBe(false);
  });

  it('drops an answer that was in flight when the user changed', async () => {
    const t = setup({ userId: 'u1' });
    const releaseFirst = t.answerLater({ flags: FLAGS_V1, etag: 'e1' });
    t.answer({ flags: FLAGS_V2, etag: 'e2' });

    await t.flags.start();

    useFlags(t);
    t.eventBus.dispatchEvent('change-user-id', { userId: 'u2' });
    await settle();
    releaseFirst();
    await settle();

    expect(t.requests).toHaveLength(2);
    expect(t.requests[1].body.etag).toBeUndefined();
    expect(t.flags.get('new_checkout')?.enabled).toBe(false);
  });

  it('refreshes once after the first registration when the last request went out unregistered', async () => {
    localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_UNREGISTERED);
    const t = setup();
    t.answer({ flags: {}, etag: 'e0' });
    await t.flags.start();
    useFlags(t);
    await settle();

    localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED);
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    t.eventBus.dispatchEvent('register', {});
    await settle();
    t.eventBus.dispatchEvent('register', {});
    await settle();

    expect(t.requests).toHaveLength(2);
    expect(t.flags.get('new_checkout')?.enabled).toBe(true);
  });

  it('refetches a fresh cache made before registration once the device is registered, on first use or on the event', async () => {
    localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_UNREGISTERED);
    const t = setup();
    t.answer({ flags: FLAGS_V2, etag: 'e0' });
    await t.flags.start();
    useFlags(t);
    await settle();

    // registered on a later page before the site touches the flags API
    t.advance(MINUTE);
    localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED);
    const later = setup({ store: t.store });
    later.answer({ flags: FLAGS_V1, etag: 'e1' });
    await later.flags.start();
    later.eventBus.dispatchEvent('register', {});
    await settle();
    expect(later.requests).toHaveLength(0);
    useFlags(later);
    await settle();
    expect(later.requests).toHaveLength(1);
    expect(later.flags.get('new_checkout')?.enabled).toBe(true);

    // registered while the page already uses the flags of an unregistered cache
    localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_UNREGISTERED);
    const u = setup();
    u.answer({ flags: FLAGS_V2, etag: 'e0' });
    await u.flags.start();
    useFlags(u);
    await settle();
    const again = setup({ store: u.store });
    await again.flags.start();
    useFlags(again);
    await settle();
    expect(again.requests).toHaveLength(0);
    localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED);
    again.answer({ flags: FLAGS_V1, etag: 'e1' });
    again.eventBus.dispatchEvent('register', {});
    await settle();
    expect(again.requests).toHaveLength(1);
    expect(again.flags.get('new_checkout')?.enabled).toBe(true);
  });

  it('uses a cache younger than 15 minutes on page load and refreshes an older one', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.advance(10 * MINUTE);
    const fresh = setup({ store: t.store });
    await fresh.flags.start();
    useFlags(fresh);
    await settle();
    expect(fresh.requests).toHaveLength(0);
    expect(fresh.flags.get('new_checkout')?.enabled).toBe(true);

    t.advance(20 * MINUTE);
    const stale = setup({ store: t.store });
    stale.answer({ etag: 'e1', not_modified: true });
    await stale.flags.start();
    useFlags(stale);
    await settle();
    expect(stale.requests).toHaveLength(1);
    expect(stale.requests[0].body.etag).toBe('e1');
  });

  it('refreshes hourly while the page stays open', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.answer({ etag: 'e1', not_modified: true });
    t.advance(60 * MINUTE);
    await jest.advanceTimersByTimeAsync(60 * MINUTE);

    expect(t.requests).toHaveLength(2);
  });

  it('does not serve a cache older than 24 hours or of another user', async () => {
    const t = setup({ userId: 'u1' });
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.advance(25 * 60 * MINUTE);
    expect(t.flags.get('new_checkout')).toBeNull();

    const other = setup({ store: t.store, userId: 'u2' });
    other.answerRaw(new Error('offline'));
    await other.flags.start();
    useFlags(other);
    await settle();
    expect(other.flags.get('new_checkout')).toBeNull();
  });

  it('does not request while communication is disabled and waits an hour before trying again', async () => {
    const t = setup({ communicationDisabled: true });
    await t.flags.start();
    useFlags(t);
    await settle();
    await settle();

    expect(t.requests).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(1);
    await expect(t.flags.refresh()).rejects.toBeInstanceOf(FeatureFlagsError);
    await t.flags.logImpression('new_checkout');
    expect(t.postEvent).not.toHaveBeenCalled();
  });

  it('serves the new user when the User ID changes while the store is being read', async () => {
    const t = setup({ userId: 'u1' });
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    const reload = setup({ store: t.store, userId: 'u1' });
    reload.answer({ flags: FLAGS_V2, etag: 'e2' });
    const started = reload.flags.start();
    useFlags(reload);
    reload.eventBus.dispatchEvent('change-user-id', { userId: 'u2' });
    await jest.advanceTimersByTimeAsync(0);
    await started;
    await settle();

    expect(reload.requests).toHaveLength(1);
    expect(reload.requests[0].body.etag).toBeUndefined();
    expect(reload.flags.get('new_checkout')?.enabled).toBe(false);
  });

  it('forgets the device on reset and stops the hourly timer', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    t.flags.reset();

    expect(t.flags.get('new_checkout')).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('posts one impression per page with flag_key, rule_id and enabled, and none for an absent flag', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();

    await t.flags.logImpression('new_checkout');
    await t.flags.logImpression('new_checkout');
    await t.flags.logImpression('new_checkout');
    await t.flags.logImpression('absent');

    expect(t.postEvent).toHaveBeenCalledTimes(1);
    expect(t.postEvent).toHaveBeenCalledWith(FEATURE_FLAG_IMPRESSION_EVENT, { flag_key: 'new_checkout', rule_id: 'r_1', enabled: true });
  });

  it('lets another tab skip the impression for 30 minutes', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();
    await t.flags.logImpression('new_checkout');

    const otherTab = setup({ store: t.store });
    await otherTab.flags.start();
    useFlags(otherTab);
    await settle();
    await otherTab.flags.logImpression('new_checkout');
    expect(otherTab.postEvent).not.toHaveBeenCalled();

    t.advance(31 * MINUTE);
    const laterTab = setup({ store: t.store });
    laterTab.answer({ etag: 'e1', not_modified: true });
    await laterTab.flags.start();
    useFlags(laterTab);
    await settle();
    await laterTab.flags.logImpression('new_checkout');
    expect(laterTab.postEvent).toHaveBeenCalledTimes(1);
  });

  it('never rejects an impression when the browser storage refuses it', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();
    t.store.get = jest.fn().mockRejectedValue(new Error('IndexedDB unavailable'));

    await expect(t.flags.logImpression('new_checkout')).resolves.toBeUndefined();
    t.store.get = jest.fn().mockResolvedValue({});
    await t.flags.logImpression('new_checkout');

    expect(t.postEvent).toHaveBeenCalledTimes(1);
  });

  it('sends the impression again after a failed post', async () => {
    const t = setup();
    t.answer({ flags: FLAGS_V1, etag: 'e1' });
    await t.flags.start();
    useFlags(t);
    await settle();
    t.postEvent.mockRejectedValueOnce(new Error('offline'));

    await t.flags.logImpression('new_checkout');
    await t.flags.logImpression('new_checkout');

    expect(t.postEvent).toHaveBeenCalledTimes(2);
  });

  describe('server contract fixture', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'feature_flags_contract.json'), 'utf8'));

    it.each(fixture.cases.map((c: { name: string }) => [c.name, c]))('%s', async (_name, contractCase) => {
      const { flag, want } = contractCase as { flag: { key: string }; want: { enabled: boolean; rule_id: string; properties: Record<string, unknown> } };
      const t = setup();
      t.answer({ flags: { [flag.key]: want }, etag: 'e1' });
      await t.flags.start();
      useFlags(t);
      await settle();

      const got = t.flags.get(flag.key);
      expect(got?.enabled).toBe(want.enabled);
      expect(got?.ruleId).toBe(want.rule_id);
      expect(got?.getProperties()).toEqual(want.properties);
    });
  });
});
