import { type IInboxMessage } from '../../models/InboxMessages.types';

type TMethodCheckDevice = 'checkDevice';
type TMethodGetConfig = 'getConfig';
type TMethodApplicationOpen = 'applicationOpen';
type TMethodRegisterDevice = 'registerDevice';
type TMethodUnregisterDevice = 'unregisterDevice';
type TMethodDeleteDevice = 'deleteDevice';
type TMethodMessageDeliveryEvent = 'messageDeliveryEvent';
type TMethodPushStat = 'pushStat';
type TMethodSetTags = 'setTags';
type TMethodGetTags = 'getTags';
type TMethodRegisterUser = 'registerUser';
type TMethodRegisterEmail = 'registerEmail';
type TMethodRegisterEmailUser = 'registerEmailUser';
type TMethodRegisterSmsNumber = 'registerSmsNumber';
type TMethodRegisterWhatsappNumber = 'registerWhatsappNumber';
type TMethodSetEmailTags = 'setEmailTags';
type TMethodPostEvent = 'postEvent';
type TMethodGetInboxMessages = 'getInboxMessages';
type TMethodInboxStatus = 'inboxStatus';
type TMethodPageVisit = 'pageVisit';
type TMethodSetPurchase = 'setPurchase';

export interface IRequest {
  application: string; // Pushwoosh application code.
  hwid: string; // Unique string to identify the device.
  userId: string; // The user ID to associate with event.
  device_type: number; // 10 - safari, 11 - chrome, 12 - firefox.
  device_model?: string; // browser version.
  timezone?: number; // Timezone offset in seconds for the device.
  language?: string; // Language locale of the device. Must be a lowercase two-letter code according to ISO-639-1 standard.
  v?: string; // Web SDK version.
}

export interface IRequestEmail extends Omit<IRequest, 'hwid' | 'device_type'> {
  email: string;
}

export interface IRequestSmsNumber extends Omit<IRequest, 'hwid' | 'device_type'> {
  number: string;
}

export interface IRequestWhatsappNumber extends Omit<IRequest, 'hwid' | 'device_type'> {
  number: string;
}

interface IRequestGetConfig extends IRequest {
  features: string[]; // array of features names.
}

interface IRequestRegisterDevice extends IRequest {
  push_token?: string; // Push token for the device.
  public_key?: string;
  auth_token?: string;
}

interface IRequestRegisterUser extends IRequest {
  ts_offset: number; // Timezone offset in seconds for the device. (aka timezone).
}

interface IRequestRegisterEmail extends IRequestEmail {
  tags?: { [key: string]: any }; // email tags
  ts_offset: number; // Timezone offset in seconds for the device. (aka timezone).
}

interface IRequestRegisterEmailUser extends IRequestEmail {
  ts_offset: number; // Timezone offset in seconds for the device. (aka timezone).
}

interface IRequestRegisterSmsNumber extends IRequestSmsNumber {
  ts_offset: number; // Timezone offset in seconds for the device. (aka timezone).
}

interface IRequestRegisterWhatsappNumber extends IRequestWhatsappNumber {
  ts_offset: number; // Timezone offset in seconds for the device. (aka timezone).
}

interface IRequestSetEmailTags extends IRequestEmail {
  tags: { [key: string]: any }; // email tags
}

interface IRequestPostEvent extends IRequest {
  event: string; // Event name.
  attributes?: { [key: string]: any };
  timestampUTC?: number; // Timestamp in UTC.
  timestampCurrent?: number; // Timestamp in local time.
}

interface IRequestMessageDeliveryEvent extends IRequest {
  hash: string; // message hash,
  metaData: { [key: string]: any }; // meta data
}

interface IRequestPushStat extends IRequest {
  hash: string; // message hash
  metaData: { [key: string]: any }; // meta data
}

interface IRequestSetTags extends IRequest {
  tags: {
    [key: string]: any;
  };
}

interface IRequestGetInboxMessages extends IRequest {
  userId: string; // use hwid or other custom string if no userId
  last_code: string; // For pagination purpose. "next" parameter from response. For first request send empty string
  count?: number; // optional, default messages count on page
  last_request_time: number; // for update new messages counter. UTC
}

