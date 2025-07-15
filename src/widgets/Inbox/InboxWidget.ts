import {
  CONFIG_STYLES,
  DEFAULT_CONFIG,
} from './constants';
import inboxWidgetStyleCss from './css/inboxWidgetStyle.css';
import {
  getValidColor,
  isElementFixed,
  compareBySendDate,
} from './helpers';
import { type IConfigStyles, type IInboxWidgetConfig, type TMessagesElementsType } from './inbox_widget.types';
import {
  messageTemplate,
  widgetTemplate,
  widgetTemplateEmpty,
} from './widgetTemplates';
import { type Pushwoosh } from '../../core/Pushwoosh';
import { type IInboxMessagePublic } from '../../models/InboxMessages.types';

export class PWInboxWidget {
  pw: Pushwoosh;
  widget: HTMLElement;
  trigger: HTMLElement;
  list: HTMLElement;
  widgetParent: HTMLElement;
  count: number;
  messages: Array<IInboxMessagePublic>;
  messagesElements: TMessagesElementsType;
  readItems: Array<string>;
  isOpened: boolean;
  config: IInboxWidgetConfig;
  defaultMargin: number;
  isFixed: boolean;

  constructor(pw: Pushwoosh) {
    // Set Pushwoosh object
    this.pw = pw;

    const inboxWidgetConfig = this.pw.initParams.inboxWidget!;

    this.config = {
      ...DEFAULT_CONFIG,
      arrowBorderColor: inboxWidgetConfig.borderColor && inboxWidgetConfig.borderColor !== 'transparent'
        ? inboxWidgetConfig.borderColor
        : 'rgba(0,0,0,.1)',
      ...this.pw.initParams.inboxWidget,
    };

    this.updateInbox = this.updateInbox.bind(this);
    this.markVisibleItemsAsRead = this.markVisibleItemsAsRead.bind(this);
    this.onWidgetClickHandler = this.onWidgetClickHandler.bind(this);
    this.onTriggerClickHandler = this.onTriggerClickHandler.bind(this);
    this.onWindowScrollHandler = this.onWindowScrollHandler.bind(this);
    this.toggle = this.toggle.bind(this);
  }

  public async run() {
    this.initTrigger();
    this.updateInbox();
    this.addListeners();
  }

  public toggle(isOpened?: boolean) {
    const openWidget = typeof isOpened === 'undefined'
      ? !this.isOpened
      : isOpened;

    if (openWidget) {
      this.openWidget();
    } else {
      this.closeWidget();
    }
  }

  // set inbox widget to trigger element on page
  private initTrigger() {
    if (!this.pw.pwinbox) {
      throw new Error('Web inbox is not allowed.');
    }

    const trigger = document.getElementById(this.config.triggerId);

    if (!trigger) {
      throw new Error('Inbox trigger element doesn\'t exist. You must set triggerId in inboxWidget config. See the documentation.');
    }

    this.trigger = trigger;
    this.trigger.classList.add('pw-inbox-trigger');

    this.defaultMargin = 12;
    this.messagesElements = {};
    this.messages = [];
    this.readItems = [];
    this.updateCounter(0);
    this.isOpened = false;

    this.renderWidget();

    this.isFixed = isElementFixed(this.trigger);
  }

  private renderWidget() {
    this.widget = document.createElement('div');
    this.widget.id = 'pwInboxWidget';
    this.widget.className = 'pw-inbox-widget';
    this.widget.classList.toggle('pw-open', this.isOpened);

    this.widgetParent = document.querySelector(this.config.appendTo) || document.body;

    this.widgetParent.appendChild(this.widget);
    this.widgetParent.appendChild(this.getStyle());
    this.renderWidgetInner();
  }

  private getStyle(): HTMLStyleElement {
    const styleNode = document.createElement('style');
    styleNode.innerHTML = this.configureStyle(inboxWidgetStyleCss);
    return styleNode;
  }

  private configureStyle(styles: string): string {
    let resultStyles = styles.toString();
    CONFIG_STYLES.forEach((style: IConfigStyles) => {
      const template = new RegExp(`var\\(--${style.name}\\)`, 'ig');
      const result = this.getStyleFormatter(style);

      resultStyles = resultStyles.replace(template, result);
    });
    return resultStyles;
  }

  private getStyleFormatter(style: IConfigStyles): string {
    switch (style.type) {
      case 'size':
        return `${this.config[style.name] || 0}px`;
      case 'number':
        return parseFloat(this.config[style.name].toString()).toString();
      case 'string':
        return this.config[style.name].toString();
      case 'color':
        return getValidColor(this.config[style.name].toString());
      default:
        return 'none';
    }
  }

