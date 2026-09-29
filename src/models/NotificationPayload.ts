import { type IInboxMessage, type TInboxActionLink, type TInboxMessageStatusDelivered } from './InboxMessages.types';
import {
  type IChromeNotificationPayload,
  type INotificationButton,
  type INotificationOptionsPayload,
  type INotificationPayload,
  type INotificationPayloadInboxParams,
  type IShowNotificationOptions,
} from './NotificationPayload.types';
import { parseSerializedNotificationParams } from '../core/functions';
import { unescape } from '../helpers/unescape';
import { Data } from '../modules/Data/Data';
import DateModule from '../modules/DateModule';

/**
 * Build notification payload for different usage (show notification, use in sdk, inbox messages)
 */
export default class NotificationPayload {
  payload: INotificationPayload;
  data: Data;
  code: string;
  dateModule: DateModule;

  constructor(
    payload: INotificationPayload | IChromeNotificationPayload,
    data: Data = new Data(),
    dateModule: DateModule = new DateModule(),
  ) {
    // Set payload
    if ('data' in payload) {
      const chromePayload = <IChromeNotificationPayload>payload;
      this.payload = chromePayload.data;
    } else {
      this.payload = <INotificationPayload>payload;
    }

    this.data = data;
    this.code = `notificationCode-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    this.dateModule = dateModule;
  }

  async getIcon(): Promise<string> {
    return this.payload.i || await this.data.getDefaultNotificationImage();
  }

  async getTitle(): Promise<string> {
    return this.payload.header || await this.data.getDefaultNotificationTitle();
  }

  get silent(): boolean {
    return Boolean(this.payload.silent);
  }

  get body(): string {
    return this.payload.body;
  }

  get messageHash(): string {
    return this.payload.p || '';
  }

  get metaData(): { [key: string]: any } {
    return this.payload.md
      ? parseSerializedNotificationParams(this.payload.md)
      : {};
  }

  get image(): string {
    return this.payload.image || '';
  }

  get buttons(): Array<INotificationButton> {
    return this.payload.buttons
      ? parseSerializedNotificationParams(this.payload.buttons)
      : [];
  }

  get customData(): { [key: string]: any } {
    return this.payload.u
      ? parseSerializedNotificationParams(this.payload.u)
      : {};
  }

  get campaignCode(): string {
    return this.payload.pwcid || '';
  }

  get link(): string {
    return this.payload.l ? unescape(this.payload.l) : '/';
  }

  get inboxId(): string {
    return this.payload.pw_inbox || '';
  }

  get inboxParams(): INotificationPayloadInboxParams {
    // Parse inbox params
    if (this.payload.inbox_params) {
      return parseSerializedNotificationParams(this.payload.inbox_params);
    }

    return {};
  }

  get inboxRemovalTime(): string {
    if (this.inboxParams && this.inboxParams.rt) {
      return this.inboxParams.rt;
    }

    this.dateModule.date = new Date();
    this.dateModule.addDays(1); // one day removal time
    return this.dateModule.getUtcTimestamp().toString();
  }

  async getInboxImage(): Promise<string> {
    if (this.inboxParams && this.inboxParams.image) {
      return this.inboxParams.image;
    }

    return '';
  }

  get rootParams(): { [key: string]: any } {
    const {
      body: _body,
      p: _p,
      header: _header,
      i: _i,
      u: _u,
      l: _l,
      pwcid: _pwcid,
      image: _image,
      buttons: _buttons,
      pw_inbox: _pw_inbox,
      inbox_params: _inbox_params,
      ...rootParams
    } = this.payload;
    return rootParams;
  }

  async getNotificationOptionsPayload(): Promise<INotificationOptionsPayload> {
    const title = await this.getTitle();
    const icon = await this.getIcon();

    return {
      ...this.rootParams,
      body: this.body,
      title,
      icon,
      image: this.image,
      buttons: this.buttons,
      customData: this.customData,
      metaData: this.metaData,
      campaignCode: this.campaignCode,
      openUrl: this.link,
      messageHash: this.messageHash,
    };
  }

  async getShowNotificationOptions(): Promise<IShowNotificationOptions> {
    const icon = await this.getIcon();

    const buttons = this.buttons.map((button: INotificationButton, key: number) => {
      button.action = `action-${key}`;
      return button;
    });

    return {
      renotify: true,
      ...this.rootParams,
      body: this.body,
      icon,
      tag: JSON.stringify({
        url: this.link,
        messageHash: this.messageHash,
        customData: this.customData,
        metaData: this.metaData,
      }),
      data: {
        code: this.code,
        buttons,
        image: this.image,
        campaignCode: this.campaignCode,
        inboxId: this.inboxId,
      },
      silent: this.silent,
      actions: buttons,
      image: this.image,
      buttons, // old notification api artifact
    };
  }

  async getInboxMessage(): Promise<IInboxMessage> {
    this.dateModule.date = new Date();
    const sendDate = this.dateModule.getTimestamp().toString();
    const title = this.payload.header || '';
    const image = await this.getInboxImage();
    const actionType: TInboxActionLink = 1;
    const status: TInboxMessageStatusDelivered = 1;

    return {
      title,
      image,
      status,
      order: this.dateModule.getInboxFakeOrder(),
      inbox_id: this.inboxId,
      send_date: sendDate,
      rt: this.inboxRemovalTime,
      text: this.body,
      action_type: actionType,
      action_params: JSON.stringify({
        l: this.link,
      }),
    };
  }
}
