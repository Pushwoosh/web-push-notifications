import { type Api } from './Api/Api';
import { type Data } from './Data/Data';
import DateModule from './DateModule';
import { Logger } from '../core/logger';
import { type IModuleRegistry } from '../core/Pushwoosh.types';
import { isSafeUrl } from '../helpers/url';
import {
  getCustomData,
  getHeroUrl,
  getIconUrl,
  getValidSlides,
  parseUserData,
  resolveInboxLayout,
} from '../models/InboxCell';
import { type default as InboxMessagesModel } from '../models/InboxMessages';
import {
  type IInboxMessage,
  type IInboxMessageActionParams,
  type IInboxMessagePublic,
  type IInboxMessages,
  type TInboxActionType,
  type TInboxMessageStatus,
  type TInboxMessageStatusDeleted,
  type TInboxMessageStatusOpen,
  type TInboxMessageStatusRead,
  type TInboxMessageType,
  type TInboxMessageTypeDeeplink,
  type TInboxMessageTypePlain,
  type TInboxMessageTypeRichmedia,
  type TInboxMessageTypeURL,
} from '../models/InboxMessages.types';

export default class InboxMessages implements IInboxMessages {
  private readonly data: Data;
  private readonly api: Api;
  private readonly inboxModel: InboxMessagesModel;
  private readonly moduleRegistry: IModuleRegistry;
  private dateModule: DateModule;

  // The registry is held, not the widget: the web popups bundle registers
  // itself later, and a site may never load it at all.
  constructor(
    data: Data,
    api: Api,
    inboxModel: InboxMessagesModel,
    moduleRegistry: IModuleRegistry = {},
    dateModule: DateModule = new DateModule(),
  ) {
    this.data = data;
    this.api = api;
    this.inboxModel = inboxModel;
    this.moduleRegistry = moduleRegistry;
    this.dateModule = dateModule;

    this.publicMessageBuilder = this.publicMessageBuilder.bind(this);
  }

  // An empty or malformed value used to throw and reject the whole
  // `loadMessages()` call, hiding every other message behind one bad record.
  private parseActionParams(actionParams: string): IInboxMessageActionParams {
    try {
      return JSON.parse(actionParams) || {};
    } catch (error) {
      Logger.write('error', `Pushwoosh: cannot parse inbox action_params: ${actionParams}`, error);

      return {};
    }
  }

  /**
   * Get message type by IInboxMessageActionParams
   * @param actionParams
   */
  private messageTypeFactory(action_type: TInboxActionType, actionParams: IInboxMessageActionParams): TInboxMessageType {
    let messageType: TInboxMessageTypePlain = 0;
    if (action_type === 2) { // 2 is Richmedia Action Type for server loaded messages. See TInboxActionType typings comment.
      (<TInboxMessageTypeRichmedia>messageType) = 1;
    } else if ('l' in actionParams && actionParams.l != null) { // 'l' - URL and deeplink parameter
      if (actionParams.l.startsWith('http')) { // Deeplink parameter - relative URL; URL parameter - full URL
        (<TInboxMessageTypeURL>messageType) = 2;
      } else {
        (<TInboxMessageTypeDeeplink>messageType) = 3;
      }
    }

    return messageType;
  }

  /**
   * Update messages status using codes from arguments
   * @param codes
   * @param messages
   * @param status
   */
  private async updateMessagesStatusWithCodes(
    codes: Array<string>,
    messages: Array<IInboxMessage>,
    status: TInboxMessageStatus,
  ): Promise<void> {
    const updatedMessages: Array<IInboxMessage> = [];
    const inboxStatusQueries: Array<Promise<void>> = [];

    messages.forEach(async (msg) => {
      if (codes.indexOf(msg.inbox_id) === -1) {
        return;
      }

      msg.status = status;
      updatedMessages.push(msg);

      // Set inbox status to server
      inboxStatusQueries.push(this.api.inboxStatus(msg.order, msg.status));
    });

    await this.inboxModel.putBulkMessages(updatedMessages);
    await Promise.all(inboxStatusQueries);
  }