  private renderWidgetInner() {
    if (this.messages.length > 0) {
      this.widget.classList.remove('pw-inbox-widget--empty');
      this.widget.innerHTML = widgetTemplate(this.config.title);
      this.renderMessages();
    } else {
      this.widget.classList.add('pw-inbox-widget--empty');
      const {
        emptyInboxTitle,
        emptyInboxText,
        emptyInboxIconUrl,
      } = this.config;
      this.widget.innerHTML = widgetTemplateEmpty(emptyInboxIconUrl, emptyInboxTitle, emptyInboxText);
    }
  }

  private renderMessages() {
    this.list = this.widget.querySelector('.pw-inbox_list') || document.createElement('ul');
    this.messages.forEach((message: IInboxMessagePublic) => {
      const messageElement = document.createElement('li');
      messageElement.className = 'pw-inbox_item';
      messageElement.classList.toggle('pw-new', !message.isRead);
      messageElement.classList.toggle('pw-unread', !message.isActionPerformed);
      messageElement.setAttribute('data-pw-inbox-message-id', message.code);
      messageElement.innerHTML = messageTemplate(message);

      this.list.appendChild(messageElement);
      this.messagesElements[message.code] = messageElement;
    });
  }

  private updateCounter(count: number) {
    this.count = count;
    this.trigger.setAttribute('data-pw-count', `${this.count}`);
    this.trigger.classList.toggle('pw-empty', this.count === 0);
  }

  private updateInboxMessages(messages: Array<IInboxMessagePublic>) {
    this.messages = messages.sort(({ sendDate: sendDateOne }, { sendDate: sendDateTwo }) => compareBySendDate(sendDateOne, sendDateTwo));
    this.renderWidgetInner();
  }

  openWidget() {
    this.isOpened = true;
    this.widget.classList.add('pw-open');
    document.addEventListener('click', this.onWidgetClickHandler);
    window.addEventListener('scroll', this.onWindowScrollHandler);
    window.addEventListener('resize', this.onWindowScrollHandler);
    this.markVisibleItemsAsRead();
    if (this.messages.length > 0) {
      this.list.addEventListener('scroll', this.markVisibleItemsAsRead);
    }
    this.positionWidget();
  }

  closeWidget() {
    this.isOpened = false;
    document.removeEventListener('click', this.onWidgetClickHandler);
    document.removeEventListener('click', this.onWindowScrollHandler);
    window.removeEventListener('resize', this.onWindowScrollHandler);
    this.updateReadStatus();
    if (this.messages.length > 0) {
      this.list.removeEventListener('scroll', this.markVisibleItemsAsRead);
    }
    this.widget.classList.remove('pw-open', 'pw-top', 'pw-bottom', 'pw-right', 'pw-left');
    this.widget.removeAttribute('style');
  }

  private positionWidget() {
    if (!this.isOpened) {
      return;
    }
    if (this.widgetParent === document.body) {
      this.defaultPlaceWidget();
    } else {
      this.customPlaceWidget();
    }
  }

  private customPlaceWidget() {
    const { position } = this.config;
    this.widgetParent.style.position = 'relative';
    this.widget.classList.add('pw-inbox-widget--inset');
    this.widget.classList.add(`pw-${position}`);
  }

  private defaultPlaceWidget() {
    const position = this.pw.initParams.inboxWidget!.position ? this.config.position : this.getDefaultPosition();

    const widgetRect = this.widget.getBoundingClientRect();
    if (!document.documentElement) {
      return;
    }
    const windowWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const windowHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    if (widgetRect.width + (this.defaultMargin * 2) > windowWidth) {
      this.widget.style.width = `${windowWidth - (this.defaultMargin * 2)}px`;
    }
    if (widgetRect.height + 24 > windowHeight) {
      this.widget.style.height = `${windowHeight - (this.defaultMargin * 2)}px`;
    }

    switch (position) {
      case 'top': {
        this.alignWidgetTop();
        break;
      }
      case 'right': {
        this.alignWidgetRight();
        break;
      }
      case 'left': {
        this.alignWidgetLeft();
        break;
      }
      case 'bottom': {
        this.alignWidgetBottom();
        break;
      }
    }
  }

