import { type WebPopupParams } from '@pushwoosh/websdk-common/web-popups';

import { EMBEDDED_ORDER_ATTRIBUTE, WEB_POPUPS_LOG_PREFIX, WEB_POPUPS_WIDGET_NAMESPACE } from './constants';
import { type WebPopup, type WebPopupEntry, type WebPopupShowTrigger } from './types';
import { Logger } from '../../core/logger';

export const isEmbeddedWebPopup = (popup: WebPopup): boolean => popup.kind === 'EMBEDDED';

/** What the blocks need from the widget: page rules, rendering and stats live there. */
export type EmbeddedWebPopupsDeps = {
  matchesPage: (popup: WebPopup) => boolean;
  render: (container: HTMLElement, params: WebPopupParams, entry: WebPopupEntry) => void;
  unmount: (container: HTMLElement) => void;
  recordVisit: (entry: WebPopupEntry) => void;
  recordImpression: (code: string) => void;
  recordFormViews: (code: string, params: WebPopupParams) => void;
  dispatchShown: (code: string, trigger: WebPopupShowTrigger) => void;
};

type EmbeddedBlock = {
  element: Element;
  host: HTMLElement;
  container: HTMLElement;
  /** 'api' blocks stay across navigation until their element leaves the page. */
  trigger: WebPopupShowTrigger;
  /** Waits for the first time the block is seen; null once seen (or never needed). */
  observer: IntersectionObserver | null;
};

/** EMBEDDED campaigns render inside the site's own elements: no delay, queue,
 * frequency or display slot — every eligible one renders. */
export class EmbeddedWebPopups {
  private readonly deps: EmbeddedWebPopupsDeps;

  /** Blocks on the page, keyed by campaign code. */
  private readonly blocks = new Map<string, EmbeddedBlock>();

  /** Campaigns already seen (IMPRESSION + form views reported) during this page load. */
  private readonly viewed = new Set<string>();

  /** Campaigns whose auto placement was already skipped with a log during this page load. */
  private readonly autoSkipLogged = new Set<string>();

  constructor(deps: EmbeddedWebPopupsDeps) {
    this.deps = deps;
  }

  /** Bring the blocks in line with the current page; called on load and on every navigation. */
  public syncWithPage(entries: Iterable<WebPopupEntry>, canAutoShow: (entry: WebPopupEntry) => boolean): void {
    for (const entry of entries) {
      if (!isEmbeddedWebPopup(entry.popup)) {
        continue;
      }

      const { code } = entry.popup;

      // The router dropped the element: the block sits in a detached node with live listeners.
      if (this.blocks.get(code)?.host.isConnected === false) {
        this.remove(code);
      }

      if (this.blocks.get(code)?.trigger === 'api') {
        continue;
      }

      if (!this.deps.matchesPage(entry.popup)) {
        this.remove(code);
        continue;
      }

      if (entry.content && canAutoShow(entry)) {
        this.place(entry, entry.content, 'auto');
      }
    }
  }

  /** Render on demand; false when there is no element to render into. */
  public show(entry: WebPopupEntry, content: WebPopupParams): boolean {
    return this.place(entry, content, 'api');
  }

  private place(entry: WebPopupEntry, content: WebPopupParams, trigger: WebPopupShowTrigger): boolean {
    const { popup } = entry;

    const element = this.findContainer(popup, trigger);
    if (!element) {
      // The old block, if any, sits in a detached node with live listeners.
      this.remove(popup.code);
      return false;
    }

    const current = this.blocks.get(popup.code);
    if (current?.element === element && current.host.isConnected) {
      // The site asked for this block explicitly: it now outlives the page rules.
      if (trigger === 'api') {
        current.trigger = 'api';
      }
      return true;
    }

    // The router replaced or emptied the element: the old block is off the page.
    this.remove(popup.code);

    const host = document.createElement('div');
    host.id = `${WEB_POPUPS_WIDGET_NAMESPACE}-embedded-${popup.code}`;
    host.setAttribute(EMBEDDED_ORDER_ATTRIBUTE, String(entry.order));
    // A flex or grid container would otherwise shrink the block to its content.
    host.style.width = '100%';
    element.insertBefore(host, this.firstBlockAfter(element, entry.order));

    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadow.appendChild(container);

    this.deps.render(container, content, entry);
    this.blocks.set(popup.code, {
      element, host, container, trigger, observer: this.watchFirstView(entry, content, host),
    });

    this.reportShown(entry, trigger);
    return true;
  }

  private firstBlockAfter(element: Element, order: number): Element | null {
    return Array.from(element.children).find((child) => (
      child.hasAttribute(EMBEDDED_ORDER_ATTRIBUTE) && Number(child.getAttribute(EMBEDDED_ORDER_ATTRIBUTE)) > order
    )) ?? null;
  }

  private remove(code: string): void {
    const block = this.blocks.get(code);
    if (!block) {
      return;
    }

    this.blocks.delete(code);
    block.observer?.disconnect();
    this.deps.unmount(block.container);
    block.host.remove();
  }

  private findContainer(popup: WebPopup, trigger: WebPopupShowTrigger): Element | null {
    const { code, css_selector: selector } = popup;
    if (!selector) {
      this.logSkip(code, trigger, `${WEB_POPUPS_LOG_PREFIX} Embedded "${code}" has no css_selector; skipping`);
      return null;
    }

    try {
      const element = document.querySelector(selector);
      if (!element) {
        this.logSkip(code, trigger, `${WEB_POPUPS_LOG_PREFIX} Embedded "${code}": nothing matches "${selector}" on this page; skipping`);
      }
      return element;
    } catch (error) {
      // The selector comes from the dashboard/API verbatim; a broken one must not break the site.
      this.logSkip(code, trigger, `${WEB_POPUPS_LOG_PREFIX} Embedded "${code}": invalid css_selector "${selector}"; skipping`, error);
      return null;
    }
  }

  // Auto placement reruns on every navigation, so it logs once per page load;
  // show() resolves false and must say why on every call.
  private logSkip(code: string, trigger: WebPopupShowTrigger, ...details: Array<unknown>): void {
    if (trigger === 'auto') {
      if (this.autoSkipLogged.has(code)) {
        return;
      }
      this.autoSkipLogged.add(code);
    }

    Logger.debug(...details);
  }

  private reportShown(entry: WebPopupEntry, trigger: WebPopupShowTrigger): void {
    const { code } = entry.popup;

    this.deps.recordVisit(entry);

    Logger.debug(`${WEB_POPUPS_LOG_PREFIX} Embedded "${code}" rendered (trigger: ${trigger})`);
    this.deps.dispatchShown(code, trigger);
  }

  // The block renders at once (no layout jump), but only a block the visitor
  // actually scrolled to counts as an impression.
  private watchFirstView(entry: WebPopupEntry, content: WebPopupParams, host: HTMLElement): IntersectionObserver | null {
    if (this.viewed.has(entry.popup.code)) {
      return null;
    }

    if (typeof IntersectionObserver !== 'function') {
      this.reportViewed(entry.popup.code, content);
      return null;
    }

    const observer = new IntersectionObserver((records) => {
      if (!records.some((record) => record.isIntersecting)) {
        return;
      }

      observer.disconnect();
      this.reportViewed(entry.popup.code, content);
    });
    observer.observe(host);

    return observer;
  }

  private reportViewed(code: string, content: WebPopupParams): void {
    if (this.viewed.has(code)) {
      return;
    }

    this.viewed.add(code);
    this.deps.recordImpression(code);
    this.deps.recordFormViews(code, content);
  }
}
