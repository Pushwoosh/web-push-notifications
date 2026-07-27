import { type TPlatform } from '../PlatformChecker/PlatformChecker.types';

export interface SetPurchaseAttributes {
  transactionDate: string;
  quantity: number;
  currency: string;
  productIdentifier: string;
  price: number;
}

export type TTagOperationSet = 0; // Set tag value
export type TTagOperationAppend = 1; // Append to tag value
export type TTagOperationRemove = 2; // Remove tag value
export type TTagOperationIncrement = 3; // Increment tag value
export type TTagOperation = TTagOperationSet | TTagOperationAppend | TTagOperationRemove | TTagOperationIncrement;

export interface TagValue {
  operation: TTagOperation;
  value?: string;
  values?: string[]; // for operation with lists
}

export interface WebPushPlatformData {
  public_key?: string;
  auth_token?: string;
  browser?: string;
}

export interface PushDevice {
  hwid: string;
  platform: TPlatform;
  push_token?: string;
  app_version?: string;
  os_version?: string;
  sdk_version?: string;
  platformData?: WebPushPlatformData;
}

export interface MultiRegisterDeviceRequest {
  user_id?: string;
  application: string;
  email?: string;
  sms_phone_number?: string;
  whatsapp_phone_number?: string;
  kakao_phone_number?: string;
  line_token?: string;
  telegram_user_id?: string;
  language?: string;
  timezone?: string;
  city?: string;
  country?: string;
  state?: string;
  tags?: { [key: string]: TagValue };
  push_devices?: PushDevice[];
}