  private alignWidgetTop() {
    const triggerRect = this.trigger.getBoundingClientRect();
    const widgetRect = this.widget.getBoundingClientRect();
    if (!document.documentElement) {
      return;
    }
    const windowWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const arrow: HTMLElement = this.widget.querySelector('.pw-inbox__arrow') || document.createElement('div');

    this.widget.classList.add('pw-top');

    let left = pageXOffset + triggerRect.left + Math.floor(triggerRect.width / 2) - Math.floor(widgetRect.width / 2);

    const isUnderLeft = left < pageXOffset;
    const isUnderRight = left + widgetRect.width > pageXOffset + windowWidth;

    if (isUnderLeft) {
      left = pageXOffset + this.defaultMargin;
    }
    if (isUnderRight) {
      left = pageXOffset + windowWidth - widgetRect.width - this.defaultMargin;
    }

    const top = pageYOffset + triggerRect.top - widgetRect.height;

    this.alignWidgetElement(left, top);
    arrow.style.left = `${triggerRect.left + Math.floor(triggerRect.width / 2) - left}px`;

    const topMargin = this.widget.getBoundingClientRect().top;
    const isUnderTop = topMargin < 0;
    if (isUnderTop) {
      const newHeight = this.widget.getBoundingClientRect().height + topMargin - this.defaultMargin;
      const newTop = this.widget.getBoundingClientRect().top - topMargin + this.defaultMargin;
      this.widget.style.height = `${newHeight}px`;
      this.widget.style.top = `${newTop}px`;
    }
  }

  private alignWidgetRight() {
    const triggerRect = this.trigger.getBoundingClientRect();
    const widgetRect = this.widget.getBoundingClientRect();
    if (!document.documentElement) {
      return;
    }
    const windowWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const windowHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const arrow: HTMLElement = this.widget.querySelector('.pw-inbox__arrow') || document.createElement('div');

    this.widget.classList.add('pw-right');

    let top = pageYOffset + triggerRect.top + Math.floor(triggerRect.height / 2) - Math.floor(widgetRect.height / 2);

    const isUnderTop = top < pageYOffset;
    const isUnderBottom = pageYOffset + windowHeight < top + widgetRect.height;

    if (isUnderTop) {
      top = pageYOffset + this.defaultMargin;
    }

    if (isUnderBottom) {
      top = pageYOffset + windowHeight - widgetRect.height - this.defaultMargin;
    }

    const left = pageXOffset + triggerRect.left + triggerRect.width;

    this.alignWidgetElement(left, top);
    arrow.style.top = `${triggerRect.top + Math.floor(triggerRect.height / 2) - top}px`;

    const rightMargin = windowWidth - this.widget.getBoundingClientRect().right;
    const isUnderRight = rightMargin < this.defaultMargin;
    if (isUnderRight) {
      const newWidth = this.widget.getBoundingClientRect().width + rightMargin - this.defaultMargin;
      this.widget.style.width = `${newWidth}px`;
    }
  }

  private alignWidgetLeft() {
    const triggerRect = this.trigger.getBoundingClientRect();
    const widgetRect = this.widget.getBoundingClientRect();
    if (!document.documentElement) {
      return;
    }
    const windowHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const arrow: HTMLElement = this.widget.querySelector('.pw-inbox__arrow') || document.createElement('div');

    this.widget.classList.add('pw-left');

    let top = pageYOffset + triggerRect.top + Math.floor(triggerRect.height / 2) - Math.floor(widgetRect.height / 2);

    const isUnderTop = top < pageYOffset;
    const isUnderBottom = pageYOffset + windowHeight < top + widgetRect.height;

    if (isUnderTop) {
      top = pageYOffset + this.defaultMargin;
    }

    if (isUnderBottom) {
      top = pageYOffset + windowHeight - widgetRect.height - this.defaultMargin;
    }

    const left = pageXOffset + triggerRect.left - widgetRect.width;

    this.alignWidgetElement(left, top);
    arrow.style.top = `${triggerRect.top + Math.floor(triggerRect.height / 2) - top}px`;

    const leftMargin = this.widget.getBoundingClientRect().left;
    const isUnderLeft = leftMargin < 0;
    if (isUnderLeft) {
      const newWidth = this.widget.getBoundingClientRect().width + leftMargin - this.defaultMargin;
      const newLeft = this.widget.getBoundingClientRect().left - leftMargin;
      this.widget.style.width = `${newWidth}px`;
      this.widget.style.left = `${newLeft}px`;
    }
  }

