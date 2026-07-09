// Action types
export type TInboxActionLink = 1;
export type TInboxActionRichMedia = 2;
export type TInboxActionType = TInboxActionLink | TInboxActionRichMedia; // https://docs.pushwoosh.com/platform-docs/api-reference/message-inbox#getinboxmessages

// Statuses
export type TInboxMessageStatusDelivered = 1;
export type TInboxMessageStatusRead = 2; // set on message in viewport
export type TInboxMessageStatusOpen = 3; // set on message click
export type TInboxMessageStatusDeleted = 4; // set on message delete or expiry removal time
export type TInboxMessageStatus =
  | TInboxMessageStatusDelivered
  | TInboxMessageStatusRead
  | TInboxMessageStatusOpen
  | TInboxMessageStatusDeleted;
export type TReadInboxMessagesStatusRange = [TInboxMessageStatusRead, TInboxMessageStatusOpen]; // all inbox read messages

// Message
export interface IInboxMessageActionParams {
  l?: string | null;
  rm?: string;
  h?: string;
  r?: string;
}

export interface IInboxMessage {
  inbox_id: string; // inbox message id
  order: string; // id for ordering in inbox
  rt: string; // timestamp. Remove date. UTC
  send_date: string; // timestamp. UTC
  title: string;
  image: string;
  text: string;
  action_type: TInboxActionType;
  action_params: string; // json string with IInboxMessageActionParams
  status: TInboxMessageStatus;
}

// Inbox API types
export interface IGetInboxMessagesRequest {
  application: string; // application code
  userId: string; // use hwid or other custom string if no userId
  hwid: string;
  last_code: string; // For pagination purpose. "next" parameter from response. For first request send empty string
  count?: number; // optional, default messages count on page
  last_request_time: number; // for update new messages counter. UTC
}

export interface IGetInboxMessagesResponse {
  messages: Array<IInboxMessage>;
  next: string; // pagination code
  deleted: Array<string>; // array of notifications codes deleted from cp
  new_inbox: number; // inbox messages created since last request time
}

export interface IInboxStatusRequest {
  userId: string; // use hwid or other custom string if no userId
  hwid: string; // hwid
  application: string; // app code
  inbox_code: string; // order. Ugly logic for fast development.
  time: number; // timestamp utc
  status: TInboxMessageStatus;
  hash?: string; // ??
  device_type: number; // platform type from Pushwoosh system
}

export type TGetInboxMessagesMethod = 'getInboxMessages';
export type TInboxStatusMethod = 'inboxStatus';

// IndexedDB keys/indexes
export type TInboxMessagesIDBKeyPath = 'inbox_id';
export type TInboxMessagesIDBStatusIndex = 'status';
export type TInboxMessagesIDBRemovalTimeIndex = 'rt';

// Public Interface

export type TInboxMessageTypePlain = 0;
export type TInboxMessageTypeRichmedia = 1;
export type TInboxMessageTypeURL = 2;
export type TInboxMessageTypeDeeplink = 3;
export type TInboxMessageType = // depend from action_params
  | TInboxMessageTypePlain
  | TInboxMessageTypeRichmedia
  | TInboxMessageTypeURL
  | TInboxMessageTypeDeeplink;

export type TInboxDefaultLink = '/';

export interface IInboxMessagePublic {
  code: string; // inbox_id
  title: string; // title
  message: string; // body
  imageUrl: string; // image
  sendDate: string; // send_date
  type: TInboxMessageType; // depend from action_params
  link: string | TInboxDefaultLink; // url or deeplink.
  isRead: boolean; // true if status read or open
  isActionPerformed: boolean; // true if status open
}

export interface IInboxMessages {
  messagesWithNoActionPerformedCount(): Promise<number>; // opened messages count
  unreadMessagesCount(): Promise<number>; // read messages count
  messagesCount(): Promise<number>; // all messages count
  loadMessages(): Promise<Array<IInboxMessagePublic>>; // all messages
  readMessagesWithCodes(codes: Array<string>): Promise<void>; // set read status to messages by code
  performActionForMessageWithCode(code: string): Promise<void>; // call message action. Set open status to messages
  deleteMessagesWithCodes(codes: Array<string>): Promise<void>; // Set delete status to messages by code

  publicMessageBuilder(message: IInboxMessage): Promise<IInboxMessagePublic>; // build public inbox message from base inbox message
}
