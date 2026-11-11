import { type IInitParams } from './Pushwoosh.types';

// Record over keyof makes a new IInitParams key a type error here until it is listed.
const INIT_KEYS: Record<keyof IInitParams, true> = {
  applicationCode: true,
  apiToken: true,
  communicationEnabled: true,
  serviceWorkerUrl: true,
  safariWebsitePushID: true,
  autoSubscribe: true,
  pushNotifications: true,
  pushwooshUrl: true,
  defaultNotificationImage: true,
  defaultNotificationTitle: true,
  logLevel: true,
  userId: true,
  email: true,
  smsNumber: true,
  whatsAppNumber: true,
  scope: true,
  tags: true,
  subscribeWidget: true,
  inboxWidget: true,
  subscribePopup: true,
  subscriptionWidget: true,
  webPopups: true,
  webPlacements: true,
  recommendations: true,
  webSDKPath: true,
  unifiedPlatform: true,
};

// Declared in public/index.d.ts, so a site passing it follows our own typings.
const PUBLIC_ONLY_KEYS = ['pushwooshApiUrl'];

const KNOWN_KEYS = [...Object.keys(INIT_KEYS), ...PUBLIC_ONLY_KEYS];

const WIDGETS_WITH_ENABLE = ['subscribeWidget', 'subscribePopup', 'inboxWidget', 'webPopups', 'webPlacements'];

export interface IUnknownInitKey {
  key: string;
  suggestion?: string;
}

const distance = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }

  return previous[b.length];
};

const suggest = (key: string): string | undefined => {
  const lower = key.toLowerCase();
  let nearest: string | undefined;
  let nearestDistance = 3;

  KNOWN_KEYS.forEach((known) => {
    const d = distance(lower, known.toLowerCase());
    if (d < nearestDistance) {
      nearest = known;
      nearestDistance = d;
    }
  });

  return nearest;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export function findUnknownInitKeys(params: object): IUnknownInitKey[] {
  const result: IUnknownInitKey[] = [];

  Object.entries(params).forEach(([key, value]) => {
    if (!KNOWN_KEYS.includes(key)) {
      result.push({ key, suggestion: suggest(key) });
      return;
    }

    // No widget reads `enabled`, so the switch the site meant to set never takes effect.
    if (WIDGETS_WITH_ENABLE.includes(key) && isPlainObject(value) && 'enabled' in value && !('enable' in value)) {
      result.push({ key: `${key}.enabled`, suggestion: `${key}.enable` });
    }
  });

  return result;
}

export function warnUnknownInitKeys(params: object): void {
  findUnknownInitKeys(params).forEach(({ key, suggestion }) => {
    const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
    console.warn(`Pushwoosh: unknown init parameter "${key}" is ignored.${hint}`);
  });
}
