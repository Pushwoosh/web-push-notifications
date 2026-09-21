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

// `rawParams` is what the integrator literally passed to init, before defaultInitParams were
// merged in — otherwise a default is indistinguishable from a deliberate value and always wins.
export function resolveInitParams(rawParams: IInitParams, serverParams?: IServerInitParams): Partial<IInitParams> {
  if (!serverParams) {
    return {};
  }

  const resolved: Partial<IInitParams> = {};

  SERVER_MANAGED_KEYS.forEach((key) => {
    if (rawParams[key] === undefined && serverParams[key] !== undefined) {
      (resolved as Record<string, unknown>)[key] = serverParams[key];
    }
  });

  const subscribeWidget = resolveSubscribeWidget(rawParams.subscribeWidget, serverParams.subscribeWidget);
  if (subscribeWidget) {
    resolved.subscribeWidget = subscribeWidget;
  }

  return resolved;
}

// Merged key by key, not replaced: a panel form filling one field must not drop the other nine
// a site set in its snippet. One level deep only — tooltipText and contentImages go as a whole.
function resolveSubscribeWidget(
  rawWidget?: ISubscribeWidget,
  serverWidget?: Partial<ISubscribeWidget>,
): ISubscribeWidget | undefined {
  if (!serverWidget) {
    return undefined;
  }

  return {
    ...serverWidget,
    ...rawWidget,
  } as ISubscribeWidget;
}
