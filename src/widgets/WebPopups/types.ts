import { type WebPopupParams } from 'smart-blocks-utils';

export type IWebPopupsConfig = {
  enable: boolean;
  /**
   * `false` turns off automatic display entirely: the SDK still loads the
   * popups but never shows one by itself, leaving the site to drive everything
   * through `Pushwoosh.moduleRegistry.webPopups.show(code)`. Defaults to `true`.
   *
   * This is the site-wide switch; the per-popup equivalent is the dashboard's
   * trigger setting (`WebPopup.trigger_type`).
   */
  autoShow?: boolean;
};

export type PageRuleOperator = 'EQUALS' | 'STARTS_WITH' | (string & {});

// A page rule: a path plus a match operator. Shared by the operator-aware
// Specified-pages include list and the exclude list.
export type PageRule = {
  path: string;
  operator: PageRuleOperator;
};

export type WebPopupTriggerType = 'PAGE_LOAD' | 'API' | (string & {});

export type WebPopup = {
  code: string;
  // Exactly one of popup_form_content_code / subscription_form_code is
  // non-empty: a popup shows either a smart-blocks content or a hosted
  // subscription form. The unused field comes empty from the API, so both
  // are optional here and consumers must check before use.
  popup_form_content_code?: string;
  subscription_form_code?: string;
  device_type: 'ALL' | 'DESKTOP' | 'MOBILE';
  visitors_type: 'ALL' | 'NEW' | 'RECURRING';
  matching_pages: string[];
  // Operator-aware "Specified pages" include rules; preferred over matching_pages
  // when present. Absent on older backends.
  matching_page_rules?: PageRule[];
  excluded_pages?: PageRule[];
  delay: number;
  frequency: 'ONCE' | 'ONCE_PER_SESSION' | 'EVERY_VISIT';
  // How the popup is displayed: 'PAGE_LOAD' shows it automatically, 'API' only
  // on an explicit show() call. Absent on older backends, which means automatic.
  trigger_type?: WebPopupTriggerType;
};

export type WebPopupContent = {
  code: string;
  json: string;
  html: string | null;
};

/** Renderable popup payload: either parsed content or a hosted form code. */
export type WebPopupContentBundle =
  | { kind: 'content'; parsed: WebPopupParams }
  | { kind: 'subscription-form'; formCode: string };

/**
 * Where a popup is in the automatic display pipeline for the current page load.
 *
 * `idle` -> `waiting` (delay timer armed) -> `queued` (delay served, waiting for
 * the display slot) -> `visible` -> `done`. Navigation can send a `waiting` or
 * `queued` popup back to `idle` when its page rules stop matching.
 */
export type WebPopupEntryState = 'idle' | 'waiting' | 'queued' | 'visible' | 'done';

/** Everything the widget knows about one popup, for the whole page load. */
export type WebPopupEntry = {
  popup: WebPopup;
  /** Index in the server response — the ordering tiebreaker after `delay`. */
  order: number;
  state: WebPopupEntryState;
  /** Renderable content; null until fetched, or if the fetch/parse failed. */
  content: WebPopupContentBundle | null;
  /** In-flight fetch, memoised so run() and show() never duplicate a request. */
  loading: Promise<WebPopupContentBundle | null> | null;
  /** device_type + visitors_type + frequency, evaluated exactly once in run(). */
  passedStrongConditions: boolean;
  /** Armed delay timer while state === 'waiting'. */
  timeoutId: number | null;
  /** VISIT already reported for this page load. */
  visitRecorded: boolean;
};

export type WebPopupHideReason = 'user' | 'api' | 'preempted';

export type WebPopupShowTrigger = 'auto' | 'api';

/** Handle to the single popup currently on screen. */
export type VisibleWebPopup = {
  code: string;
  host: HTMLElement;
  modal: boolean;
  /** Idempotent teardown. */
  close: (reason: WebPopupHideReason) => void;
};

export type WebPopupsPublicState = {
  /** Code of the popup on screen, if any. */
  visible: string | null;
  /** Delay served, waiting for the display slot. */
  queued: string[];
  /** Delay timer armed for the current page. */
  waiting: string[];
  /** Every code the server returned for this device. */
  available: string[];
};

/**
 * The programmatic surface exposed as `Pushwoosh.moduleRegistry.webPopups`.
 */
export interface IWebPopupsPublicApi {
  show(code: string): Promise<boolean>;
  hide(code?: string): boolean;
  hideAll(): boolean;
  isVisible(code?: string): boolean;
  getVisibleCode(): string | null;
  getAvailableCodes(): string[];
  getState(): WebPopupsPublicState;
}
