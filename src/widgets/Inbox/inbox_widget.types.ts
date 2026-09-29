import { type IStyleVariable } from '../../helpers/cssVariables';

export interface TMessagesElementsType {
  [code: string]: HTMLElement;
}

export type IConfigStyles = IStyleVariable<TStylesNames>;

export type TStylesNames = 'bgColor' | 'textColor' | 'fontFamily' | 'borderRadius' | 'borderColor'
  | 'badgeBgColor' | 'badgeTextColor' | 'widgetWidth' | 'zIndex' | 'messageTitleColor' | 'timeTextColor'
  | 'emptyInboxTitleColor' | 'emptyInboxTextColor' | 'arrowBorderColor'
  | 'unreadDotColor' | 'avatarBgColor' | 'avatarTextColor' | 'avatarSize' | 'mediaRadius'
  | 'slideCaptionColor' | 'slideScrimColor' | 'pagerDotActiveColor' | 'pagerDotColor';

export type TWidgetPosition = 'left' | 'right' | 'top' | 'bottom';

export interface IInboxWidgetConfig {
  enable: boolean;
  triggerId: string;
  position: TWidgetPosition;
  appendTo: string;
  title: string;
  bgColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: number;
  borderColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  widgetWidth: number;
  zIndex: number;
  messageTitleColor: string;
  timeTextColor: string;
  emptyInboxTitle: string;
  emptyInboxText: string;
  emptyInboxIconUrl: string;
  emptyInboxTitleColor: string;
  emptyInboxTextColor: string;
  arrowBorderColor: string;

  /** Keep the pre-3.75 look of the classic cell. The new layouts are unaffected. */
  legacyClassicCell: boolean;

  // Cell layouts: classic avatar, banner/captioned hero, carousel chrome.
  unreadDotColor: string;
  avatarBgColor: string;
  avatarTextColor: string;
  avatarSize: number;
  mediaRadius: number;
  slideCaptionColor: string;
  slideScrimColor: string;
  pagerDotActiveColor: string;
  pagerDotColor: string;
}
