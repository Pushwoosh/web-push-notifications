import { type INotificationButton } from '../models/NotificationPayload.types';
import { type ISubscribePopupConfig } from '../widgets/SubscribePopup/types/subscribe-popup';

export type PushwooshApiResponse = {
  status_code: number;
  status_message: string;
  response?: any;
};

export type TPWPermission = 'denied' | 'granted' | 'default';

export interface IPWDriverAPIParams {
  hwid: string;
  pushToken?: string;
  publicKey?: string;
  authToken?: string;
}

export interface TPWAPIParams extends IPWDriverAPIParams {
  applicationCode: string;
  deviceType: number;
  deviceModel: string;
  language: string;
  userId?: string;
}

export interface TPWLastOpenMessage {
  messageHash?: string;
  expiry: number;
  url?: string;
}

export interface PushManager {
  permissionState(options: PushSubscriptionOptions): Promise<TPWPermission>;
}

export interface PushSubscription {
  unsubscribe(): Promise<boolean>;
  subscriptionId: string;
}

export interface IPWDriver {
  initWorker?(): Promise<any>;
  getPermission(): Promise<TPWPermission>;
  isSubscribed(): Promise<boolean>;
  askSubscribe(eventEmitter?: any): Promise<any>;
  unsubscribe(): Promise<any>;
  getAPIParams(): Promise<IPWDriverAPIParams>;
  onApiReady?(api: any): void;
  isNeedUnsubscribe?(): Promise<boolean>;
}

export interface ITooltipText {
  successSubscribe?: string;
  needSubscribe?: string;
  blockSubscribe?: string;
  alreadySubscribed?: string;
}

export interface ISubscribeWidget {
  enable: boolean;
  position?: string;
  bgColor?: string;
  bellColor?: string;
  shadow?: string;
  size?: string;
  indent?: string;
  zIndex?: string;
  tooltipText?: ITooltipText;
  buttonImage?: string;
  contentImages?: Record<string, string>;
}

export type IWidgetPosition = 'left' | 'right' | 'top' | 'bottom';

export interface IInboxWidget {
  enable: boolean;
  triggerId?: string;
  position?: IWidgetPosition;
  appendTo?: string;
  title?: string;
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
  borderRadius?: number;
  borderColor?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  widgetWidth?: number;
  zIndex?: number;
  messageTitleColor?: string;
  timeTextColor?: string;
  emptyInboxTitle?: string;
  emptyInboxText?: string;
  emptyInboxIconUrl?: string;
  emptyInboxTitleColor?: string;
  emptyInboxTextColor?: string;
}

export interface IInitParams {
  applicationCode: string;
  apiToken?: string;
  communicationEnabled?: boolean;
  serviceWorkerUrl?: string | null;
  safariWebsitePushID?: string;
  autoSubscribe?: boolean;
  pushwooshUrl?: string;
  defaultNotificationImage?: string;
  defaultNotificationTitle?: string;
  logLevel?: string;
  userId?: string;
  email?: string;
  scope?: string;
  tags?: { [key: string]: any };
  subscribeWidget?: ISubscribeWidget;
  inboxWidget?: IInboxWidget;
  subscribePopup?: ISubscribePopupConfig;
  webSDKPath?: string;
}

export interface IInitParamsWithDefaults extends IInitParams {
  autoSubscribe: boolean;
  pushwooshUrl: string;
  deviceType: number;
  serviceWorkerUrl: string | null;
  tags: {
    Language: string;
    'Device Model': string;
    [key: string]: any;
  };
  subscribeWidget: ISubscribeWidget;
  inboxWidget: IInboxWidget;
  subscribePopup: ISubscribePopupConfig;
  hwid: string;
}

export interface IPWParams extends IInitParamsWithDefaults {
  applicationCode: string;
  apiToken?: string;
  defaultNotificationImage?: string;
  defaultNotificationTitle?: string;
  logLevel?: 'error' | 'info' | 'debug';
  safariWebsitePushID?: string;
  scope?: string;
  userId?: string;
  email?: string;
  pushwooshUrl: string;
  authToken?: string;
  hwid: string;
  publicKey?: string;
  pushToken?: string;
}

export interface INotificationOptions extends NotificationOptions {
  title: string;
  messageHash: string;
  openUrl: string;
  url?: string;
  inboxId: string;

  image?: string;
  code?: string;
  buttons?: INotificationButton[];
  customData?: { [key: string]: any };
  metaData?: { [key: string]: any };
  campaignCode?: string;
}

export type TPWCanWaitCallback = (f: any) => Promise<any> | any;

export interface IWorkerPushwooshGlobal {
  push(listener: ['onPush', TPWCanWaitCallback]): void;
  getListeners(eventName: string): TPWCanWaitCallback[];
  eventBus: any;
  api: any;
  initApi: any;
}

export interface IPWBroadcastClientsParams {
  type: string;
  payload: any;
}

export type TWriteType = 'error' | 'apirequest' | 'info';

export interface ILogger {
  setLevel(level: string): void;
  error(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
  write(type: TWriteType, message: any, additional?: any): Promise<void>;
  isManualLevel(): boolean;
  [key: string]: any;
}

export type ListenerFn = (...args: Array<any>) => void | Promise<any>;

export type HandlerFn = (api: any, params?: any) => any;

export type TWorkerDriverParams = {
  eventEmitter?: any;
  scope?: string;
  applicationCode: string;
  serviceWorkerUrl: string | null;
  applicationServerPublicKey?: string;
};

export type TWorkerSafariDriverParams = {
  eventEmitter?: any;
  applicationCode: string;
  webSitePushID: string;
  pushwooshUrl: string;
};

export type TDoPushwooshMethod = (type: string, params: any, url?: string) => Promise<any>;

export type PWInput = PushOnReadyCallback | PushInitCallback | PushEventCallback;
export type PushOnReadyCallback = HandlerFn;
export type PushInitCallback = ['init', IInitParams];
export type PushEventCallback = [PWEvent, HandlerFn];
export type PWEvent =
  | 'onLoad'
  | 'onReady'
  | 'onSubscribe'
  | 'onUnsubscribe'
  | 'onRegister'
  | 'onSWInitError'
  | 'onPermissionPrompt'
  | 'onPermissionDenied'
  | 'onPermissionGranted'
  | 'onNotificationClick'
  | 'onPushDelivery'
  | 'onNotificationClose'
  | 'onChangeCommunicationEnabled'
  | 'onPutNewMessageToInboxStore'
  | 'onUpdateInboxMessages'
  | 'onShowNotificationPermissionDialog'
  | 'onHideNotificationPermissionDialog'
  | 'onShowSubscriptionWidget'
  | 'onHideSubscriptionWidget';
