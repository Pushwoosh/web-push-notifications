import { type WebPopupParams } from 'smart-blocks-utils';

import { POPUP_HOST_Z_INDEX, SUBSCRIPTION_FORMS_WIDGET_TAG, WEB_POPUPS_WIDGET_NAMESPACE } from './constants';
import { parseWebPopupContent, renderWebPopup } from './renderer';
import { ensureSubscriptionFormsWidgetLoaded } from './subscriptionFormsWidgetLoader';
import { type ExcludedPage, type WebPopup } from './types';
import { Logger } from '../../core/logger';
import { type Pushwoosh } from '../../core/Pushwoosh';

type LoadedWebPopup =
  | { popup: WebPopup; kind: 'content'; parsed: WebPopupParams }
  | { popup: WebPopup; kind: 'subscription-form'; formCode: string };

export class WebPopupsWidget {
  private readonly pw: Pushwoosh;

  private isRecurringVisitor = false;

  private readonly loadedPopups = new Map<string, LoadedWebPopup>();

  private readonly pendingTimers = new Map<string, { timeoutId: number; loaded: LoadedWebPopup }>();

  private isNavigationSubscribed = false;

  private openPopupsCount = 0;

  private bodyOverflowBeforeLock: string | null = null;

  private lockBodyScroll(): void {
    if (this.openPopupsCount === 0) {
      this.bodyOverflowBeforeLock = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    this.openPopupsCount += 1;
  }

  private unlockBodyScroll(): void {
    this.openPopupsCount = Math.max(0, this.openPopupsCount - 1);
    if (this.openPopupsCount === 0 && this.bodyOverflowBeforeLock !== null) {
      document.body.style.overflow = this.bodyOverflowBeforeLock;
      this.bodyOverflowBeforeLock = null;
    }
  }

  constructor(pw: Pushwoosh) {
    this.pw = pw;
  }

  public async run(): Promise<void> {
    const { pw } = this;

    await pw.api.ensureDeviceRegistered();

    this.isRecurringVisitor = await pw.data.getIsRecurringVisitor();

    const webPopups = await pw.api.getPopupForms();

    const results = await Promise.allSettled(webPopups.map((webPopup) => this.loadWebPopup(webPopup)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        Logger.error(result.reason, `Failed to load web popup "${webPopups[index].code}"`);
      }
    });

    this.subscribeToNavigation();
    this.renderForCurrentPage();

    await pw.data.setIsRecurringVisitor(true);
  }

  private async loadWebPopup(webPopup: WebPopup): Promise<void> {
    const canBeShown = await this.checkStrongCondition(webPopup);
    if (!canBeShown) {
      return;
    }

    if (webPopup.subscription_form_code) {
      // The popup shows a hosted subscription form; the form itself is fetched
      // and rendered by the external widget, we only need its script ready.
      await ensureSubscriptionFormsWidgetLoaded();
      this.loadedPopups.set(webPopup.code, {
        popup: webPopup,
        kind: 'subscription-form',
        formCode: webPopup.subscription_form_code,
      });
      return;
    }

    if (!webPopup.popup_form_content_code) {
      Logger.error(
        new Error('Web popup has no source'),
        `Web popup "${webPopup.code}" has neither content nor subscription form; skipping`,
      );
      return;
    }

    const content = await this.pw.api.getPopupFormContent(webPopup.popup_form_content_code);
    const parsed = parseWebPopupContent(content.json);
    if (!parsed) {
      // Legacy / unknown format — this popup is broken and never shows.
      Logger.error(
        new Error('Unsupported popup content format'),
        `Web popup "${webPopup.code}" content is not a supported {version, params} popup; skipping`,
      );
      return;
    }

    this.loadedPopups.set(webPopup.code, { popup: webPopup, kind: 'content', parsed });
  }

