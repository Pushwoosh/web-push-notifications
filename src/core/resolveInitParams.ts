import type { IInitParams, ISubscribeWidget } from './Pushwoosh.types';

export interface IServerInitParams {
  autoSubscribe?: boolean;
  defaultNotificationTitle?: string;
  defaultNotificationImage?: string;
  safariWebsitePushID?: string;
  subscribeWidget?: Partial<ISubscribeWidget>;
}

const SERVER_MANAGED_KEYS = [
  'autoSubscribe',
  'defaultNotificationTitle',
  'defaultNotificationImage',
  'safariWebsitePushID',
] as const;

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
