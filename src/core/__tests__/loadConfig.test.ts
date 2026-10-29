import { type Api } from '../../modules/Api/Api';
import { type Data } from '../../modules/Data/Data';
import { Pushwoosh } from '../Pushwoosh';

const VAPID_KEY = 'BA3-aORTyc0KHzFkUhY2qqvE8FFrJ69O7JKzz7maDqKxoqEzcmfs';

function buildSdk(previousServerKey: string | undefined, features: object = { vapid_key: VAPID_KEY }, storedWebVapid = false) {
  const data = <Data><unknown>{
    setFeatures: jest.fn().mockResolvedValue(undefined),
    getApplicationServerKey: jest.fn().mockResolvedValue(previousServerKey),
    setApplicationServerKey: jest.fn().mockResolvedValue(undefined),
    setIsVapidChanged: jest.fn().mockResolvedValue(undefined),
    getWebVapidConfigured: jest.fn().mockResolvedValue(storedWebVapid),
    setWebVapidConfigured: jest.fn().mockResolvedValue(undefined),
    setInitParams: jest.fn().mockResolvedValue(undefined),
    getDeviceType: jest.fn().mockResolvedValue(11),
  };
  const api = <Api><unknown>{
    getConfig: jest.fn().mockResolvedValue({ features }),
    postEvent: jest.fn().mockResolvedValue(undefined),
  };
  const sdk = new Pushwoosh();

  Object.assign(sdk, { data, api });

  return { loadConfig: (<{ loadConfig: () => Promise<void> }><unknown>sdk).loadConfig.bind(sdk), data, api, sdk };
}

describe('loadConfig', () => {
  it('does not call the first vapid key a change', async () => {
    const { loadConfig, data } = buildSdk(undefined);

    await loadConfig();

    expect(data.setApplicationServerKey).toHaveBeenCalledWith(VAPID_KEY);
    expect(data.setIsVapidChanged).not.toHaveBeenCalled();
  });

  it('flags a key that replaced another one', async () => {
    const { loadConfig, data } = buildSdk('an-older-key');

    await loadConfig();

    expect(data.setIsVapidChanged).toHaveBeenCalledWith(true);
  });

  it('leaves the flag alone when the key is unchanged', async () => {
    const { loadConfig, data } = buildSdk(VAPID_KEY);

    await loadConfig();

    expect(data.setIsVapidChanged).not.toHaveBeenCalled();
  });
});

describe('loadConfig and web_vapid_configured', () => {
  const read = (sdk: Pushwoosh) => (<{ isWebVapidConfigured: boolean }><unknown>sdk).isWebVapidConfigured;

  it('asks for it and stores the answer', async () => {
    const { loadConfig, data, api, sdk } = buildSdk(undefined, { vapid_key: VAPID_KEY, web_vapid_configured: true });

    await loadConfig();

    expect(api.getConfig).toHaveBeenCalledWith(expect.arrayContaining(['web_vapid_configured']));
    expect(data.setWebVapidConfigured).toHaveBeenCalledWith(true);
    expect(read(sdk)).toBe(true);
  });

  it('does not rewrite a stored answer the server repeats', async () => {
    const { loadConfig, data } = buildSdk(undefined, { vapid_key: VAPID_KEY, web_vapid_configured: true }, true);

    await loadConfig();

    expect(data.setWebVapidConfigured).not.toHaveBeenCalled();
  });

  it('keeps the stored answer when an older device-api does not give one', async () => {
    const { loadConfig, data, sdk } = buildSdk(undefined, { vapid_key: VAPID_KEY }, true);

    await loadConfig();

    expect(data.setWebVapidConfigured).not.toHaveBeenCalled();
    expect(read(sdk)).toBe(true);
  });
});

describe('loadConfig and PW_SiteOpened', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('sends the page visit with the page path when the app has the event on', async () => {
    window.history.replaceState({}, '', '/Catalog/');
    const { loadConfig, api } = buildSdk(undefined, { events: ['PW_SiteOpened'] });

    await loadConfig();

    // loadConfig does not wait for the event.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(api.postEvent).toHaveBeenCalledWith('PW_SiteOpened', expect.objectContaining({ path: '/catalog/' }));
  });
});

describe('loadConfig with a panel-managed inbox', () => {
  it('puts the panel inbox into initParams, which init reads to register the device', async () => {
    const sdk = new Pushwoosh();
    const snippet = { applicationCode: 'XXXXX-XXXXX', inboxWidget: { enable: false, triggerId: 'siteBell' } };
    const data = <Data><unknown>{
      setFeatures: jest.fn().mockResolvedValue(undefined),
      setInitParams: jest.fn().mockResolvedValue(undefined),
      getWebVapidConfigured: jest.fn().mockResolvedValue(false),
    };
    const api = <Api><unknown>{
      getConfig: jest.fn().mockResolvedValue({ features: { web_sdk: { inboxWidget: { enable: true } } } }),
    };

    Object.assign(sdk, { data, api, rawInitParams: snippet, initParams: snippet });
    await (<{ loadConfig: () => Promise<void> }><unknown>sdk).loadConfig.call(sdk);

    expect(sdk.initParams.inboxWidget).toEqual({ enable: true, triggerId: 'siteBell' });
  });

  it('takes the modules of a legacy app from web_sdk_modules, and nothing else from there', async () => {
    const sdk = new Pushwoosh();
    const snippet = { applicationCode: 'XXXXX-XXXXX', autoSubscribe: false, webPopups: { colorScheme: 'dark' as const } };
    const data = <Data><unknown>{
      setFeatures: jest.fn().mockResolvedValue(undefined),
      setInitParams: jest.fn().mockResolvedValue(undefined),
      getWebVapidConfigured: jest.fn().mockResolvedValue(false),
    };
    const api = <Api><unknown>{
      getConfig: jest.fn().mockResolvedValue({
        features: { web_sdk_modules: { webPopups: { enable: false }, autoSubscribe: true } },
      }),
    };

    Object.assign(sdk, { data, api, rawInitParams: snippet, initParams: snippet });
    await (<{ loadConfig: () => Promise<void> }><unknown>sdk).loadConfig.call(sdk);

    expect(sdk.initParams.webPopups).toEqual({ colorScheme: 'dark', enable: false });
    expect(sdk.initParams.autoSubscribe).toBe(false);
    expect(api.getConfig).toHaveBeenCalledWith(expect.arrayContaining(['web_sdk', 'web_sdk_modules']));
  });
});
