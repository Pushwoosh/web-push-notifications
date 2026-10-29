import {
  INBOX_WIDGET_DEFAULT_APPEARANCE, INBOX_WIDGET_STYLE_PREFIX, INBOX_WIDGET_STYLE_VARIABLES,
} from '@pushwoosh/websdk-common/inbox';

import { type IConfigStyles, type IInboxWidgetConfig, type TStylesNames } from './inbox_widget.types';

/** Shortest gap between two server refreshes triggered by opening the widget. */
export const SYNC_INTERVAL = 30 * 1000;

export const STYLE_PREFIX = INBOX_WIDGET_STYLE_PREFIX;

export const CONFIG_STYLES: Array<IConfigStyles> = [...INBOX_WIDGET_STYLE_VARIABLES];

// The trigger is the customer's own element, outside the widget root, so the
// badge rules need their variables set on it too.
const TRIGGER_STYLE_NAMES: Array<TStylesNames> = ['badgeBgColor', 'badgeTextColor'];

export const TRIGGER_CONFIG_STYLES: Array<IConfigStyles> = CONFIG_STYLES
  .filter((style) => TRIGGER_STYLE_NAMES.indexOf(style.name) !== -1);

export const DEFAULT_CONFIG: IInboxWidgetConfig = {
  enable: false,
  triggerId: 'pwInbox',
  position: 'bottom',
  appendTo: 'body',
  ...INBOX_WIDGET_DEFAULT_APPEARANCE,
};
