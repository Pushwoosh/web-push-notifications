import { type SubscriptionWidgetConfig } from '@pushwoosh/websdk-common/subscription-widget';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** `subscriptionWidget` init param: any subset of the widget config, the rest takes the defaults. */
export type ISubscriptionWidgetParams = DeepPartial<SubscriptionWidgetConfig>;

/** Published as `Pushwoosh.moduleRegistry.subscriptionWidget` once the widget bundle has loaded. */
export interface ISubscriptionWidgetPublicApi {
  show(): void;
  hide(): void;
  toggle(isShown?: boolean): void;
  isVisible(): boolean;
}