  private renderForCurrentPage(): void {
    this.cancelPendingForUnmatchedPages();

    const toRender: Array<[string, LoadedWebPopup]> = [];

    this.loadedPopups.forEach((loaded, code) => {
      if (this.checkSoftCondition(loaded.popup)) {
        toRender.push([code, loaded]);
      }
    });

    toRender.forEach(([code, loaded]) => {
      this.addToQueue(loaded);
      this.loadedPopups.delete(code);
    });
  }

  private cancelPendingForUnmatchedPages(): void {
    this.pendingTimers.forEach(({ timeoutId, loaded }, code) => {
      if (this.checkSoftCondition(loaded.popup)) {
        return;
      }

      window.clearTimeout(timeoutId);
      this.pendingTimers.delete(code);
      this.loadedPopups.set(code, loaded);
    });
  }

  private subscribeToNavigation(): void {
    if (this.isNavigationSubscribed) {
      return;
    }

    this.isNavigationSubscribed = true;

    const onNavigate = (): void => this.renderForCurrentPage();

    const nav = (window as Window & { navigation?: EventTarget }).navigation;
    if (nav && typeof nav.addEventListener === 'function') {
      nav.addEventListener('currententrychange', onNavigate);
      return;
    }

    window.addEventListener('popstate', onNavigate);
    window.addEventListener('hashchange', onNavigate);

    // Programmatic pushState/replaceState fires no event; poll location instead
    // of monkey-patching history so SPA routers stay untouched.
    let lastHref = window.location.href;
    window.setInterval(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href;
        onNavigate();
      }
    }, 500);
  }

  private async checkStrongCondition(webPopup: WebPopup): Promise<boolean> {
    const conditions: Array<boolean> = await Promise.all([
      this.checkCanBeShownByDeviceTypeCondition(webPopup),
      this.checkCanBeShownByFrequencyCondition(webPopup),
      this.checkCanBeShownByVisitorsTypeCondition(webPopup),
    ]);

    return conditions.every((condition) => condition);
  }

  private checkSoftCondition(webPopup: WebPopup): boolean {
    return this.checkCanBeShownByMatchingPagesCondition(webPopup);
  }

  private checkCanBeShownByDeviceTypeCondition(webPopup: WebPopup): boolean {
    const { device_type: deviceType } = webPopup;

    const formFactor = this.pw.platformChecker.formFactor;
    if (deviceType === 'ALL') {
      return true;
    }

    return deviceType === formFactor;
  }

  private async checkCanBeShownByFrequencyCondition(webPopup: WebPopup): Promise<boolean> {
    const { frequency, code } = webPopup;

    if (frequency === 'ONCE') {
      const shown = await this.pw.data.getShownWebPopups();
      return !shown.includes(code);
    }

    if (frequency === 'ONCE_PER_SESSION') {
      return sessionStorage.getItem(this.getSessionStorageKey(code)) === null;
    }

    return true;
  }

  private checkCanBeShownByMatchingPagesCondition(webPopup: WebPopup): boolean {
    const { matching_pages: matchingPages, excluded_pages: excludedPages } = webPopup;
    const path = window.location.pathname;

    if (matchingPages && matchingPages.length > 0) {
      return matchingPages.includes(path);
    }

    if (excludedPages && excludedPages.length > 0) {
      return !excludedPages.some((rule) => this.matchExcludedPage(path, rule));
    }

    return true;
  }

  private matchExcludedPage(path: string, rule: ExcludedPage): boolean {
    switch (rule.operator) {
      case 'EQUALS':
        return path === rule.path;
      case 'STARTS_WITH':
        return path.startsWith(rule.path);
      default:
        // Unknown operator: skip the rule (fail-open) rather than hide/crash.
        return false;
    }
  }

  private checkCanBeShownByVisitorsTypeCondition(webPopup: WebPopup): boolean {
    const { visitors_type: visitorsType } = webPopup;

    if (visitorsType === 'NEW') {
      return !this.isRecurringVisitor;
    }

    if (visitorsType === 'RECURRING') {
      return this.isRecurringVisitor;
    }

    return true;
  }

  private async markAsShown(webPopup: WebPopup): Promise<void> {
    this.pw.api.recordPopupFormEvent(webPopup.code, 2).catch((error) => {
      Logger.error(error, `Failed to record web popup shown event for "${webPopup.code}"`);
    });
    const { frequency, code } = webPopup;

    if (frequency === 'ONCE') {
      await this.pw.data.addShownWebPopup(code);
      return;
    }

    if (frequency === 'ONCE_PER_SESSION') {
      sessionStorage.setItem(this.getSessionStorageKey(code), '1');
    }
  }

  private getSessionStorageKey(code: string): string {
    return `${WEB_POPUPS_WIDGET_NAMESPACE}.shown.${code}`;
  }

  private addToQueue(loaded: LoadedWebPopup): void {
    const webPopup = loaded.popup;

    this.pw.api.recordPopupFormEvent(webPopup.code, 1).catch((error) => {
      Logger.error(error, `Failed to record web popup queued event for "${webPopup.code}"`);
    });

    const timeoutId = window.setTimeout(() => {
      this.pendingTimers.delete(webPopup.code);

      // The host is pointer-transparent: the reader's overlay / popup box
      // re-enable pointer events themselves, so a corner banner without a
      // dim never blocks the page underneath.
      const host = document.createElement('div');
      host.id = `${WEB_POPUPS_WIDGET_NAMESPACE}-${webPopup.code}`;
      host.style.position = 'fixed';
      host.style.inset = '0';
      host.style.zIndex = String(POPUP_HOST_Z_INDEX);
      host.style.pointerEvents = 'none';
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadow.appendChild(container);

      // Only a dimmed (modal) popup locks the page scroll; banners and bars
      // leave the page usable. A subscription form popup is always modal.
      const modal = loaded.kind === 'subscription-form' || !!loaded.parsed.overlay;
      if (modal) {
        this.lockBodyScroll();
      }

      const closePopup = (): void => {
        if (modal) {
          this.unlockBodyScroll();
        }
        host.remove();
        this.pw.dispatchEvent('hide-web-popup', { code: webPopup.code });
      };

      if (loaded.kind === 'subscription-form') {
        // The widget draws only the form card (hosted mode); the SDK provides
        // the backdrop, centering and close-on-backdrop-click.
        this.renderSubscriptionForm(container, loaded.formCode, closePopup);
      } else {
        // The reader draws the whole chrome (overlay that closes on click,
        // placement, animation, the close button and close-action buttons).
        renderWebPopup(container, loaded.parsed, closePopup);
      }

      this.markAsShown(webPopup).catch((error) => {
        Logger.error(error, `Failed to mark web popup "${webPopup.code}" as shown`);
      });
      this.pw.dispatchEvent('show-web-popup', { code: webPopup.code });
    }, webPopup.delay * 1000);

    this.pendingTimers.set(webPopup.code, { timeoutId, loaded });
  }

  private renderSubscriptionForm(container: HTMLElement, formCode: string, onRequestClose: () => void): void {
    const backdrop = document.createElement('div');
    backdrop.style.position = 'absolute';
    backdrop.style.inset = '0';
    backdrop.style.background = 'rgba(0, 0, 0, 0.5)';
    backdrop.style.pointerEvents = 'auto';
    backdrop.style.display = 'flex';
    backdrop.style.alignItems = 'center';
    backdrop.style.justifyContent = 'center';
    backdrop.style.padding = '20px';
    backdrop.style.boxSizing = 'border-box';
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        onRequestClose();
      }
    });

    const widget = document.createElement(SUBSCRIPTION_FORMS_WIDGET_TAG) as HTMLElement & { formCode: string };
    widget.formCode = formCode;
    // Hosted mode: the widget skips its own frequency/delay/overlay and
    // dispatches `esw-close` when it wants (or needs) to be dismissed.
    widget.setAttribute('hosted-mode', '');
    widget.addEventListener('esw-close', onRequestClose);

    backdrop.appendChild(widget);
    container.appendChild(backdrop);
  }
}
