import { type IPushService } from '../../services/PushService/PushService.types';
import { SUBSCRIPTION_WAIT_TIMEOUT_MS } from '../constants';
import { Pushwoosh } from '../Pushwoosh';

type Internals = {
  reportPushPermissionChange: () => Promise<void>;
  subscriptionInFlight: Promise<void> | null;
};

const hanging = () => new Promise<void>(() => undefined);

function buildSdk(permission: NotificationPermission) {
  const sdk = new Pushwoosh();
  sdk.driver = <IPushService><unknown>{ getPermission: () => permission };
  jest.spyOn(sdk.api, 'isPushPermissionStatusReported').mockReturnValue(false);
  jest.spyOn(sdk.api, 'checkDeviceSubscribeForPushNotifications').mockResolvedValue(false);
  jest.spyOn(sdk.data, 'getStatusManualUnsubscribed').mockResolvedValue(false);
  const report = jest.spyOn(sdk.api, 'reportPushPermissionStatus').mockResolvedValue(undefined);

  return { sdk, internals: <Internals><unknown>sdk, report };
}

describe('reportPushPermissionChange', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('re-subscribes on a grant in the site settings and then reports', async () => {
    const { sdk, internals, report } = buildSdk('granted');
    const subscribe = jest.spyOn(sdk, 'subscribe').mockResolvedValue(undefined);

    await internals.reportPushPermissionChange();

    expect(subscribe).toHaveBeenCalledWith(false);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('still reports when the re-subscribe hangs in PushManager.subscribe', async () => {
    const { sdk, internals, report } = buildSdk('granted');
    jest.spyOn(sdk, 'subscribe').mockImplementation(hanging);

    const reporting = internals.reportPushPermissionChange();
    await jest.advanceTimersByTimeAsync(SUBSCRIPTION_WAIT_TIMEOUT_MS);
    await reporting;

    expect(report).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for a stuck dialog subscription and does not start another', async () => {
    const { sdk, internals, report } = buildSdk('granted');
    const subscribe = jest.spyOn(sdk, 'subscribe');
    internals.subscriptionInFlight = hanging();

    const reporting = internals.reportPushPermissionChange();
    await jest.advanceTimersByTimeAsync(SUBSCRIPTION_WAIT_TIMEOUT_MS);
    await reporting;

    expect(subscribe).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('keeps reporting later changes while a subscription stays stuck', async () => {
    const { sdk, internals, report } = buildSdk('default');
    jest.spyOn(sdk, 'subscribe').mockImplementation(hanging);
    internals.subscriptionInFlight = hanging();

    for (let i = 0; i < 2; i++) {
      const reporting = internals.reportPushPermissionChange();
      await jest.advanceTimersByTimeAsync(SUBSCRIPTION_WAIT_TIMEOUT_MS);
      await reporting;
    }

    expect(report).toHaveBeenCalledTimes(2);
  });
});

describe('permission changes while a subscription hangs (real Api)', () => {
  let permission: NotificationPermission;
  let registerDevice: jest.Mock;

  function buildRealSdk() {
    const sdk = new Pushwoosh();
    sdk.driver = <IPushService><unknown>{
      getPermission: () => permission,
      checkIsPermissionDefault: () => permission === 'default',
      subscribe: hanging,
      unsubscribe: hanging,
    };
    registerDevice = jest.fn().mockResolvedValue({});
    const apiClient = (<{ apiClient: Record<string, jest.Mock> }><unknown>sdk.api).apiClient;
    apiClient.registerDevice = registerDevice;
    apiClient.checkDevice = jest.fn().mockResolvedValue({ exist: true, push_token_exist: false });
    for (const [name, value] of Object.entries({
      getApplicationCode: 'AAAAA-BBBBB', getHwid: 'hwid', getUserId: 'hwid', getDeviceModel: 'Chrome',
      getDeviceType: 11, getLanguage: 'en', getSdkVersion: '3.83.0', getStatusManualUnsubscribed: false,
    })) {
      (<Record<string, jest.Mock>><unknown>sdk.data)[name] = jest.fn().mockResolvedValue(value);
    }
    jest.spyOn(sdk.data, 'setLastPermissionStatus').mockResolvedValue(undefined);
    jest.spyOn(sdk.data, 'setStatusManualUnsubscribed').mockResolvedValue(undefined);

    return <Internals><unknown>sdk;
  }

  const sentStatuses = () => registerDevice.mock.calls.map(([params]) => params.push_permission_status);

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => jest.useRealTimers());

  it('reports a grant and then a reset to "ask", waiting for the stuck subscription only once', async () => {
    const sdk = buildRealSdk();
    localStorage.setItem('deviceRegistrationStatus', 'unregistered');
    localStorage.setItem('reportedPushPermissionStatus', 'denied');

    permission = 'granted';
    const grant = sdk.reportPushPermissionChange();
    await jest.advanceTimersByTimeAsync(SUBSCRIPTION_WAIT_TIMEOUT_MS);
    await grant;

    permission = 'default';
    await sdk.reportPushPermissionChange();

    expect(sentStatuses()).toEqual(['granted_explicit', 'not_determined']);
  });

  it('reports a revoke whose unsubscribe hangs, and the change after it', async () => {
    const sdk = buildRealSdk();
    localStorage.setItem('deviceRegistrationStatus', 'registered');
    localStorage.setItem('reportedPushPermissionStatus', 'granted_explicit');

    permission = 'denied';
    const revoke = sdk.reportPushPermissionChange();
    await jest.advanceTimersByTimeAsync(SUBSCRIPTION_WAIT_TIMEOUT_MS);
    await revoke;

    permission = 'default';
    const reset = sdk.reportPushPermissionChange();
    await jest.advanceTimersByTimeAsync(SUBSCRIPTION_WAIT_TIMEOUT_MS);
    await reset;

    expect(sentStatuses()).toEqual(['denied', 'not_determined']);
  });
});
