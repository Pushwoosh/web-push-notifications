import {
  DEFAULT_CONFIG,
  CONFIG_STYLES,
  STYLE_PREFIX,

  PERMISSION_DENIED,
  PERMISSION_GRANTED,
} from './constants';
import { innerTemplate } from './popupTemplates';
import popupCss from './styles/popup.css';
import { type ISubscribePopupConfig } from './types/subscribe-popup';
import { type Pushwoosh } from '../../core/Pushwoosh';
import { applyStyleVariables } from '../../helpers/cssVariables';

export class PWSubscribePopupWidget {
  pw: Pushwoosh;
  config: ISubscribePopupConfig;
  popup: HTMLElement;
  isShown: boolean;
  private hasMobileViewMargin: boolean;

  constructor(pw: Pushwoosh) {
    this.pw = pw;

    const { mobileViewMargin = '' } = pw.initParams.subscribePopup || ({} as ISubscribePopupConfig);

    this.config = {
      ...DEFAULT_CONFIG,
      ...pw.initParams.subscribePopup,
    };

    this.hasMobileViewMargin = Boolean(mobileViewMargin);

    this.onAskLaterClick = this.onAskLaterClick.bind(this);
    this.onSubscribeClick = this.onSubscribeClick.bind(this);
  }

  async run() {
    // Nothing to ask for when push is unavailable; also narrows `driver`.
    const driver = this.pw.isPushAvailable() ? this.pw.driver : null;

    if (!driver) {
      return;
    }

    const { manualToggle } = this.config;
    const [isSubscribed, isManualUnsubscribed] = await Promise.all([
      this.pw.isSubscribed(),
      this.pw.data.getStatusManualUnsubscribed(),
    ]);
    if (isSubscribed || (!manualToggle && isManualUnsubscribed)) {
      return;
    }

    const permission = driver.getPermission();
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
    this.popup.classList.toggle('pw-mobile-view-margin', this.hasMobileViewMargin);
    this.popup.innerHTML = innerTemplate({
      text,
      askLaterButtonText,
      confirmSubscriptionButtonText,
      iconUrl,
      iconAlt,
    });
    this.applyStyleVariables();
    document.body.appendChild(this.popup);
    this.addListeners();
  }

  appendStyles() {
    const style = document.createElement('style');
    style.innerHTML = popupCss.toString();
    document.body.appendChild(style);
  }

  applyStyleVariables() {
    applyStyleVariables(this.popup, STYLE_PREFIX, CONFIG_STYLES, this.config);
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
