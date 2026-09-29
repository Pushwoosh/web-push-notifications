export interface INotificationPayloadInboxParams {
  image?: string; // custom icon for inbox message
  rt?: string; // removal time. YYYY-MM-DD HH:mm
}

export interface INotificationPayload {
  body: string; // message text
  p?: string; // message hash. Not required for send message on concrete device.
  silent?: string; // is it silent push notifications (no need to show it to user PUSH-19207)
  header?: string; // message title
  i?: string; // icon
  u?: string; // custom data json string
  md?: string; // meta data json string
  l?: string; // deep link or URL
  pwcid?: string; // campaign id
  image?: string; // chrome big image
  buttons?: string; // button json string. XMPP Chrome Sender payload contains buttons as string
  pw_inbox?: string; // inbox code
  inbox_params?: string; // inbox params json INotificationPayloadInboxParams
  [key: string]: any; // root params
}

export interface IChromeNotificationPayload {
  data: INotificationPayload;
  from: string; // ??
}

export interface INotificationButton {
  title: string;
  action?: string;
  url?: string;
}

export interface INotificationOptionsPayload {
  body: string;
  title: string;
  icon: string;
  image: string;
  buttons: Array<INotificationButton>;
  customData: { [key: string]: any };
  metaData: { [key: string]: any };
  campaignCode: string;
  openUrl: string;
  [key: string]: any;
}

export interface IShowNotificationOptionsData {
  code: string; // message code
  buttons: Array<INotificationButton>;
  image: string;
  campaignCode: string;
  inboxId: string;
}

export interface IShowNotificationOptions {
  body: string;
  icon: string;
  tag: string;
  data: IShowNotificationOptionsData;
  actions: Array<INotificationButton>;
  image: string;
  badge?: string; // android chrome badge icon,
  silent?: boolean; // is it silent push notifications (no need to show it to user PUSH-19207)
  [key: string]: any;
}
