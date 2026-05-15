import { POPUP_FORMS_WIDGET_NAMESPACE, POPUP_HOST_Z_INDEX, POPUP_STYLES } from './constants';
import { getPopupForms } from './helpers';
import { renderPopupForm } from './renderer';
import { type PopupForm, type PopupFormContent } from './types';
import { Logger } from '../../core/logger';
import { type Pushwoosh } from '../../core/Pushwoosh';

type LoadedPopupForm = {
  form: PopupForm;
  content: PopupFormContent;
};

export class PopupFormsWidget {
  private readonly pw: Pushwoosh;

  private isRecurringVisitor = false;

  private readonly loadedForms = new Map<string, LoadedPopupForm>();

  private readonly pendingTimers = new Map<string, { timeoutId: number; loaded: LoadedPopupForm }>();

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

    const popupForms = getPopupForms(await pw.data.getFeatures());

    const results = await Promise.allSettled(popupForms.map((popupForm) => this.loadPopupForm(popupForm)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        Logger.error(result.reason, `Failed to load popup form "${popupForms[index].code}"`);
      }
    });

    this.subscribeToNavigation();
    this.renderForCurrentPage();

    await pw.data.setIsRecurringVisitor(true);
  }

  private async loadPopupForm(popupForm: PopupForm): Promise<void> {
    const canBeShown = await this.checkStrongCondition(popupForm);
    if (!canBeShown) {
      return;
    }

    const content = await this.pw.api.getPopupFormContent(popupForm.popup_form_content_code);
    this.loadedForms.set(popupForm.code, { form: popupForm, content });
  }

  private renderForCurrentPage(): void {
    this.cancelPendingForUnmatchedPages();

    const toRender: Array<[string, LoadedPopupForm]> = [];

    this.loadedForms.forEach((loaded, code) => {
      if (this.checkSoftCondition(loaded.form)) {
        toRender.push([code, loaded]);
      }
    });

    toRender.forEach(([code, { form, content }]) => {
      this.addToQueue(form, content);
      this.loadedForms.delete(code);
    });
  }

  private cancelPendingForUnmatchedPages(): void {
    this.pendingTimers.forEach(({ timeoutId, loaded }, code) => {
      if (this.checkSoftCondition(loaded.form)) {
        return;
      }

      window.clearTimeout(timeoutId);
      this.pendingTimers.delete(code);
      this.loadedForms.set(code, loaded);
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

  private async checkStrongCondition(popupForm: PopupForm): Promise<boolean> {
    const conditions: Array<boolean> = await Promise.all([
      this.checkCanBeShownByDeviceTypeCondition(popupForm),
      this.checkCanBeShownByFrequencyCondition(popupForm),
      this.checkCanBeShownByVisitorsTypeCondition(popupForm),
    ]);

    return conditions.every((condition) => condition);
  }

  private checkSoftCondition(popupForm: PopupForm): boolean {
    return this.checkCanBeShownByMatchingPagesCondition(popupForm);
  }

  private checkCanBeShownByDeviceTypeCondition(popupForm: PopupForm): boolean {
    const { device_type: deviceType } = popupForm;

    const formFactor = this.pw.platformChecker.formFactor;
    if (deviceType === 'ALL') {
      return true;
    }

    return deviceType === formFactor;
  }

  private async checkCanBeShownByFrequencyCondition(popupForm: PopupForm): Promise<boolean> {
    const { frequency, code } = popupForm;

    if (frequency === 'ONCE') {
      const shown = await this.pw.data.getShownPopupForms();
      return !shown.includes(code);
    }

    if (frequency === 'ONCE_PER_SESSION') {
      return sessionStorage.getItem(this.getSessionStorageKey(code)) === null;
    }

    return true;
  }

  private checkCanBeShownByMatchingPagesCondition(popupForm: PopupForm): boolean {
    const { matching_pages: matchingPages } = popupForm;
    if (!matchingPages) {
      return true;
    }

    if (matchingPages.length === 0) {
      return true;
    }

    return matchingPages.includes(window.location.pathname);
  }

  private checkCanBeShownByVisitorsTypeCondition(popupForm: PopupForm): boolean {
    const { visitors_type: visitorsType } = popupForm;

    if (visitorsType === 'NEW') {
      return !this.isRecurringVisitor;
    }

    if (visitorsType === 'RECURRING') {
      return this.isRecurringVisitor;
    }

    return true;
  }

  private async markAsShown(popupForm: PopupForm): Promise<void> {
    this.pw.api.recordPopupFormEvent(popupForm.code, 2).catch((error) => {
      Logger.error(error, `Failed to record popup form shown event for "${popupForm.code}"`);
    });
    const { frequency, code } = popupForm;

    if (frequency === 'ONCE') {
      await this.pw.data.addShownPopupForm(code);
      return;
    }

    if (frequency === 'ONCE_PER_SESSION') {
      sessionStorage.setItem(this.getSessionStorageKey(code), '1');
    }
  }

  private getSessionStorageKey(code: string): string {
    return `${POPUP_FORMS_WIDGET_NAMESPACE}.shown.${code}`;
  }

  private addToQueue(popupForm: PopupForm, content: PopupFormContent): void {
    this.pw.api.recordPopupFormEvent(popupForm.code, 1).catch((error) => {
      Logger.error(error, `Failed to record popup form queued event for "${popupForm.code}"`);
    });

    const timeoutId = window.setTimeout(() => {
      this.pendingTimers.delete(popupForm.code);

      const host = document.createElement('div');
      host.id = `${POPUP_FORMS_WIDGET_NAMESPACE}-${popupForm.code}`;
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
        this.pw.dispatchEvent('hide-popup-form', { code: popupForm.code });
      };

      closeButton.addEventListener('click', closePopup);

      renderPopupForm(container, content);

      const popupChrome = container.lastElementChild;
      container.addEventListener('click', (event) => {
        if (popupChrome && popupChrome.contains(event.target as Node)) return;
        closePopup();
      });
      this.markAsShown(popupForm).catch((error) => {
        Logger.error(error, `Failed to mark popup form "${popupForm.code}" as shown`);
      });
      this.pw.dispatchEvent('show-popup-form', { code: popupForm.code });
    }, popupForm.delay * 1000);

    this.pendingTimers.set(popupForm.code, {
      timeoutId,
      loaded: { form: popupForm, content },
    });
  }
}
