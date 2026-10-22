import { SUBSCRIPTION_WAIT_TIMEOUT_MS } from '../../../core/constants';
import { type EventBus } from '../../../core/modules/EventBus';
import { type TPushPermissionStatus } from '../../../services/PushService/pushPermissionStatus';
import { type ApiClient } from '../../ApiClient/ApiClient';
import { type Data } from '../../Data/Data';
import { Api } from '../Api';

const DEVICE_ABSENT = { exist: false, push_token_exist: false };
const DEVICE_PRESENT = { exist: true, push_token_exist: true };

function buildData(overrides: object = {}) {
  return <Data><unknown>{
    getApplicationCode: jest.fn().mockResolvedValue('AAAAA-BBBBB'),
    getHwid: jest.fn().mockResolvedValue('AAAAA-BBBBB_hwid'),
    getUserId: jest.fn().mockResolvedValue('AAAAA-BBBBB_hwid'),
    getDeviceModel: jest.fn().mockResolvedValue('Chrome 153'),
    getDeviceType: jest.fn().mockResolvedValue(11),
    getLanguage: jest.fn().mockResolvedValue('en-US'),
    getSdkVersion: jest.fn().mockResolvedValue('3.83.0'),
    getStatusCommunicationDisabled: jest.fn().mockResolvedValue(false),
    getTokens: jest.fn().mockResolvedValue({ pushToken: 'endpoint', authToken: 'auth', publicKey: 'key' }),
    setStatusManualUnsubscribed: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildApi(
  apiClientOverrides: object = {},
  data: Data = buildData(),
  getPushPermissionStatus: () => TPushPermissionStatus | undefined = () => undefined,
) {
  const apiClient = <ApiClient><unknown>{
    checkDevice: jest.fn().mockResolvedValue(DEVICE_ABSENT),
    applicationOpen: jest.fn().mockResolvedValue({}),
    registerDevice: jest.fn().mockResolvedValue({ iosCategories: [] }),
    unregisterDevice: jest.fn().mockResolvedValue({}),
    multiRegisterDevice: jest.fn().mockResolvedValue({}),
    ...apiClientOverrides,
  };
  const eventBus = <EventBus><unknown>{ dispatchEvent: jest.fn() };

  return { api: new Api(eventBus, data, apiClient, () => false, () => undefined, getPushPermissionStatus), apiClient };
}

beforeEach(() => {
  localStorage.clear();
});

describe('checkDevice', () => {
  it('asks the backend once per page', async () => {
    const { api, apiClient } = buildApi();

    await Promise.all([api.checkDevice(), api.checkDevice()]);
    await api.checkDevice();

    expect(apiClient.checkDevice).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failure', async () => {
    const checkDevice = jest.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(DEVICE_ABSENT);
    const { api } = buildApi({ checkDevice });

    await expect(api.checkDevice()).rejects.toThrow('network');

    await expect(api.checkDevice()).resolves.toEqual(DEVICE_ABSENT);
    expect(checkDevice).toHaveBeenCalledTimes(2);
  });

  it('re-reads the device after registerDevice', async () => {
    const checkDevice = jest.fn()
      .mockResolvedValueOnce(DEVICE_ABSENT)
      .mockResolvedValue(DEVICE_PRESENT);
    const { api } = buildApi({ checkDevice });

    await api.checkDevice();
    await api.registerDevice();

    await expect(api.checkDevice()).resolves.toEqual(DEVICE_PRESENT);
    expect(checkDevice).toHaveBeenCalledTimes(2);
  });

  it('re-reads the device after multiRegisterDevice registered the push device', async () => {
    const checkDevice = jest.fn()
      .mockResolvedValueOnce(DEVICE_ABSENT)
      .mockResolvedValue(DEVICE_PRESENT);
    const { api } = buildApi({ checkDevice });

    await api.checkDevice();
    await api.multiRegisterDevice({});

    await expect(api.checkDevice()).resolves.toEqual(DEVICE_PRESENT);
    expect(checkDevice).toHaveBeenCalledTimes(2);
  });

  it('keeps the memo when multiRegisterDevice touched no push device', async () => {
    const data = buildData({ getTokens: jest.fn().mockResolvedValue({}) });
    const { api, apiClient } = buildApi({}, data);

    await api.checkDevice();
    await api.multiRegisterDevice({});
    await api.checkDevice();

    expect(apiClient.checkDevice).toHaveBeenCalledTimes(1);
  });

  it('re-reads the device after unregisterDevice', async () => {
    const checkDevice = jest.fn()
      .mockResolvedValueOnce(DEVICE_PRESENT)
      .mockResolvedValue(DEVICE_ABSENT);
    const { api } = buildApi({ checkDevice });

    await api.checkDevice();
    await api.unregisterDevice();

    await expect(api.checkDevice()).resolves.toEqual(DEVICE_ABSENT);
    expect(checkDevice).toHaveBeenCalledTimes(2);
  });
});

describe('checkDeviceSubscribeForPushNotifications', () => {
  it('asks the backend when no status was ever stored', async () => {
    const { api, apiClient } = buildApi({ checkDevice: jest.fn().mockResolvedValue(DEVICE_PRESENT) });

    await expect(api.checkDeviceSubscribeForPushNotifications()).resolves.toBe(true);
    expect(apiClient.checkDevice).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('deviceRegistrationStatus')).toBe('registered');
  });

  it('trusts a stored status', async () => {
    localStorage.setItem('deviceRegistrationStatus', 'registered');
    const { api, apiClient } = buildApi();

    await expect(api.checkDeviceSubscribeForPushNotifications()).resolves.toBe(true);
    expect(apiClient.checkDevice).not.toHaveBeenCalled();
  });

  it('bypasses a stored status when asked for a fresh read', async () => {
    localStorage.setItem('deviceRegistrationStatus', 'registered');
    const { api, apiClient } = buildApi();

    await expect(api.checkDeviceSubscribeForPushNotifications(false)).resolves.toBe(false);
    expect(apiClient.checkDevice).toHaveBeenCalledTimes(1);
  });
});

describe('ensureDeviceRegistered', () => {
  it('shares the checkDevice of the surrounding init', async () => {
    const { api, apiClient } = buildApi();

    await api.checkDeviceSubscribeForPushNotifications(false);
    await api.ensureDeviceRegistered();

    expect(apiClient.checkDevice).toHaveBeenCalledTimes(1);
    expect(apiClient.registerDevice).toHaveBeenCalledTimes(1);
  });

  it('leaves an existing device alone', async () => {
    const { api, apiClient } = buildApi({ checkDevice: jest.fn().mockResolvedValue(DEVICE_PRESENT) });

    await expect(api.ensureDeviceRegistered()).resolves.toBe(false);
    expect(apiClient.registerDevice).not.toHaveBeenCalled();
  });
});

describe('registerUser', () => {
  function buildUserApi(storedUserId: string | undefined) {
    const data = buildData({
      getUserId: jest.fn().mockResolvedValue(storedUserId),
      setUserId: jest.fn().mockResolvedValue(undefined),
      setStatusUserIdWasChanged: jest.fn().mockResolvedValue(undefined),
    });
    const apiClient = <ApiClient><unknown>{ registerUser: jest.fn().mockResolvedValue({}) };
    const eventBus = <EventBus><unknown>{ dispatchEvent: jest.fn() };

    return { api: new Api(eventBus, data, apiClient), eventBus };
  }

  it('announces a User ID the server accepted when it differs from the stored one', async () => {
    const { api, eventBus } = buildUserApi('u1');

    await api.registerUser('u2');

    expect(eventBus.dispatchEvent).toHaveBeenCalledWith('change-user-id', { userId: 'u2' });
  });

  it('stays silent when the User ID is the stored one', async () => {
    const { api, eventBus } = buildUserApi('u1');

    await api.registerUser('u1');

    expect(eventBus.dispatchEvent).not.toHaveBeenCalled();
  });
});

describe('push_permission_status', () => {
  const status = () => 'denied' as const;

  it('goes with applicationOpen', async () => {
    const data = buildData({ setLastOpenApplicationTime: jest.fn().mockResolvedValue(undefined) });
    const { api, apiClient } = buildApi({}, data, status);

    await api.applicationOpen();

    expect(apiClient.applicationOpen).toHaveBeenCalledWith(expect.objectContaining({ push_permission_status: 'denied' }));
  });

  it('goes with registerDevice', async () => {
    const { api, apiClient } = buildApi({}, buildData(), status);

    await api.registerDevice();

    expect(apiClient.registerDevice).toHaveBeenCalledWith(expect.objectContaining({
      push_permission_status: 'denied',
      push_token: 'endpoint',
    }));
  });

  it('goes with the tokenless registerDevice of ensureDeviceRegistered', async () => {
    const { api, apiClient } = buildApi({}, buildData(), status);

    await api.ensureDeviceRegistered();

    expect(apiClient.registerDevice).toHaveBeenCalledWith(expect.objectContaining({ push_permission_status: 'denied' }));
  });

  it('goes with a tokenless registerDevice for a device without a token', async () => {
    const { api, apiClient } = buildApi({}, buildData(), status);

    await api.reportPushPermissionStatus();

    expect(apiClient.registerDevice).toHaveBeenCalledWith(expect.objectContaining({ push_permission_status: 'denied' }));
    expect(apiClient.registerDevice).toHaveBeenCalledWith(expect.not.objectContaining({ push_token: expect.anything() }));
    expect(apiClient.applicationOpen).not.toHaveBeenCalled();
  });

  it('is not reported for a subscribed device, a tokenless registerDevice would clear its token', async () => {
    const { api, apiClient } = buildApi({ checkDevice: jest.fn().mockResolvedValue(DEVICE_PRESENT) }, buildData(), status);

    await api.reportPushPermissionStatus();

    expect(apiClient.registerDevice).not.toHaveBeenCalled();
  });

  it('trusts the local unsubscribe over a lagging checkDevice', async () => {
    const { api, apiClient } = buildApi({ checkDevice: jest.fn().mockResolvedValue(DEVICE_PRESENT) }, buildData(), status);

    await api.unregisterDevice();
    await api.reportPushPermissionStatus();

    expect(apiClient.registerDevice).toHaveBeenCalledTimes(1);
  });

  it('waits for a subscription in flight instead of clearing its token', async () => {
    let answerRegistration: (value: object) => void = () => undefined;
    const registerDevice = jest.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { answerRegistration = resolve; }))
      .mockResolvedValue({});
    const { api, apiClient } = buildApi({ registerDevice }, buildData(), status);

    const subscription = api.registerDevice();
    const report = api.reportPushPermissionStatus();
    while (registerDevice.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    answerRegistration({ iosCategories: [] });
    await Promise.all([subscription, report]);

    expect(apiClient.registerDevice).toHaveBeenCalledTimes(1);
    expect(apiClient.registerDevice).toHaveBeenCalledWith(expect.objectContaining({ push_token: 'endpoint' }));
  });

  it('is not repeated for a status the server already has', async () => {
    const data = buildData({ setLastOpenApplicationTime: jest.fn().mockResolvedValue(undefined) });
    const { api, apiClient } = buildApi({}, data, status);

    await api.applicationOpen();
    await api.reportPushPermissionStatus();

    expect(apiClient.registerDevice).not.toHaveBeenCalled();
  });

  it('survives a reload: a reported status is not sent again on the next page', async () => {
    const first = buildApi({}, buildData(), status);
    await first.api.reportPushPermissionStatus();

    const second = buildApi({}, buildData(), status);
    await second.api.reportPushPermissionStatus();

    expect(first.apiClient.registerDevice).toHaveBeenCalledTimes(1);
    expect(second.apiClient.registerDevice).not.toHaveBeenCalled();
  });

  it('sends one report when the dialog and the permissions change event fire together', async () => {
    const { api, apiClient } = buildApi({}, buildData(), status);

    await Promise.all([api.reportPushPermissionStatus(), api.reportPushPermissionStatus()]);

    expect(apiClient.registerDevice).toHaveBeenCalledTimes(1);
  });

  it('is sent again after a failed report', async () => {
    const registerDevice = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue({});
    const { api, apiClient } = buildApi({ registerDevice }, buildData(), status);

    await expect(api.reportPushPermissionStatus()).rejects.toThrow('network');
    await api.reportPushPermissionStatus();

    expect(apiClient.registerDevice).toHaveBeenCalledTimes(2);
  });

  it('tells whether the current status is the one the server has', async () => {
    const { api } = buildApi({}, buildData(), status);

    expect(api.isPushPermissionStatusReported()).toBe(false);
    await api.registerDevice();
    expect(api.isPushPermissionStatusReported()).toBe(true);
  });

  it('drops the report instead of overtaking a registerDevice that hangs, and waits for it only once', async () => {
    jest.useFakeTimers();
    const registerDevice = jest.fn().mockImplementationOnce(() => new Promise(() => undefined)).mockResolvedValue({});
    const { api, apiClient } = buildApi({ registerDevice }, buildData(), status);

    void api.registerDevice().catch(() => undefined);
    await jest.advanceTimersByTimeAsync(0);
    const first = api.reportPushPermissionStatus();
    await jest.advanceTimersByTimeAsync(SUBSCRIPTION_WAIT_TIMEOUT_MS);
    await first;
    await api.reportPushPermissionStatus();
    jest.useRealTimers();

    expect(apiClient.registerDevice).toHaveBeenCalledTimes(1);
  });

  it('stays out of other requests', async () => {
    const { api, apiClient } = buildApi({}, buildData(), status);

    await api.unregisterDevice();

    expect(apiClient.unregisterDevice).toHaveBeenCalledWith(expect.not.objectContaining({ push_permission_status: expect.anything() }));
  });
});
