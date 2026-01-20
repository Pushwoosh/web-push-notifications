import {
  DEFAULT_CONFIG,
  CONFIG_STYLES,

  PERMISSION_DENIED,
  PERMISSION_GRANTED,
} from './constants';
import { getValidColor } from './helpers';
import { innerTemplate } from './popupTemplates';
import popupCss from './styles/popup.css';
import {
  type ISubscribePopupConfig,
  type ISubscribePopupConfigStyles,
  type ISubscribePopupVariables,
} from './types/subscribe-popup';
import { type Pushwoosh } from '../../core/Pushwoosh';

export class PWSubscribePopupWidget {
  pw: Pushwoosh;
  config: ISubscribePopupVariables;
  popup: HTMLElement;
  isShown: boolean;

  constructor(pw: Pushwoosh) {
    this.pw = pw;

    const { mobileViewMargin = '' } = pw.initParams.subscribePopup || ({} as ISubscribePopupConfig);

    this.config = {
      ...DEFAULT_CONFIG,
      ...pw.initParams.subscribePopup,
      mobileViewTransition: mobileViewMargin ? 'none' : 'bottom .4s ease-out',
      mobileViewPosition: mobileViewMargin ? 'auto!important' : 'auto',
    };

    this.onAskLaterClick = this.onAskLaterClick.bind(this);
    this.onSubscribeClick = this.onSubscribeClick.bind(this);
  }

  async run() {
    const { manualToggle } = this.config;
    const [isSubscribed, isManualUnsubscribed] = await Promise.all([
      this.pw.isSubscribed(),
      this.pw.data.getStatusManualUnsubscribed(),
    ]);
    if (isSubscribed || (!manualToggle && isManualUnsubscribed)) {
      return;
    }

    const permission = this.pw.driver.getPermission();
    if (permission === PERMISSION_GRANTED || permission === PERMISSION_DENIED) {
      return;
    }

    this.renderPopup();
    this.appendStyles();

    this.pw.moduleRegistry.subscribePopup = this;
    this.pw.dispatchEvent('subscribe-popup-ready', {});

    if (manualToggle) {
      return;
    }

    const lastPopupOpen = localStorage.getItem('LAST_OPEN_SUBSCRIPTION_POPUP');
    const lastPopupOpenTime = lastPopupOpen ? parseInt(lastPopupOpen) : 0;
    const now = new Date().getTime();

    if (lastPopupOpenTime + (this.config.retryOffset * 1000) < now) {
      setTimeout(() => {
        this.toggle(true);
      }, this.config.delay * 1000);
    }
  }

  toggle(isShown?: boolean) {
    const isPopupShown = typeof isShown === 'undefined' ? !this.isShown : !!isShown;
    if (isPopupShown !== this.isShown) {
      if (isPopupShown) {
        this.show();
      } else {
        this.hide();
      }
    }
  }

  async show() {
    if (await this.pw.isSubscribed()) {
      return;
    }
    this.isShown = true;
    this.popup.classList.add('pw-show');
    document.body.classList.add('pw-popup-opened');

    const event = new CustomEvent('showPopup', {
      bubbles: false,
      cancelable: false,
      detail: {
        popup: this.popup,
      },
    });
    this.popup.dispatchEvent(event);

    const screenWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    if (screenWidth < 541) {
      // mobile screen doesn't support themes
      return;
    }
    const {
      theme,
      viewport,
      position,
    } = this.config;
    if (theme === 'topbar' && position === 'top') {
      const viewportElement: HTMLElement = document.querySelector(viewport) || document.createElement('div');
      const currentMarginTop = window.getComputedStyle(viewportElement).marginTop || '0';
      viewportElement.style.transition = 'margin-top .3s ease-out';
      viewportElement.style.marginTop = `${parseInt(currentMarginTop) + this.popup.getBoundingClientRect().height}px`;
    }

    this.pw.dispatchEvent('subscribe-popup-show', {});
  }

  hide() {
    this.isShown = false;
    this.popup.classList.remove('pw-show');
    document.body.classList.remove('pw-popup-opened');

    const event = new CustomEvent('hidePopup', {
      bubbles: false,
      cancelable: false,
      detail: {
        popup: this.popup,
      },
    });
    this.popup.dispatchEvent(event);

    const now = new Date().getTime().toString();

    localStorage.setItem('LAST_OPEN_SUBSCRIPTION_POPUP', now);

    const screenWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    if (screenWidth < 541) {
      // mobile screen doesn't support themes
      return;
    }
    const {
      theme,
      viewport,
      position,
    } = this.config;
    if (theme === 'topbar' && position === 'top') {
      const viewportElement: HTMLElement = document.querySelector(viewport) || document.createElement('div');
      const currentMarginTop = window.getComputedStyle(viewportElement).marginTop || '0';
      viewportElement.style.marginTop = `${parseInt(currentMarginTop) - this.popup.getBoundingClientRect().height}px`;
    }

    this.pw.dispatchEvent('subscribe-popup-hide', {});
  }

  renderPopup() {
    this.popup = document.createElement('div');
    this.popup.id = 'pwSubscribePopup';
    const {
      text,
      askLaterButtonText,
      confirmSubscriptionButtonText,
      iconUrl,
      iconAlt,
      position,
      overlay,
      theme,
    } = this.config;
    this.popup.className = `pw-subscribe-popup pw-position-${position} pw-subscribe-popup-${theme}`;
    this.popup.classList.toggle('pw-subscribe-popup__overlay', overlay);
    this.popup.innerHTML = innerTemplate({
      text,
      askLaterButtonText,
      confirmSubscriptionButtonText,
      iconUrl,
      iconAlt,
    });
    document.body.appendChild(this.popup);
    this.addListeners();
  }

  appendStyles() {
    const style = document.createElement('style');
    style.innerHTML = this.configureStyle(popupCss);
    document.body.appendChild(style);
  }

  private getStyleFormatter(style: ISubscribePopupConfigStyles): string {
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

  configureStyle(styles: string): string {
    let resultStyles = styles.toString();

    CONFIG_STYLES.forEach((style: ISubscribePopupConfigStyles) => {
      const template = new RegExp(`var\\(--${style.name}\\)`, 'ig');
      const result = this.getStyleFormatter(style);

      resultStyles = resultStyles.replace(template, result);
    });

    return resultStyles;
  }

  addListeners() {
    const askLaterButton = this.popup.querySelector('button[name="pwAskLater"]')
      || document.createElement('button');
    const subscribeButton = this.popup.querySelector('button[name="pwSubscribe"]')
      || document.createElement('button');

    askLaterButton.addEventListener('click', this.onAskLaterClick);
    subscribeButton.addEventListener('click', this.onSubscribeClick);
  }

  onAskLaterClick() {
    this.toggle(false);
    this.pw.dispatchEvent('subscribe-popup-decline', {});
  }

  onSubscribeClick() {
    this.toggle(false);
    this.pw.dispatchEvent('subscribe-popup-accept', {});
    this.pw.subscribe();
  }
}
