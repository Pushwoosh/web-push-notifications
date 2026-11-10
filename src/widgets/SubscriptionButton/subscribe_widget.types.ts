export type TBellPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export type TTooltipText = {
  successSubscribe: string;
  needSubscribe: string;
  blockSubscribe: string;
  alreadySubscribed: string;
};
export type TBellConfig = {
  position: TBellPosition;
  bgColor: string;
  bellColor: string;
  bellStrokeColor: string;
  bellButtonBorder: string;
  shadow: string;
  size: string;
  indent: string; // edge indent
  zIndex: string;
  tooltipText: TTooltipText;
  buttonImage?: string;
  contentImages?: Record<string, string>;
};

export type TPositionStyles = {
  top: string;
  bottom: string;
  left: string;
  right: string;
};

export type TEvent = {
  event_id: number | string;
  application: string;
};

export type TStyleKeys = 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'zIndex'
  | 'position'
  | 'backgroundColor'
  | 'background'
  | 'width'
  | 'height'
  | 'boxShadow'
  | 'lineHeight'
  | 'border'
  | 'maxWidth'
  | 'maxHeight';
export type TCSSStylesObject = {
  [style: string]: string;
};
