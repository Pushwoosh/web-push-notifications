import { type IConfigStyles, type IInboxWidgetConfig, type TStylesNames } from './inbox_widget.types';

/** Shortest gap between two server refreshes triggered by opening the widget. */
export const SYNC_INTERVAL = 30 * 1000;

export const MILLISECONDS_IN_DAY = 60 * 60 * 24 * 1000;
export const MILLISECONDS_IN_HOUR = 60 * 60 * 1000;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

export const STYLE_PREFIX = 'pw-inbox';

export const CONFIG_STYLES: Array<IConfigStyles> = [
  { name: 'widgetWidth', type: 'size' },
  { name: 'borderRadius', type: 'size' },
  { name: 'zIndex', type: 'number' },
  { name: 'fontFamily', type: 'string' },
  { name: 'bgColor', type: 'color' },
  { name: 'textColor', type: 'color' },
  { name: 'arrowBorderColor', type: 'color' },
  { name: 'borderColor', type: 'color' },
  { name: 'badgeBgColor', type: 'color' },
  { name: 'badgeTextColor', type: 'color' },
  { name: 'timeTextColor', type: 'color' },
  { name: 'messageTitleColor', type: 'color' },
  { name: 'emptyInboxTitleColor', type: 'color' },
  { name: 'emptyInboxTextColor', type: 'color' },
  { name: 'unreadDotColor', type: 'color' },
  { name: 'avatarBgColor', type: 'color' },
  { name: 'avatarTextColor', type: 'color' },
  { name: 'avatarSize', type: 'size' },
  { name: 'mediaRadius', type: 'size' },
  { name: 'slideCaptionColor', type: 'color' },
  { name: 'slideScrimColor', type: 'color' },
  { name: 'pagerDotActiveColor', type: 'color' },
  { name: 'pagerDotColor', type: 'color' },
];

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
  title: 'Inbox',
  bgColor: '#ffffff',
  textColor: '#333333',
  fontFamily: 'inherit',
  borderRadius: 4,
  borderColor: 'transparent',
  badgeBgColor: '#ff4c00',
  badgeTextColor: '#ffffff',
  widgetWidth: 350,
  zIndex: 100,
  messageTitleColor: '#7a7a7a',
  timeTextColor: '#c4c4c4',
  emptyInboxTitle: 'You\'re all caught up',
  emptyInboxTitleColor: '#333333',
  emptyInboxText: 'There are no new messages. Stay tuned!',
  emptyInboxTextColor: '#7a7a7a',
  emptyInboxIconUrl: 'https://pushon.pushwoosh.com/static/icon-empty-inbox.png',
  arrowBorderColor: 'rgba(0,0,0,.1)',
  legacyClassicCell: false,

  // Defaults mirror the control panel preview (dumb-components `InboxPreview`),
  // so a cell looks here the way the campaign editor promised it would.
  unreadDotColor: '#00a2ff', // Color.BRIGHT
  avatarBgColor: '#c4c8cc', // Color.PHANTOM
  avatarTextColor: '#4b5057', // Color.MAIN
  avatarSize: 52,
  mediaRadius: 8, // ShapeRadius.SECTION
  slideCaptionColor: '#ffffff', // Color.CLEAR
  slideScrimColor: 'rgba(0,0,0,.45)',
  pagerDotActiveColor: '#00a2ff', // Color.BRIGHT
  pagerDotColor: '#ebf0f5', // Color.DIVIDER
};
