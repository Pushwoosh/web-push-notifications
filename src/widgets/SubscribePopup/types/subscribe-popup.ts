import { type IStyleVariable } from '../../../helpers/cssVariables';

export interface ISubscribePopupConfig {
  enable: boolean;
  text: string;
  askLaterButtonText: string;
  confirmSubscriptionButtonText: string;
  delay: number;
  manualToggle?: boolean;
  retryOffset: number;
  iconUrl?: string;
  iconAlt?: string;
  overlay: boolean;
  position: string;
  mobileViewMargin: string;

  bgColor: string;
  borderColor: string;
  boxShadow: string;
  textColor: string;
  textSize: string;
  textWeight: string;
  fontFamily: string;
  subscribeBtnBgColor: string;
  subscribeBtnTextColor: string;
  subscribeBtnTextWeight: string;
  subscribeBtnBorderColor: string;
  subscribeBtnBorderRadius: string;
  askLaterBtnBgColor: string;
  askLaterBtnTextColor: string;
  askLaterBtnBorderColor: string;
  askLaterBtnBorderRadius: string;
  askLaterBtnTextWeight: string;
  theme: string;
  viewport: string;
}

export type ISubscribePopupConfigStyles = IStyleVariable<SPTStylesNames>;

export type SPTStylesNames =
  | 'mobileViewMargin'
  | 'bgColor'
  | 'borderColor'
  | 'boxShadow'
  | 'textColor'
  | 'textSize'
  | 'textWeight'
  | 'fontFamily'
  | 'subscribeBtnBgColor'
  | 'subscribeBtnTextColor'
  | 'subscribeBtnTextWeight'
  | 'subscribeBtnBorderColor'
  | 'subscribeBtnBorderRadius'
  | 'askLaterBtnBgColor'
  | 'askLaterBtnTextColor'
  | 'askLaterBtnTextWeight'
  | 'askLaterBtnBorderColor'
  | 'askLaterBtnBorderRadius';