interface IRequestInboxStatus extends IRequest {
  userId: string; // use hwid or other custom string if no userId
  inbox_code: string; // order. Ugly logic for fast development.
  time: number; // timestamp utc
  status: number;
  hash?: string; // ??
  device_type: number; // platform type from Pushwoosh system
}

interface IRequestPageVisit extends IRequest {
  title: string;
  url_path: string;
  url: string;
}

interface IRequestSetPurchase extends IRequest {
  transactionDate: string;
  quantity: number;
  currency: string;
  productIdentifier: string;
  price: number;
}

type IResponse = void;

interface IResponseCheckDevice {
  exist: boolean; // exist device token
  push_token_exist: boolean; // exist push token
}

interface IResponseGetConfig {
  features: {
    page_visit?: {
      entrypoint: string;
      enabled: boolean;
    };
    vapid_key?: string;
    web_in_apps?: {
      enabled: boolean;
    };
    events?: string[];
    subscription_prompt?: {
      useCase: 'not-set' | 'default' | 'not-used';
    };
  };
}

interface IResponseGetTags {
  result: {
    [key: string]: any;
  };
}

interface IResponsePostEvent {
  code?: string;
}

interface IResponseGetInboxMessages {
  messages: Array<IInboxMessage>;
  next: string; // pagination code
  deleted: Array<string>; // array of notifications codes deleted from cp
  new_inbox: number; // inbox messages created since last request time
}

export type TMethod =
  | TMethodCheckDevice
  | TMethodGetConfig
  | TMethodApplicationOpen
  | TMethodRegisterDevice
  | TMethodUnregisterDevice
  | TMethodDeleteDevice
  | TMethodMessageDeliveryEvent
  | TMethodPushStat
  | TMethodSetTags
  | TMethodGetTags
  | TMethodRegisterUser
  | TMethodRegisterEmail
  | TMethodRegisterEmailUser
  | TMethodRegisterSmsNumber
  | TMethodRegisterWhatsappNumber
  | TMethodSetEmailTags
  | TMethodPostEvent
  | TMethodGetInboxMessages
  | TMethodInboxStatus
  | TMethodPageVisit
  | TMethodSetPurchase;

export interface IMapRequest {
  checkDevice: IRequest;
  getConfig: IRequestGetConfig;
  applicationOpen: IRequest;
  registerDevice: IRequestRegisterDevice;
  unregisterDevice: IRequest;
  deleteDevice: IRequest;
  messageDeliveryEvent: IRequestMessageDeliveryEvent;
  pushStat: IRequestPushStat;
  setTags: IRequestSetTags;
  getTags: IRequest;
  registerUser: IRequestRegisterUser;
  registerEmail: IRequestRegisterEmail;
  registerEmailUser: IRequestRegisterEmailUser;
  registerSmsNumber: IRequestRegisterSmsNumber;
  registerWhatsappNumber: IRequestRegisterWhatsappNumber;
  setEmailTags: IRequestSetEmailTags;
  postEvent: IRequestPostEvent;
  getInboxMessages: IRequestGetInboxMessages;
  inboxStatus: IRequestInboxStatus;
  pageVisit: IRequestPageVisit;
  setPurchase: IRequestSetPurchase;
}

export interface IMapResponse {
  checkDevice: IResponseCheckDevice;
  getConfig: IResponseGetConfig;
  applicationOpen: IRequest;
  registerDevice: IResponse;
  unregisterDevice: IResponse;
  deleteDevice: IResponse;
  messageDeliveryEvent: IResponse;
  pushStat: IResponse;
  setTags: IResponse;
  getTags: IResponseGetTags;
  registerUser: IResponse;
  registerEmail: IResponse;
  registerEmailUser: IResponse;
  registerSmsNumber: IResponse;
  registerWhatsappNumber: IResponse;
  setEmailTags: IResponse;
  postEvent: IResponsePostEvent;
  getInboxMessages: IResponseGetInboxMessages;
  inboxStatus: IResponse;
  pageVisit: IResponse;
  setPurchase: IResponse;
}
