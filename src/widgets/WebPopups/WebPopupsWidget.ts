import { POPUP_HOST_Z_INDEX, POPUP_STYLES, WEB_POPUPS_WIDGET_NAMESPACE } from './constants';
import { getWebPopups } from './helpers';
import { renderWebPopup } from './renderer';
import { type WebPopup, type WebPopupContent } from './types';
import { Logger } from '../../core/logger';
import { type Pushwoosh } from '../../core/Pushwoosh';

type LoadedWebPopup = {
  popup: WebPopup;
  content: WebPopupContent;
};

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

    this.isRecurringVisitor = await pw.data.getIsRecurringVisitor();

    const webPopups = getWebPopups(await pw.data.getFeatures());

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

    const content = await this.pw.api.getPopupFormContent(webPopup.popup_form_content_code);
    this.loadedPopups.set(webPopup.code, { popup: webPopup, content });
  }

  private renderForCurrentPage(): void {
    this.cancelPendingForUnmatchedPages();

    const toRender: Array<[string, LoadedWebPopup]> = [];

    this.loadedPopups.forEach((loaded, code) => {
      if (this.checkSoftCondition(loaded.popup)) {
        toRender.push([code, loaded]);
      }
    });

    toRender.forEach(([code, { popup, content }]) => {
      this.addToQueue(popup, content);
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
    const { matching_pages: matchingPages } = webPopup;
    if (!matchingPages) {
      return true;
    }

    if (matchingPages.length === 0) {
      return true;
    }

    return matchingPages.includes(window.location.pathname);
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

  private addToQueue(webPopup: WebPopup, content: WebPopupContent): void {
    this.pw.api.recordPopupFormEvent(webPopup.code, 1).catch((error) => {
      Logger.error(error, `Failed to record web popup queued event for "${webPopup.code}"`);
    });

    const timeoutId = window.setTimeout(() => {
      this.pendingTimers.delete(webPopup.code);

      const host = document.createElement('div');
      host.id = `${WEB_POPUPS_WIDGET_NAMESPACE}-${webPopup.code}`;
      host.style.position = 'fixed';
      host.style.inset = '0';
      host.style.zIndex = String(POPUP_HOST_Z_INDEX);
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = POPUP_STYLES;

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'close';
      closeButton.setAttribute('aria-label', 'Close');
      closeButton.textContent = '×';

      const container = document.createElement('div');

      shadow.appendChild(style);
      shadow.appendChild(container);
      shadow.appendChild(closeButton);

      this.lockBodyScroll();

      const closePopup = (): void => {
        this.unlockBodyScroll();
        host.remove();
        this.pw.dispatchEvent('hide-web-popup', { code: webPopup.code });
      };

      closeButton.addEventListener('click', closePopup);

      renderWebPopup(container, content);

      const popupChrome = container.lastElementChild;
      container.addEventListener('click', (event) => {
        if (popupChrome && popupChrome.contains(event.target as Node)) return;
        closePopup();
      });
      this.markAsShown(webPopup).catch((error) => {
        Logger.error(error, `Failed to mark web popup "${webPopup.code}" as shown`);
      });
      this.pw.dispatchEvent('show-web-popup', { code: webPopup.code });
    }, webPopup.delay * 1000);

    this.pendingTimers.set(webPopup.code, {
      timeoutId,
      loaded: { popup: webPopup, content },
    });
  }
}
