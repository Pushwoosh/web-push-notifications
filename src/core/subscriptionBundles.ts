import { Logger } from './logger';
import type { IInitParams } from './Pushwoosh.types';

export type SubscriptionBundle = 'subscription' | 'subscription-prompt' | 'subscription-button' | 'subscribe-popup';

/**
 * Subscription widget bundles to fetch, in load order. The unified widget excludes the three older
 * ones: two asks on one page would compete. 'subscription-prompt' still needs its own capping check.
 */
// Reads the two switches itself: websdk-common's helpers would pull the web-popups sanitizer into every page.
export function isUnifiedWidgetOn(widget: IInitParams['subscriptionWidget']): boolean {
  return widget?.prompt?.enabled === true || widget?.launcher?.enabled === true;
}

export function subscriptionBundlesToLoad(
  initParams: Pick<IInitParams, 'subscriptionWidget' | 'subscribeWidget' | 'subscribePopup'>,
  isPushAvailable: boolean,
  isPermissionDefault: boolean,
): SubscriptionBundle[] {
  if (!isPushAvailable) {
    return [];
  }

  if (isUnifiedWidgetOn(initParams.subscriptionWidget)) {
    return ['subscription'];
  }
  if (initParams.subscriptionWidget && 'enable' in initParams.subscriptionWidget) {
    Logger.info('Pushwoosh: subscriptionWidget.enable is no longer read, turn the widget on with prompt.enabled and launcher.enabled');
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
