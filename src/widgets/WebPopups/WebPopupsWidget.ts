import {
  collectWebPopupFormCodes, webPopupExpired, type WebPopupColorSchemePref, type WebPopupParams,
} from 'smart-blocks-utils';

import {
  POPUP_HOST_Z_INDEX, QUEUE_GAP_MS, WEB_POPUPS_LOG_PREFIX, WEB_POPUPS_WIDGET_NAMESPACE,
} from './constants';
import { createChoiceSubmitHandler, createRatingSubmitHandler } from './deviceSubmitApi';
import {
  parseWebPopupContent, renderWebPopup, unmountWebPopup, type WebPopupSubmitHandlers,
} from './renderer';
import { recordSubscriptionFormView } from './subscriptionFormApi';
import {
  type IWebPopupsPublicApi, type PageRule, type VisibleWebPopup, type WebPopup,
  type WebPopupEntry, type WebPopupHideReason, type WebPopupShowTrigger, type WebPopupsPublicState,
} from './types';
import { Logger } from '../../core/logger';
import { type Pushwoosh } from '../../core/Pushwoosh';

export class WebPopupsWidget implements IWebPopupsPublicApi {
  private readonly pw: Pushwoosh;

  private isRecurringVisitor = false;

  /** Every popup the server returned, keyed by code. Never pruned. */
  private readonly entries = new Map<string, WebPopupEntry>();

  /** Codes whose delay has elapsed, waiting for the display slot. */
  private readonly queue: Array<string> = [];

  /** The single popup on screen, if any. */
  private visible: VisibleWebPopup | null = null;

  private drainTimeoutId: number | null = null;

  private autoShowEnabled = true;

  private colorScheme: WebPopupColorSchemePref = 'auto';

  private isNavigationSubscribed = false;

  private openPopupsCount = 0;

  private bodyOverflowBeforeLock: string | null = null;

  /** Built once from `pw`: the device-API side of the choice/rating slots. */
  private readonly submitHandlers: WebPopupSubmitHandlers;

  // Declared before readyPromise on purpose: the Promise executor runs
  // synchronously inside that field initialiser.
  private readyResolve!: () => void;

  private readonly readyPromise = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  constructor(pw: Pushwoosh) {
    this.pw = pw;
    this.submitHandlers = {
      onSubmitChoice: createChoiceSubmitHandler(pw),
      onSubmitRating: createRatingSubmitHandler(pw),
    };

    // Registered before run() so a site can call show() from its very first
    // Pushwoosh.push() callback; every public method awaits readyPromise.
    pw.moduleRegistry.webPopups = this;
  }

  public async run(): Promise<void> {
    const { pw } = this;

    try {
      this.autoShowEnabled = pw.initParams.webPopups?.autoShow !== false;
      this.colorScheme = pw.initParams.webPopups?.colorScheme ?? 'auto';

      // Nothing to show, so nothing to register a device for. Absent feature
      // (older backend) keeps the previous behaviour; `finally` still runs.
      const features = await pw.data.getFeatures();

      if (features?.['popup_forms']?.['enabled'] === false) {
        Logger.debug(`${WEB_POPUPS_LOG_PREFIX} application has no active popup forms, skipping`);

        return;
      }

      await pw.api.ensureDeviceRegistered();

      this.isRecurringVisitor = await pw.data.getIsRecurringVisitor();

      const webPopups = await pw.api.getPopupForms();

      Logger.debug(`${WEB_POPUPS_LOG_PREFIX} Received ${webPopups.length} popup(s) from server:`, webPopups.map((webPopup) => webPopup.code));

      webPopups.forEach((popup, order) => {
        this.entries.set(popup.code, {
          popup,
          order,
          state: 'idle',
          content: null,
          loading: null,
          passedStrongConditions: false,
          timeoutId: null,
          visitRecorded: false,
        });
      });

      // Strong conditions gate AUTOMATIC display only — they are recorded, not
      // used as a load gate. Content is prefetched for every popup targeted at
      // this visitor, including trigger_type=API ones, so show() is instant;
      // popups that failed a strong condition are fetched lazily by show().
      await Promise.allSettled(Array.from(this.entries.values()).map(async (entry) => {
        entry.passedStrongConditions = await this.checkStrongCondition(entry.popup);
        if (entry.passedStrongConditions) {
          await this.ensureContent(entry);
        }
      }));

      const loaded = this.loadedCodes();
      Logger.debug(`${WEB_POPUPS_LOG_PREFIX} ${loaded.length} popup(s) passed strong conditions and loaded:`, loaded);

      this.subscribeToNavigation();
      this.renderForCurrentPage();

      await pw.data.setIsRecurringVisitor(true);
    } finally {
      // show() must never hang, even if run() blew up half way.
      this.readyResolve();
      pw.dispatchEvent('web-popups-ready', {});
    }
  }

