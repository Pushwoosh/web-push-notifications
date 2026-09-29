import { type EventBus } from '../../../core/modules/EventBus';
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

function buildApi(apiClientOverrides: object = {}, data: Data = buildData()) {
  const apiClient = <ApiClient><unknown>{
    checkDevice: jest.fn().mockResolvedValue(DEVICE_ABSENT),
    registerDevice: jest.fn().mockResolvedValue({ iosCategories: [] }),
    unregisterDevice: jest.fn().mockResolvedValue({}),
    multiRegisterDevice: jest.fn().mockResolvedValue({}),
    ...apiClientOverrides,
  };
  const eventBus = <EventBus><unknown>{ dispatchEvent: jest.fn() };

  return { api: new Api(eventBus, data, apiClient), apiClient };
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
