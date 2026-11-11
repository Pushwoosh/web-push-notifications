import { type Data } from '../../modules/Data/Data';
import { type PlatformChecker } from '../../modules/PlatformChecker';
import { PushServiceDefault, PushServiceSafari } from '../../services/PushService/PushService';
import { Pushwoosh } from '../Pushwoosh';

const WEBSITE_PUSH_ID = 'web.com.example';

type Legacy = 'subscribed' | 'granted-no-token' | 'default' | 'denied' | 'absent';

function setLegacySafari(state: Legacy) {
  if (state === 'absent') {
    delete (<{ safari?: unknown }><unknown>globalThis).safari;

    return;
  }

  const info = {
    subscribed: { permission: 'granted', deviceToken: 'apns-token' },
    'granted-no-token': { permission: 'granted' },
    default: { permission: 'default' },
    denied: { permission: 'denied' },
  }[state];

  Object.assign(globalThis, { safari: { pushNotification: { permission: () => info } } });
}

function buildSdk(opts: { safari?: boolean; webVapid?: boolean; unifiedPlatform?: boolean; websitePushId?: boolean; serviceWorker?: boolean }) {
  const initParams = {
    applicationCode: 'XXXXX-XXXXX',
    safariWebsitePushID: opts.websitePushId === false ? undefined : WEBSITE_PUSH_ID,
    unifiedPlatform: opts.unifiedPlatform,
  };
  const platformChecker = <PlatformChecker><unknown>{
    isSafari: opts.safari !== false,
    isAvailableServiceWorker: opts.serviceWorker !== false,
    getPlatformType: () => (opts.safari !== false ? 10 : 12),
  };
  const data = <Data><unknown>{
    getInitParams: jest.fn().mockResolvedValue(initParams),
  };
  const sdk = new Pushwoosh();

  Object.assign(sdk, { initParams, platformChecker, data, api: {}, isWebVapidConfigured: opts.webVapid === true });

  const internals = <{ resolvePlatformType: () => number; initDriver: () => Promise<void> }><unknown>sdk;

  // init resolves the platform before it builds the driver; the driver choice is made there
  const choose = async () => {
    const platform = internals.resolvePlatformType.call(sdk);
    await internals.initDriver.call(sdk);

    return platform;
  };

  return { choose, sdk };
}

afterEach(() => setLegacySafari('absent'));

describe('Safari driver choice', () => {
  it('keeps a live legacy subscription on the APNs path, whatever the app has', async () => {
    setLegacySafari('subscribed');
    const { choose, sdk } = buildSdk({ webVapid: true, unifiedPlatform: true });

    const platform = await choose();

    expect(sdk.driver).toBeInstanceOf(PushServiceSafari);
    expect(platform).toBe(10);
  });

  it.each(['granted-no-token', 'default', 'denied', 'absent'] as const)(
    'takes the service worker as Chrome when the legacy subscription is %s and the app has web VAPID',
    async (state) => {
      setLegacySafari(state);
      const { choose, sdk } = buildSdk({ webVapid: true });

      const platform = await choose();

      expect(sdk.driver).toBeInstanceOf(PushServiceDefault);
      expect(platform).toBe(11);
    },
  );

  it('stays legacy without web VAPID: the FCM key can not reach Safari', async () => {
    setLegacySafari('default');
    const { choose, sdk } = buildSdk({ webVapid: false });

    const platform = await choose();

    expect(sdk.driver).toBeInstanceOf(PushServiceSafari);
    expect(platform).toBe(10);
  });

  it('has no driver without web VAPID and without a website push ID, as before', async () => {
    setLegacySafari('default');
    const { choose, sdk } = buildSdk({ webVapid: false, websitePushId: false });

    await choose();

    expect(sdk.driver).toBeUndefined();
  });

  it('lets unifiedPlatform force the service worker without web VAPID', async () => {
    setLegacySafari('default');
    const { choose, sdk } = buildSdk({ webVapid: false, unifiedPlatform: true });

    const platform = await choose();

    expect(sdk.driver).toBeInstanceOf(PushServiceDefault);
    expect(platform).toBe(11);
  });

  it('stays legacy on Safari without the Web Push API, even with web VAPID', async () => {
    setLegacySafari('default');
    const { choose, sdk } = buildSdk({ webVapid: true, serviceWorker: false });

    const platform = await choose();

    expect(sdk.driver).toBeInstanceOf(PushServiceSafari);
    expect(platform).toBe(10);
  });

  it('does not touch other browsers', async () => {
    setLegacySafari('subscribed');
    const { choose, sdk } = buildSdk({ safari: false, webVapid: true });

    const platform = await choose();

    expect(sdk.driver).toBeInstanceOf(PushServiceDefault);
    expect(platform).toBe(12);
  });
});
