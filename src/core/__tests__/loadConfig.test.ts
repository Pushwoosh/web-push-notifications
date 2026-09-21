import { type Api } from '../../modules/Api/Api';
import { type Data } from '../../modules/Data/Data';
import { Pushwoosh } from '../Pushwoosh';

const VAPID_KEY = 'BA3-aORTyc0KHzFkUhY2qqvE8FFrJ69O7JKzz7maDqKxoqEzcmfs';

function buildSdk(previousServerKey: string | undefined, vapidKey: string = VAPID_KEY) {
  const data = <Data><unknown>{
    setFeatures: jest.fn().mockResolvedValue(undefined),
    getApplicationServerKey: jest.fn().mockResolvedValue(previousServerKey),
    setApplicationServerKey: jest.fn().mockResolvedValue(undefined),
    setIsVapidChanged: jest.fn().mockResolvedValue(undefined),
    setInitParams: jest.fn().mockResolvedValue(undefined),
  };
  const api = <Api><unknown>{
    getConfig: jest.fn().mockResolvedValue({ features: { vapid_key: vapidKey } }),
  };
  const sdk = new Pushwoosh();

  Object.assign(sdk, { data, api });

  return { loadConfig: (<{ loadConfig: () => Promise<void> }><unknown>sdk).loadConfig.bind(sdk), data };
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
