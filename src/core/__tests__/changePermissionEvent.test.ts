import { type PlatformChecker } from '../../modules/PlatformChecker';
import { type IPushService } from '../../services/PushService/PushService.types';
import { Pushwoosh } from '../Pushwoosh';
import { type IInitParams } from '../Pushwoosh.types';

// Webpack defines it at build time; init reads it for the SDK version.
(<{ __VERSION__?: string }>globalThis).__VERSION__ = '3.0.0';

let permission: NotificationPermission;
let permissionStatus: EventTarget;

const nextMacrotask = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

// The dialog sets `answer`; Chrome also fires `change` on the permission when it closes.
function buildDriver(answer: NotificationPermission, firesChange: boolean): IPushService {
  return <IPushService><unknown>{
    getPermission: () => permission,
    checkIsPermissionDefault: () => permission === 'default',
    askPermission: async () => {
      permission = answer;
      if (firesChange) {
        permissionStatus.dispatchEvent(new Event('change'));
      }
    },
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
  };
}

async function initSdk(driver: IPushService = buildDriver('default', false)) {
  const sdk = new Pushwoosh();
  sdk.platformChecker = <PlatformChecker><unknown>{
    isAvailableNotifications: true,
    isSafari: false,
    isAvailableServiceWorker: false,
    getPlatformType: () => 11,
    getBrowserVersion: () => 'Chrome 140',
    formFactor: 'DESKTOP',
  };
  // getConfig gives no vapid key, so init builds no driver of its own and keeps this one.
  sdk.driver = driver;
  jest.spyOn(sdk.api, 'getConfig').mockResolvedValue(<never>{ features: {} });
  jest.spyOn(sdk.api, 'applicationOpen').mockResolvedValue(<never>{});
  jest.spyOn(sdk.api, 'isPushPermissionStatusReported').mockReturnValue(true);
  jest.spyOn(sdk.api, 'checkDeviceSubscribeForPushNotifications').mockResolvedValue(false);
  jest.spyOn(sdk.api, 'unregisterDevice').mockResolvedValue(<never>{});
  jest.spyOn(sdk.api, 'postEvent').mockResolvedValue(<never>{});

  const events: Array<NotificationPermission> = [];
  sdk.addEventHandler('change-permission', ({ permission: value }) => {
    events.push(value);
  });

  const ready = new Promise<void>((resolve) => {
    sdk.addEventHandler('ready', () => resolve());
  });
  sdk.push(['init', <IInitParams>{ applicationCode: 'XXXXX-XXXXX' }]);
  await ready;

  return { sdk, events };
}

beforeEach(() => {
  permission = 'default';
  permissionStatus = new EventTarget();
  Object.defineProperty(navigator, 'permissions', {
    value: { query: jest.fn().mockResolvedValue(permissionStatus) },
    configurable: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

describe('change-permission', () => {
  it('reports a change made in the site settings while the page is open', async () => {
    const { events } = await initSdk();

    permission = 'granted';
    permissionStatus.dispatchEvent(new Event('change'));
    await nextMacrotask();

    expect(events).toEqual(['granted']);
  });

  it('keeps reporting after communication is disabled', async () => {
    const { sdk, events } = await initSdk();
    await sdk.setCommunicationEnabled(false);

    permission = 'denied';
    permissionStatus.dispatchEvent(new Event('change'));
    await nextMacrotask();

    expect(events).toEqual(['denied']);
  });

  it('reports nothing when the permission did not change', async () => {
    const { events } = await initSdk();

    permissionStatus.dispatchEvent(new Event('change'));
    await nextMacrotask();

    expect(events).toEqual([]);
  });

  it.each(['granted', 'denied'] as const)('reports a %s answer in the subscribe() dialog', async (answer) => {
    const { sdk, events } = await initSdk(buildDriver(answer, false));

    await sdk.subscribe();
    await nextMacrotask();

    expect(events).toEqual([answer]);
  });

  it('reports nothing for a dialog closed without an answer', async () => {
    const { sdk, events } = await initSdk(buildDriver('default', false));

    await sdk.subscribe();
    await nextMacrotask();

    expect(events).toEqual([]);
  });

  it('reports a dialog answer once when the browser also fires change', async () => {
    const { sdk, events } = await initSdk(buildDriver('granted', true));

    await sdk.subscribe();
    await nextMacrotask();

    expect(events).toEqual(['granted']);
  });
});
