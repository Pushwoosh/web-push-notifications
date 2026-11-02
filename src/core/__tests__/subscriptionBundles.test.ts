import { Logger } from '../logger';
import type { IInitParams } from '../Pushwoosh.types';
import { isUnifiedWidgetOn, subscriptionBundlesToLoad } from '../subscriptionBundles';

type Params = Pick<IInitParams, 'subscriptionWidget' | 'subscribeWidget' | 'subscribePopup'>;

const ALL_OLD: Params = { subscribeWidget: { enable: true }, subscribePopup: { enable: true } as IInitParams['subscribePopup'] };

describe('subscriptionBundlesToLoad', () => {
  it.each<[string, Params, boolean, boolean, string[]]>([
    ['nothing without push', { ...ALL_OLD, subscriptionWidget: { prompt: { enabled: true } } }, false, true, []],
    ['only the unified widget when it is on', { ...ALL_OLD, subscriptionWidget: { prompt: { enabled: true } } }, true, true, ['subscription']],
    ['the unified widget even after the permission is decided', { subscriptionWidget: { prompt: { enabled: true } } }, true, false, ['subscription']],
    ['all three older ones in order while it is off', { ...ALL_OLD, subscriptionWidget: { prompt: { enabled: false } } }, true, true,
      ['subscription-prompt', 'subscription-button', 'subscribe-popup']],
    ['the older ones when it is absent', ALL_OLD, true, true, ['subscription-prompt', 'subscription-button', 'subscribe-popup']],
    ['no prompt once the permission is decided', ALL_OLD, true, false, ['subscription-button', 'subscribe-popup']],
    ['just the prompt with nothing enabled', {}, true, true, ['subscription-prompt']],
    ['nothing with nothing enabled and the permission decided', {}, true, false, []],
    ['the bell alone', { subscribeWidget: { enable: true } }, true, false, ['subscription-button']],
  ])('%s', (_, params, isPushAvailable, isPermissionDefault, expected) => {
    expect(subscriptionBundlesToLoad(params, isPushAvailable, isPermissionDefault)).toEqual(expected);
  });
});

describe('the retired enable switch', () => {
  it('tells the site owner which switches replaced it and falls back to the older widgets', () => {
    const info = jest.spyOn(Logger, 'info').mockImplementation(() => undefined);
    const widget = { enable: true } as unknown as IInitParams['subscriptionWidget'];

    expect(subscriptionBundlesToLoad({ ...ALL_OLD, subscriptionWidget: widget }, true, true))
      .toEqual(['subscription-prompt', 'subscription-button', 'subscribe-popup']);
    expect(info).toHaveBeenCalledWith(expect.stringContaining('prompt.enabled and launcher.enabled'));
    info.mockRestore();
  });
});

describe('isUnifiedWidgetOn', () => {
  it.each<[string, IInitParams['subscriptionWidget'], boolean]>([
    ['absent', undefined, false],
    ['bell only', { prompt: { enabled: false }, launcher: { enabled: true } }, true],
    ['prompt only', { prompt: { enabled: true } }, true],
    ['both off', { prompt: { enabled: false }, launcher: { enabled: false } }, false],
  ])('%s', (_, widget, expected) => {
    expect(isUnifiedWidgetOn(widget)).toBe(expected);
  });
});
