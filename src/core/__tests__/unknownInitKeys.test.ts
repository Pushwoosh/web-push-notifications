import { findUnknownInitKeys, warnUnknownInitKeys } from '../unknownInitKeys';

describe('findUnknownInitKeys', () => {
  it('accepts every documented key', () => {
    expect(findUnknownInitKeys({
      applicationCode: 'AAAAA-BBBBB',
      logLevel: 'error',
      subscribeWidget: { enable: true },
      pushwooshApiUrl: 'https://example.com',
      recommendations: { spa: true },
    })).toEqual([]);
  });

  it('suggests the key a typo was meant to be', () => {
    expect(findUnknownInitKeys({
      subscribePop: { enable: true },
      PaneldefaultNotificationTitle: 'x',
      defaultNotificationTitel: 'x',
      android_icon: 'x',
    })).toEqual([
      { key: 'subscribePop', suggestion: 'subscribePopup' },
      { key: 'PaneldefaultNotificationTitle', suggestion: undefined },
      { key: 'defaultNotificationTitel', suggestion: 'defaultNotificationTitle' },
      { key: 'android_icon', suggestion: undefined },
    ]);
  });

  it('points at `enabled` on a widget that has no `enable`', () => {
    expect(findUnknownInitKeys({ subscribeWidget: { enabled: true }, subscribePopup: { enable: true, enabled: true } }))
      .toEqual([{ key: 'subscribeWidget.enabled', suggestion: 'subscribeWidget.enable' }]);
  });

  it('warns once per unknown key', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    warnUnknownInitKeys({ applicationCode: 'AAAAA-BBBBB', subscribeWidget: { enabled: true } });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Pushwoosh: unknown init parameter "subscribeWidget.enabled" is ignored. Did you mean "subscribeWidget.enable"?');
    warn.mockRestore();
  });
});
