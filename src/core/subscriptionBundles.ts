import type { IInitParams } from './Pushwoosh.types';

export type SubscriptionBundle = 'subscription' | 'subscription-prompt' | 'subscription-button' | 'subscribe-popup';

/**
 * Subscription widget bundles to fetch, in load order. The unified widget excludes the three older
 * ones: two asks on one page would compete. 'subscription-prompt' still needs its own capping check.
 */
export function subscriptionBundlesToLoad(
  initParams: Pick<IInitParams, 'subscriptionWidget' | 'subscribeWidget' | 'subscribePopup'>,
  isPushAvailable: boolean,
  isPermissionDefault: boolean,
): SubscriptionBundle[] {
  if (!isPushAvailable) {
    return [];
  }

  if (initParams.subscriptionWidget?.enable === true) {
    return ['subscription'];
  }

  const bundles: SubscriptionBundle[] = [];

  if (isPermissionDefault) {
    bundles.push('subscription-prompt');
  }
  if (initParams.subscribeWidget?.enable) {
    bundles.push('subscription-button');
  }
  if (initParams.subscribePopup?.enable) {
    bundles.push('subscribe-popup');
  }

  return bundles;
}