  private alignWidgetBottom() {
    const triggerRect = this.trigger.getBoundingClientRect();
    const widgetRect = this.widget.getBoundingClientRect();
    if (!document.documentElement) {
      return;
    }
    const windowWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const windowHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const arrow: HTMLElement = this.widget.querySelector('.pw-inbox__arrow') || document.createElement('div');

    this.widget.classList.add('pw-bottom');

    let left = pageXOffset + triggerRect.left + Math.floor(triggerRect.width / 2) - Math.floor(widgetRect.width / 2);

    const isUnderLeft = left < pageXOffset;
    const isUnderRight = left + widgetRect.width > pageXOffset + windowWidth;

    if (isUnderLeft) {
      left = pageXOffset + this.defaultMargin;
    }
    if (isUnderRight) {
      left = pageXOffset + windowWidth - widgetRect.width - 12;
    }

    const top = pageYOffset + triggerRect.top + triggerRect.height;

    this.alignWidgetElement(left, top);
    arrow.style.left = `${triggerRect.left + Math.floor(triggerRect.width / 2) - left}px`;

    const bottomRange = windowHeight - this.widget.getBoundingClientRect().bottom;
    const isUnderBottom = bottomRange < this.defaultMargin;
    if (isUnderBottom) {
      const newHeight = this.widget.getBoundingClientRect().height + bottomRange - this.defaultMargin;
      this.widget.style.height = `${newHeight}px`;
    }
  }

  private alignWidgetElement(left: number, top: number) {
    this.widget.style.left = `${left}px`;
    this.widget.style.top = `${top}px`;
  }

  private getDefaultPosition(): string {
    const { left, top, width, height } = this.trigger.getBoundingClientRect();
    if (!document.documentElement) {
      return '';
    }
    const windowWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const windowHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    const antiMargins: { [key: string]: number } = {
      right: left,
      bottom: top,
      left: windowWidth - (left + width),
      top: windowHeight - (top + height),
    };

    const leastMargin = Math.min(left, top, antiMargins.left, antiMargins.top);

    let position = 'bottom';

    Object.keys(antiMargins).forEach((key) => {
      if (antiMargins[key] === leastMargin) {
        position = key;
      }
    });

    return position;
  }

  private addListeners() {
    this.trigger.addEventListener('click', this.onTriggerClickHandler);

    this.pw.push(['onPutNewMessageToInboxStore', () => {
      this.updateInbox();
    }]);
    this.pw.push(['onUpdateInboxMessages', () => {
      this.updateInbox();
    }]);
  }

  private markVisibleItemsAsRead() {
    if (this.messages.length === 0) {
      return;
    }
    const scrollTop = (this.list.clientHeight + this.list.scrollTop) - 50;
    Object.keys(this.messagesElements).forEach((code: string) => {
      // check message exists and user saw the message in viewport
      if (!this.messagesElements[code] || this.messagesElements[code].offsetTop > scrollTop) {
        return;
      }

      const message = this.messages.find((message: IInboxMessagePublic): boolean => message.code === code);

      // mark messages as read
      if (!!message && !message.isRead && !(this.readItems.indexOf(code) + 1)) {
        this.readItems.push(code);
      }
    });
  }

  private updateReadStatus() {
    this.pw.pwinbox.readMessagesWithCodes(this.readItems).then(this.updateInbox);
  }

  private updateInbox() {
    this.pw.pwinbox.loadMessages().then((messages: Array<IInboxMessagePublic>) => {
      this.updateInboxMessages(messages);
    });
    this.pw.pwinbox.unreadMessagesCount().then((count: number) => {
      this.updateCounter(count);
    });
  }

  private performMessageAction(code: string) {
    this.pw.pwinbox.performActionForMessageWithCode(code)
      .then(() => {
        this.updateInbox();
      });
  }

  private removeMessages(messages: Array<string>) {
    messages.forEach((code: string) => {
      this.readItems = this.readItems.slice(this.readItems.indexOf(code), 1);
    });
    this.pw.pwinbox.deleteMessagesWithCodes(messages)
      .then(() => {
        this.updateInbox();
      });
  }

  // handlers

  private onTriggerClickHandler(event: MouseEvent) {
    event.stopPropagation();
    if (!event.target) {
      return;
    }

    this.toggle();
  }

  private onWidgetClickHandler(event: MouseEvent) {
    if (!event.target) {
      return;
    }

    const itemElement = (<HTMLElement>event.target).closest('.pw-inbox_item');

    if (!itemElement) {
      this.toggle();
      return;
    }

    const messageCode = itemElement.getAttribute('data-pw-inbox-message-id');

    if (!messageCode) {
      return;
    }

    const removeIconClick = (<HTMLElement>event.target).closest('.pw-inbox_item-remove');

    if (removeIconClick) {
      this.removeMessages([messageCode]);
      return;
    }

    this.performMessageAction(messageCode);
  }

  private onWindowScrollHandler() {
    if (this.isFixed && this.isOpened) {
      this.toggle();
      return;
    }
    this.positionWidget();
  }
}