  /* ------------------------------------------------------------------ *
   * Public API — Pushwoosh.moduleRegistry.webPopups
   * ------------------------------------------------------------------ */

  /**
   * Show a popup immediately, ignoring EVERY display condition: delay, page
   * rules, device_type, visitors_type, frequency capping and trigger_type.
   * An already visible popup is closed to make room.
   *
   * Stats and frequency bookkeeping are recorded exactly as for an automatic
   * display. Never rejects: resolves false and logs the reason on failure.
   */
  public async show(code: string): Promise<boolean> {
    await this.readyPromise;

    const entry = this.entries.get(code);
    if (!entry) {
      Logger.error(new Error('Unknown web popup code'), `${WEB_POPUPS_LOG_PREFIX} show("${code}"): no such popup`);
      return false;
    }

    if (this.visible?.code === code) {
      return true;
    }

    // Awaited BEFORE preempting so close() and present() run in the same task:
    // otherwise the browser paints the moment between two modal popups with the
    // body scroll lock released.
    const content = await this.ensureContent(entry);
    if (!content) {
      Logger.error(new Error('Web popup content unavailable'), `${WEB_POPUPS_LOG_PREFIX} show("${code}"): content unavailable`);
      return false;
    }

    // The automatic pipeline may have shown this very popup while we awaited;
    // re-presenting it would double-count the impression.
    if (this.visible?.code === code) {
      return true;
    }

    // show() deliberately ignores the page rules — but not an expired
    // countdown: the offer is over however the popup was triggered.
    if (!this.checkNotExpired(entry)) {
      return false;
    }

    if (this.visible) {
      Logger.debug(`${WEB_POPUPS_LOG_PREFIX} show("${code}") preempting "${this.visible.code}"`);
      // The preempted popup is finished with, not requeued: it already recorded
      // its impression and did its frequency bookkeeping.
      this.visible.close('preempted');
    }

    // Drop this popup's own armed timer / queue slot so the automatic pipeline
    // does not show it a second time.
    this.detachFromAutoPipeline(entry);

    this.present(entry, 'api');
    return true;
  }

  /**
   * Hide the visible popup, optionally only if it is the given one.
   * Returns false when nothing was hidden.
   */
  public hide(code?: string): boolean {
    if (!this.visible) {
      return false;
    }

    if (code !== undefined && this.visible.code !== code) {
      return false;
    }

    this.visible.close('api');
    return true;
  }

  /**
   * Hide the visible popup and dismiss everything still pending for this page
   * load. show() keeps working afterwards.
   */
  public hideAll(): boolean {
    const hadVisible = this.hide();

    this.entries.forEach((entry) => {
      if (entry.state !== 'waiting' && entry.state !== 'queued') {
        return;
      }

      this.detachFromAutoPipeline(entry);
      entry.state = 'done';
    });

    // After hide(), whose close() arms a drain for the next queued popup.
    this.cancelScheduledDrain();

    return hadVisible;
  }

  public isVisible(code?: string): boolean {
    if (!this.visible) {
      return false;
    }

    return code === undefined || this.visible.code === code;
  }

  public getVisibleCode(): string | null {
    return this.visible?.code ?? null;
  }

