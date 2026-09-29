import {
  type InboxWidgetAppearance, type InboxWidgetPosition, type InboxWidgetStyleName,
} from '@pushwoosh/websdk-common/inbox';

import { type IStyleVariable } from '../../helpers/cssVariables';

export interface TMessagesElementsType {
  [code: string]: HTMLElement;
}

export type IConfigStyles = IStyleVariable<TStylesNames>;

export type TStylesNames = InboxWidgetStyleName;

export type TWidgetPosition = InboxWidgetPosition;

export interface IInboxWidgetConfig extends InboxWidgetAppearance {
  enable: boolean;
  triggerId: string;
  position: TWidgetPosition;
  appendTo: string;
}
