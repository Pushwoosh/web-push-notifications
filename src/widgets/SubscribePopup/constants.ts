import { type ISubscribePopupConfig, type ISubscribePopupConfigStyles } from './types/subscribe-popup';

export const DEFAULT_CONFIG: ISubscribePopupConfig = {
  enable: true,
  text: 'Don’t miss out on our news and updates! Enable push notifications',
  askLaterButtonText: 'Not now',
  confirmSubscriptionButtonText: 'Subscribe',
  delay: 5,
  retryOffset: 60 * 60 * 24 * 7,
  overlay: false,
  position: 'top',
  mobileViewMargin: '0',

  bgColor: '#fff',
  borderColor: 'transparent',
  boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',

  textColor: '#000',
  textSize: 'inherit',
  textWeight: 'normal',
  fontFamily: 'inherit',

  subscribeBtnBgColor: '#4285f4',
  subscribeBtnTextColor: '#fff',
  subscribeBtnTextWeight: 'normal',
  subscribeBtnBorderColor: 'transparent',
  subscribeBtnBorderRadius: '2px',

  askLaterBtnBgColor: 'transparent',
  askLaterBtnTextColor: '#000',
  askLaterBtnTextWeight: 'normal',
  askLaterBtnBorderColor: 'transparent',
  askLaterBtnBorderRadius: '2px',

  theme: 'material',
  viewport: 'html',
};

export const COLOR_TEST_REGEXP = /^(#([\da-f]{3}){1,2}$|(rgb|hsl)a\((\d{1,3}%?,\s?){3}(1|0?\.\d+)\)$|(rgb|hsl)\(\d{1,3}%?(,\s?\d{1,3}%?){2}\)$)/i;

// Permissions
export const PERMISSION_DENIED = 'denied';
export const PERMISSION_GRANTED = 'granted';

export const CONFIG_STYLES: Array<ISubscribePopupConfigStyles> = [
  { name: 'mobileViewMargin', type: 'string' },
  { name: 'mobileViewPosition', type: 'string' },
  { name: 'mobileViewTransition', type: 'string' },
  { name: 'bgColor', type: 'color' },
  { name: 'borderColor', type: 'color' },
  { name: 'boxShadow', type: 'string' },
  { name: 'textColor', type: 'color' },
  { name: 'textSize', type: 'string' },
  { name: 'textWeight', type: 'string' },
  { name: 'fontFamily', type: 'string' },
  { name: 'subscribeBtnBgColor', type: 'color' },
  { name: 'subscribeBtnTextColor', type: 'color' },
  { name: 'subscribeBtnTextWeight', type: 'string' },
  { name: 'subscribeBtnBorderColor', type: 'color' },
  { name: 'subscribeBtnBorderRadius', type: 'string' },
  { name: 'askLaterBtnBgColor', type: 'color' },
  { name: 'askLaterBtnTextColor', type: 'color' },
  { name: 'askLaterBtnTextWeight', type: 'string' },
  { name: 'askLaterBtnBorderColor', type: 'color' },
  { name: 'askLaterBtnBorderRadius', type: 'string' },
];