  public getAvailableCodes(): Array<string> {
    return Array.from(this.entries.keys());
  }

  public getState(): WebPopupsPublicState {
    const waiting: Array<string> = [];
    this.entries.forEach((entry, code) => {
      if (entry.state === 'waiting') {
        waiting.push(code);
      }
    });

    return {
      visible: this.getVisibleCode(),
      queued: [...this.queue],
      waiting,
      available: this.getAvailableCodes(),
    };
  }

  /* ------------------------------------------------------------------ *
   * Content loading
   * ------------------------------------------------------------------ */

  /**
   * Resolve the entry's renderable content, fetching it at most once. A failed
   * fetch clears the memo so a later show() can retry.
   */
  private ensureContent(entry: WebPopupEntry): Promise<WebPopupParams | null> {
    if (entry.content) {
      return Promise.resolve(entry.content);
    }

    if (entry.loading) {
      return entry.loading;
    }

    entry.loading = this.loadContent(entry.popup)
      .then((content) => {
        entry.content = content;
        return content;
      })
      .catch((error) => {
        Logger.error(error, `${WEB_POPUPS_LOG_PREFIX} Failed to load web popup "${entry.popup.code}"`);
        return null;
      })
      .finally(() => {
        if (!entry.content) {
          entry.loading = null;
        }
      });

    return entry.loading;
  }

  private async loadContent(webPopup: WebPopup): Promise<WebPopupParams | null> {
    const content = await this.pw.api.getPopupFormContent(webPopup.popup_form_content_code);
    const parsed = parseWebPopupContent(content.json);
    if (!parsed) {
      // Legacy / unknown format — this popup is broken and never shows.
      Logger.error(
        new Error('Unsupported popup content format'),
        `${WEB_POPUPS_LOG_PREFIX} Web popup "${webPopup.code}" content is not a supported {version, params} popup; skipping`,
      );
      return null;
    }

    return parsed;
  }

  private loadedCodes(): Array<string> {
    const codes: Array<string> = [];
    this.entries.forEach((entry, code) => {
      if (entry.content) {
        codes.push(code);
      }
    });
    return codes;
  }

  /* ------------------------------------------------------------------ *
   * Automatic display pipeline
   * ------------------------------------------------------------------ */

  private renderForCurrentPage(): void {
    this.releaseUnmatchedPending();

    const armed: Array<string> = [];
    this.entries.forEach((entry, code) => {
      if (this.canAutoDisplay(entry)) {
        this.armDelay(entry);
        armed.push(code);
      }
    });

    Logger.debug(
      `${WEB_POPUPS_LOG_PREFIX} ${armed.length} popup(s) selected for display on "${window.location.pathname}":`,
      armed,
    );

    // Insurance: a no-op when something is visible or nothing is queued.
    this.drain();
  }

  private canAutoDisplay(entry: WebPopupEntry): boolean {
    return this.autoShowEnabled
      && entry.state === 'idle'
      && entry.passedStrongConditions
      && this.isAutoTrigger(entry.popup)
      && entry.content !== null
      && this.checkSoftCondition(entry.popup)
      && this.checkNotExpired(entry);
  }

  private isAutoTrigger(webPopup: WebPopup): boolean {
    const trigger = webPopup.trigger_type;

    // Absent (older backend) or explicitly PAGE_LOAD means automatic display.
    // Any other value — including one this SDK version does not know — counts
    // as API-only, so a future trigger kind never shows itself by accident.
    return !trigger || trigger === 'PAGE_LOAD';
  }

  private armDelay(entry: WebPopupEntry): void {
    const { popup } = entry;

    Logger.debug(`${WEB_POPUPS_LOG_PREFIX} Popup "${popup.code}" armed for display in ${popup.delay}s`);

    entry.state = 'waiting';
    this.recordVisit(entry);

    entry.timeoutId = window.setTimeout(() => {
      entry.timeoutId = null;
      entry.state = 'queued';
      this.insertIntoQueue(entry);

      Logger.debug(
        `${WEB_POPUPS_LOG_PREFIX} Popup "${popup.code}" delay elapsed; queued at position ${this.queue.indexOf(popup.code) + 1} of ${this.queue.length}`,
      );

      this.drain();
    }, popup.delay * 1000);
  }

