import type { IInboxWidget, IInitParams, ISubscribeWidget } from './Pushwoosh.types';
import type { ISubscribePopupConfig } from '../widgets/SubscribePopup/types/subscribe-popup';
import type { ISubscriptionWidgetParams } from '../widgets/SubscriptionWidget/types';
import type { IWebPopupsConfig } from '../widgets/WebPopups/types';

export interface IServerInitParams {
  autoSubscribe?: boolean;
  defaultNotificationTitle?: string;
  defaultNotificationImage?: string;
  safariWebsitePushID?: string;
  unifiedPlatform?: boolean;
  subscribeWidget?: Partial<ISubscribeWidget>;
  subscriptionWidget?: ISubscriptionWidgetParams;
  inboxWidget?: Partial<IInboxWidget>;
  webPopups?: Pick<IWebPopupsConfig, 'enable'>;
}

const SERVER_MANAGED_KEYS = [
  'autoSubscribe',
  'defaultNotificationTitle',
  'defaultNotificationImage',
  'safariWebsitePushID',
  'unifiedPlatform',
  'subscriptionWidget',
] as const;

export type IServerModules = Pick<IServerInitParams, 'inboxWidget' | 'webPopups'>;

// `web_sdk` comes only to panel-managed apps, `web_sdk_modules` only to legacy ones: a legacy app gets the
// modules alone, so a stray key there cannot switch on settings the snippet owns.
export function serverInitParams(features?: { web_sdk?: IServerInitParams; web_sdk_modules?: IServerModules }): IServerInitParams | undefined {
  if (features?.web_sdk !== undefined) {
    return features.web_sdk;
  }

  const modules = features?.web_sdk_modules;
  if (modules === undefined) {
    return undefined;
  }

  return { inboxWidget: modules.inboxWidget, webPopups: modules.webPopups };
}

// A site moves to panel-managed settings by flipping the mode, not by editing its snippet, so a
// value saved in the panel overrides the one in init; keys absent from the config are left alone.
export function resolveInitParams(rawParams: IInitParams, serverParams?: IServerInitParams): Partial<IInitParams> {
  if (!serverParams) {
    return {};
  }

  const resolved: Partial<IInitParams> = {};

  SERVER_MANAGED_KEYS.forEach((key) => {
    if (serverParams[key] !== undefined) {
      (resolved as Record<string, unknown>)[key] = serverParams[key];
    }
  });

  // The trigger element and appendTo are the site's markup, so a snippet value the panel lacks survives.
  if (serverParams.inboxWidget !== undefined) {
    resolved.inboxWidget = { ...rawParams.inboxWidget, ...serverParams.inboxWidget } as IInboxWidget;
  }

  // The panel only carries the switch; colorScheme and autoShow stay as the snippet set them.
  if (serverParams.webPopups !== undefined) {
    resolved.webPopups = { ...rawParams.webPopups, ...serverParams.webPopups };
  }

  // A panel-saved unified widget owns subscription UI even while off: the panel has no controls for
  // the older widgets, so a bell or popup from the snippet would resurface with nothing to hide it.
  if (serverParams.subscriptionWidget !== undefined) {
    const subscribeWidget = resolveSubscribeWidget(rawParams.subscribeWidget, serverParams.subscribeWidget) ?? rawParams.subscribeWidget;
    resolved.subscribeWidget = { ...subscribeWidget, enable: false };
    resolved.subscribePopup = { ...rawParams.subscribePopup, enable: false } as ISubscribePopupConfig;
    return resolved;
  }

  const subscribeWidget = resolveSubscribeWidget(rawParams.subscribeWidget, serverParams.subscribeWidget);
  if (subscribeWidget) {
    resolved.subscribeWidget = subscribeWidget;
  }

  return resolved;
}

// Merged key by key, not replaced: the panel owns the keys it carries, the snippet keeps the rest.
// One level deep only — tooltipText and contentImages go as a whole.
function resolveSubscribeWidget(
  rawWidget?: ISubscribeWidget,
  serverWidget?: Partial<ISubscribeWidget>,
): ISubscribeWidget | undefined {
  if (!serverWidget) {
    return undefined;
  }

  return {
    ...rawWidget,
    ...serverWidget,
  } as ISubscribeWidget;
}
