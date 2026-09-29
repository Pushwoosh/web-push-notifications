import {
  nextSubscriptionWidgetHistory, normalizeSubscriptionWidgetConfig, subscriptionWidgetActionable,
  subscriptionWidgetCanAutoShow, subscriptionWidgetLauncherAction, subscriptionWidgetLauncherVisible,
  type SubscriptionWidgetConfig, type SubscriptionWidgetPermission,
} from '@pushwoosh/websdk-common/subscription-widget';

import { renderSubscriptionWidget, unmountSubscriptionWidget } from './renderer';
import { type ISubscriptionWidgetPublicApi } from './types';
import * as CONSTANTS from '../../core/constants';
import { Logger } from '../../core/logger';
import { type Pushwoosh } from '../../core/Pushwoosh';

const LOG_PREFIX = 'Pushwoosh subscription widget:';
const HOST_ID = 'pushwoosh-subscription-widget';

/** The unified subscription widget: launcher bell + prompt, configured by `subscriptionWidget`. */
export class PWSubscriptionWidget implements ISubscriptionWidgetPublicApi {
  private readonly pw: Pushwoosh;
  private readonly config: SubscriptionWidgetConfig;
  private permission: SubscriptionWidgetPermission = 'unsupported';
  private open = false;
  private busy = false;
  private container: HTMLElement | null = null;
  private autoShowTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(pw: Pushwoosh) {
    this.pw = pw;
    this.config = normalizeSubscriptionWidgetConfig(pw.initParams.subscriptionWidget);
    this.accept = this.accept.bind(this);
    this.decline = this.decline.bind(this);
    this.toggle = this.toggle.bind(this);
    this.launcherClick = this.launcherClick.bind(this);
    pw.moduleRegistry.subscriptionWidget = this;
  }

  public async run(): Promise<void> {
    const { pw, config } = this;

    if (!config.enable || !pw.isPushAvailable()) {
      return;
    }

    this.permission = await this.readPermission();
    this.mount();
    this.listenSubscriptionChanges();
    await this.scheduleAutoShow();
  }

  public show(): void {
    if (!this.container || !this.config.prompt.enabled || !subscriptionWidgetActionable(this.permission) || this.open) {
      return;
    }

    this.open = true;
    this.render();
    this.pw.dispatchEvent('show-subscription-widget', {});
  }

  public hide(): void {
    if (!this.open) {
      return;
    }

    this.open = false;
    this.busy = false;
    this.render();
    this.pw.dispatchEvent('hide-subscription-widget', {});
  }

  public toggle(isShown?: boolean): void {
    const shouldShow = isShown ?? !this.open;

    if (shouldShow) {
      this.show();
    } else {
      this.hide();
    }
  }

  public isVisible(): boolean {
    return this.open;
  }

  private async readPermission(): Promise<SubscriptionWidgetPermission> {
    const permission = this.pw.driver?.getPermission();

    if (permission === CONSTANTS.PERMISSION_DENIED) {
      return 'denied';
    }

    return await this.pw.isSubscribed() ? 'granted' : 'default';
  }

  private mount(): void {
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = String(this.config.zIndex);
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);

    this.container = document.createElement('div');
    host.attachShadow({ mode: 'open' }).appendChild(this.container);
    this.render();
  }

  private render(): void {
    if (!this.container) {
      return;
    }

    if (!this.open && !subscriptionWidgetLauncherVisible(this.config, this.permission)) {
      unmountSubscriptionWidget(this.container);

      return;
    }

    renderSubscriptionWidget(this.container, {
      config: this.config,
      permission: this.permission,
      open: this.open,
      busy: this.busy,
      onAccept: this.accept,
      onDecline: this.decline,
      onLauncherClick: this.launcherClick,
    });
  }

  private async scheduleAutoShow(): Promise<void> {
    const history = await this.pw.data.getSubscriptionWidgetHistory();

    if (!subscriptionWidgetCanAutoShow(this.config, this.permission, history, Date.now())) {
      return;
    }

    this.autoShowTimer = setTimeout(async () => {
      this.autoShowTimer = null;

      if (this.open || this.permission !== 'default') {
        return;
      }

      this.show();
      await this.pw.data.setSubscriptionWidgetHistory(nextSubscriptionWidgetHistory(history, Date.now()));
    }, this.config.display.delay * 1000);
  }

  private launcherClick(): void {
    const action = subscriptionWidgetLauncherAction(this.config, this.permission);

    if (action === 'prompt') {
      this.toggle();
    } else if (action === 'subscribe') {
      this.subscribeFromLauncher();
    }
  }

  // Without a prompt the bell asks the browser itself; synchronous up to pw.subscribe() for Firefox.
  private async subscribeFromLauncher(): Promise<void> {
    try {
      await this.pw.subscribe();
    } catch (error) {
      Logger.error(error, `${LOG_PREFIX} failed to subscribe`);
    }

    this.permission = await this.readPermission();
    this.render();
  }

  // Kept synchronous up to pw.subscribe(): Firefox only honours a permission request inside the click's own task.
  private async accept(): Promise<void> {
    this.busy = true;
    this.render();

    try {
      await this.pw.subscribe();
    } catch (error) {
      Logger.error(error, `${LOG_PREFIX} failed to subscribe`);
    }

    this.permission = await this.readPermission();

    if (this.permission === 'denied') {
      this.busy = false;
      this.render();

      return;
    }

    this.hide();
  }

  private decline(): void {
    this.hide();
  }

  private listenSubscriptionChanges(): void {
    const update = async () => {
      this.permission = await this.readPermission();

      if (this.permission === 'granted') {
        this.cancelAutoShow();
        this.hide();
      }

      this.render();
    };

    this.pw.addEventHandler('subscribe', update);
    this.pw.addEventHandler('unsubscribe', update);
    this.pw.addEventHandler('permission-denied', update);
  }

  private cancelAutoShow(): void {
    if (this.autoShowTimer !== null) {
      clearTimeout(this.autoShowTimer);
      this.autoShowTimer = null;
    }
  }
}