  /**
   * VISIT is reported once per page load, when the popup is armed for the
   * current page — the same moment as before the queue existed.
   */
  private recordVisit(entry: WebPopupEntry): void {
    if (entry.visitRecorded) {
      return;
    }

    entry.visitRecorded = true;
    this.pw.api.recordPopupFormEvent(entry.popup.code, 1).catch((error) => {
      Logger.error(error, `${WEB_POPUPS_LOG_PREFIX} Failed to record web popup visit event for "${entry.popup.code}"`);
    });
  }

  /** Ordering: shorter delay first, then the order the server returned them. */
  private insertIntoQueue(entry: WebPopupEntry): void {
    const isAfter = (code: string): boolean => {
      const other = this.entries.get(code);
      if (!other) {
        return false;
      }

      if (other.popup.delay !== entry.popup.delay) {
        return other.popup.delay > entry.popup.delay;
      }

      return other.order > entry.order;
    };

    const index = this.queue.findIndex(isAfter);
    if (index === -1) {
      this.queue.push(entry.popup.code);
      return;
    }

    this.queue.splice(index, 0, entry.popup.code);
  }

  /**
   * Release popups whose page rules stopped matching, both the ones still
   * waiting out their delay and the ones already queued. They return to `idle`
   * and are re-armed with a full delay if the visitor comes back.
   */
  private releaseUnmatchedPending(): void {
    this.entries.forEach((entry) => {
      if (entry.state !== 'waiting' && entry.state !== 'queued') {
        return;
      }

      if (this.checkSoftCondition(entry.popup) && this.checkNotExpired(entry)) {
        return;
      }

      this.detachFromAutoPipeline(entry);
      entry.state = 'idle';

      Logger.debug(`${WEB_POPUPS_LOG_PREFIX} Released popup "${entry.popup.code}": page no longer matches, or its countdown passed`);
    });
  }

