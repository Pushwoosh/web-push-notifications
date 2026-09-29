import { render } from 'preact';

import {
  SubscriptionWidgetReader, type SubscriptionWidgetReaderProps,
} from '@pushwoosh/websdk-common/subscription-widget';

export const renderSubscriptionWidget = (container: HTMLElement, props: SubscriptionWidgetReaderProps): void => {
  render(<SubscriptionWidgetReader {...props} mode="live" />, container);
};

export const unmountSubscriptionWidget = (container: HTMLElement): void => {
  render(null, container);
};