  /**
   * Build TInboxMessagePublic by TInboxMessage
   * @param message
   */
  async publicMessageBuilder({
    action_type,
    action_params,
    image,
    title,
    send_date,
    inbox_id,
    text,
    status,
  }: IInboxMessage): Promise<IInboxMessagePublic> {
    const actionParams = this.parseActionParams(action_params);
    const userData = parseUserData(actionParams);

    const carousel = getValidSlides(userData);
    const heroUrl = getHeroUrl(actionParams, userData, image);

    // Resolved before the default title below stands in: a banner carries no
    // title on purpose, and a default would make it captioned.
    const layout = resolveInboxLayout({
      displayType: userData.displayType,
      hasTitle: !!title,
      hasBody: !!text,
      heroUrl,
      bannerUrl: actionParams.b || '',
      slidesCount: carousel.length,
    });

    const iconUrl = getIconUrl(userData, image) || await this.data.getDefaultNotificationImage();
    const inboxTitle = title || await this.data.getDefaultNotificationTitle();

    // No `setLocal()`: it shifted the instant and `toISOString` then labelled
    // the result `Z`, so the field promised UTC and carried local time.
    this.dateModule.date = new Date(parseInt(send_date) * 1000);

    return {
      title: inboxTitle,
      imageUrl: iconUrl,
      iconUrl,
      heroUrl,
      layout,
      carousel,
      customData: getCustomData(userData),
      webPopupCode: actionParams.wp || '',
      code: inbox_id,
      message: text,
      sendDate: this.dateModule.date.toISOString(),
      type: this.messageTypeFactory(action_type, actionParams),
      link: actionParams?.l || '/',
      isRead: <TInboxMessageStatusRead> status === 2 || <TInboxMessageStatusOpen> status === 3,
      isActionPerformed: <TInboxMessageStatusOpen> status === 3,
    };
  }

  /**
   * Count of messages with no action performed
   */
  messagesWithNoActionPerformedCount(): Promise<number> {
    return this.inboxModel.getDeliveredReadMessagesCount();
  }

  /**
   * All unread messages
   */
  unreadMessagesCount() {
    return this.inboxModel.getDeliveredMessagesCount();
  }

  /**
   * All messages count
   */
  messagesCount(): Promise<number> {
    return this.inboxModel.messagesCount();
  }

  /**
   * Get all active messages
   */
  async loadMessages(): Promise<Array<IInboxMessagePublic>> {
    const readMessages = await this.inboxModel.getReadOpenMessages();
    const unreadMessages = await this.inboxModel.getDeliveredMessages();
    const buildMessagePromises = [...readMessages, ...unreadMessages]
      .sort((msgA: IInboxMessage, msgB: IInboxMessage) => { // sort by send date
        return parseInt(msgB.send_date, 10) - parseInt(msgA.send_date, 10);
      })
      .sort((msgA: IInboxMessage, msgB: IInboxMessage) => { // sort by order
        return parseInt(msgB.order || '0', 10) - parseInt(msgA.order || '0', 10);
      })
      .map(this.publicMessageBuilder);
    return Promise.all(buildMessagePromises);
  }

  /**
   * Mark messages as read
   * @param codes
   */
  async readMessagesWithCodes(codes: Array<string>): Promise<void> {
    const unreadMessages = await this.inboxModel.getDeliveredMessages();

    const statusRead: TInboxMessageStatusRead = 2;
    await this.updateMessagesStatusWithCodes(
      codes,
      unreadMessages,
      statusRead,
    );
  }

  /**
   * Execute message action. Type "richmedia" and "plain" does not support
   * @param code
   */
  async performActionForMessageWithCode(code: string): Promise<void> {
    const message = await this.inboxModel.getMessage(code);
    const actionParams = this.parseActionParams(message.action_params);
    const messageType = this.messageTypeFactory(message.action_type, actionParams);

    // Both types navigate the same way; `history.go` took a number of entries,
    // so a deeplink string was a silent no-op and never went anywhere.
    const isNavigable = <TInboxMessageTypeURL>messageType === 2
      || <TInboxMessageTypeDeeplink>messageType === 3;

    // A web popup entry still carries `l`, so navigation stays the fallback
    // when the popup cannot be shown here.
    const shownAsPopup = await this.showWebPopup(actionParams.wp);

    // The link is campaign content, so its scheme is not ours to trust.
    if (!shownAsPopup && isNavigable && actionParams.l != null && isSafeUrl(actionParams.l)) {
      document.location.href = actionParams.l;
    }

    (<TInboxMessageStatusOpen>message.status) = 3;
    await this.inboxModel.putMessage(message);

    // Set inbox status to server
    await this.api.inboxStatus(message.order, message.status);
  }

  // False when there is no popup, no widget to draw it, or the widget refused the code.
  private async showWebPopup(code?: string): Promise<boolean> {
    if (!code) {
      return false;
    }

    const { webPopups } = this.moduleRegistry;

    if (!webPopups) {
      Logger.write('error', `Pushwoosh: inbox message opens web popup "${code}", but the web popups widget is not initialized`);

      return false;
    }

    return webPopups.show(code);
  }

  /**
   * Delete messages by codes
   * @param codes
   */
  async deleteMessagesWithCodes(codes: Array<string>): Promise<void> {
    const readMessages = await this.inboxModel.getReadOpenMessages();
    const unreadMessages = await this.inboxModel.getDeliveredMessages();

    const statusDeleted: TInboxMessageStatusDeleted = 4;
    await this.updateMessagesStatusWithCodes(
      codes,
      [...readMessages, ...unreadMessages],
      statusDeleted,
    );
  }

  /**
   * Sync inbox messages with server
   */
  async syncMessages() {
    await this.api.ensureDeviceRegistered();
    await this.inboxModel.updateMessages();
  }
}
