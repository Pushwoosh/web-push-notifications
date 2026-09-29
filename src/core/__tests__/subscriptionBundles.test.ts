import type { IInitParams } from '../Pushwoosh.types';
import { subscriptionBundlesToLoad } from '../subscriptionBundles';

type Params = Pick<IInitParams, 'subscriptionWidget' | 'subscribeWidget' | 'subscribePopup'>;

const ALL_OLD: Params = { subscribeWidget: { enable: true }, subscribePopup: { enable: true } as IInitParams['subscribePopup'] };

describe('subscriptionBundlesToLoad', () => {
  it.each<[string, Params, boolean, boolean, string[]]>([
    ['nothing without push', { ...ALL_OLD, subscriptionWidget: { enable: true } }, false, true, []],
    ['only the unified widget when it is on', { ...ALL_OLD, subscriptionWidget: { enable: true } }, true, true, ['subscription']],
    ['the unified widget even after the permission is decided', { subscriptionWidget: { enable: true } }, true, false, ['subscription']],
    ['all three older ones in order while it is off', { ...ALL_OLD, subscriptionWidget: { enable: false } }, true, true,
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