  /** Clear an entry's armed timer and queue slot, leaving its state to the caller. */
  private detachFromAutoPipeline(entry: WebPopupEntry): void {
    if (entry.timeoutId !== null) {
      window.clearTimeout(entry.timeoutId);
      entry.timeoutId = null;
    }

    const index = this.queue.indexOf(entry.popup.code);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  /** Show the head of the queue if the display slot is free. */
  private drain(): void {
    if (this.visible || this.drainTimeoutId !== null) {
      return;
    }

    const code = this.queue.shift();
    if (code === undefined) {
      return;
    }

    const entry = this.entries.get(code);
    if (!entry || entry.state !== 'queued') {
      this.drain();
      return;
    }

    // The page may have changed — and the deadline may have passed — between
    // enqueue and the slot freeing up.
    if (!this.checkSoftCondition(entry.popup) || !this.checkNotExpired(entry)) {
      entry.state = 'idle';
      this.drain();
      return;
    }

    if (!entry.content) {
      entry.state = 'done';
      this.drain();
      return;
    }

    Logger.debug(`${WEB_POPUPS_LOG_PREFIX} Display slot free; showing "${code}"`);
    this.present(entry, 'auto');
  }

  private scheduleDrain(): void {
    if (this.drainTimeoutId !== null) {
      return;
    }

    this.drainTimeoutId = window.setTimeout(() => {
      this.drainTimeoutId = null;
      this.drain();
    }, QUEUE_GAP_MS);
  }

  private cancelScheduledDrain(): void {
    if (this.drainTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.drainTimeoutId);
    this.drainTimeoutId = null;
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  private present(entry: WebPopupEntry, trigger: WebPopupShowTrigger): void {
    // A drain armed by the popup we are replacing must not fire behind us.
    this.cancelScheduledDrain();

    const { popup, content } = entry;
    if (!content) {
      entry.state = 'done';
      return;
    }

    // The host is pointer-transparent: the reader's overlay / popup box
    // re-enable pointer events themselves, so a corner banner without a
    // dim never blocks the page underneath.
    const host = document.createElement('div');
    host.id = `${WEB_POPUPS_WIDGET_NAMESPACE}-${popup.code}`;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = String(POPUP_HOST_Z_INDEX);
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadow.appendChild(container);

    // Only a dimmed (modal) popup locks the page scroll; banners and bars
    // leave the page usable.
    const modal = !!content.overlay;
    if (modal) {
      this.lockBodyScroll();
    }

    let closed = false;
    const close = (reason: WebPopupHideReason): void => {
      // Idempotent: the reader's overlay click and hide() can race.
      if (closed) {
        return;
      }
      closed = true;

      if (modal) {
        this.unlockBodyScroll();
      }

      unmountWebPopup(container);
      host.remove();

      if (this.visible?.code === popup.code) {
        this.visible = null;
      }
      entry.state = 'done';

      this.pw.dispatchEvent('hide-web-popup', { code: popup.code, reason });
      this.scheduleDrain();
    };

    this.visible = {
      code: popup.code, host, modal, close,
    };
    entry.state = 'visible';

    // The reader draws the whole chrome (overlay that closes on click,
    // placement, animation, the close button and close-action buttons).
    renderWebPopup(container, content, () => close('user'), this.submitHandlers, this.colorScheme);

    // Embedded email-subscription forms count a view per showing — the
    // denominator of the form's conversion stats.
    const formCodes = collectWebPopupFormCodes(content);
    if (formCodes.length > 0) {
      this.pw.data.getHwid()
        .then((hwid) => formCodes.forEach((formCode) => recordSubscriptionFormView(formCode, hwid)))
        .catch((error) => {
          Logger.error(error, `${WEB_POPUPS_LOG_PREFIX} Failed to record subscription form views for web popup "${popup.code}"`);
        });
    }

    Logger.debug(`${WEB_POPUPS_LOG_PREFIX} Popup "${popup.code}" shown (trigger: ${trigger})`);

    // A no-op on the automatic path, where the visit was recorded at arm time.
    this.recordVisit(entry);
    this.markAsShown(popup).catch((error) => {
      Logger.error(error, `${WEB_POPUPS_LOG_PREFIX} Failed to mark web popup "${popup.code}" as shown`);
    });
    this.pw.dispatchEvent('show-web-popup', { code: popup.code, trigger });
  }

  /* ------------------------------------------------------------------ *
   * Scroll lock
   * ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ *
   * Conditions
   * ------------------------------------------------------------------ */

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

  // A popup with a run-out 'hide-popup' countdown must not be shown at all —
  // asked HERE, at SHOW time, because a render already costs the impression.
  private checkNotExpired(entry: WebPopupEntry): boolean {
    if (!entry.content) {
      return true;
    }

    if (!webPopupExpired(entry.content, Date.now())) {
      return true;
    }

    Logger.debug(`${WEB_POPUPS_LOG_PREFIX} Popup "${entry.popup.code}" not shown: its countdown has passed`);
    return false;
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
    const { matching_pages: matchingPages, matching_page_rules: matchingPageRules, excluded_pages: excludedPages } = webPopup;
    const path = window.location.pathname;

    // "Specified pages": operator-aware rules preferred, legacy exact list as fallback.
    if (matchingPageRules && matchingPageRules.length > 0) {
      return matchingPageRules.some((rule) => this.matchPageRule(path, rule));
    }

    if (matchingPages && matchingPages.length > 0) {
      return matchingPages.includes(path);
    }

    if (excludedPages && excludedPages.length > 0) {
      return !excludedPages.some((rule) => this.matchPageRule(path, rule));
    }

    return true;
  }

  private matchPageRule(path: string, rule: PageRule): boolean {
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
      Logger.error(error, `${WEB_POPUPS_LOG_PREFIX} Failed to record web popup shown event for "${webPopup.code}"`);
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
}
