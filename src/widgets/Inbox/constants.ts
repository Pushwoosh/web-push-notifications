import { type IConfigStyles, type IInboxWidgetConfig } from './inbox_widget.types';

export const MILLISECONDS_IN_DAY = 60 * 60 * 24 * 1000;
export const MILLISECONDS_IN_HOUR = 60 * 60 * 1000;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

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
];

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
};

export const COLOR_TEST_REGEXP = /^(#([\da-f]{3}){1,2}$|(rgb|hsl)a\((\d{1,3}%?,\s?){3}(1|0?\.\d+)\)$|(rgb|hsl)\(\d{1,3}%?(,\s?\d{1,3}%?){2}\)$)/;
