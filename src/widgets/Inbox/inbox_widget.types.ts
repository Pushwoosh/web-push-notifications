export interface TMessagesElementsType {
  [code: string]: HTMLElement;
}

export interface IConfigStyles {
  name: TStylesNames;
  type: TStylesTypes;
}

export type TStylesNames = 'bgColor' | 'textColor' | 'fontFamily' | 'borderRadius' | 'borderColor'
  | 'badgeBgColor' | 'badgeTextColor' | 'widgetWidth' | 'zIndex' | 'messageTitleColor' | 'timeTextColor'
  | 'emptyInboxTitleColor' | 'emptyInboxTextColor' | 'arrowBorderColor';

export type TStylesTypes = 'number' | 'color' | 'string' | 'size';

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
}
