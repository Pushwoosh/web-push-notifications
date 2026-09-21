import { render } from 'preact';
import {
  parseWebPopupJson, resolveWebPopupPages, WebPopupReader,
  type WebPopupChoiceSubmitHandler, type WebPopupColorSchemePref, type WebPopupParams,
  type WebPopupRatingSubmitHandler, type WebPopupSubscribeResult,
} from 'smart-blocks-utils';

import { submitSubscriptionForm } from './subscriptionFormApi';

/** The device-API handlers, passed in rather than imported: this module renders, it doesn't know the core. */
export type WebPopupSubmitHandlers = {
  onSubmitChoice: WebPopupChoiceSubmitHandler;
  onSubmitRating: WebPopupRatingSubmitHandler;
  onRequestSubscribe: () => Promise<WebPopupSubscribeResult>;
};

/**
 * Parse stored popup json into the renderable model. Returns null for
 * anything that is not a supported {version: 1, params} popup with at least
 * one resolvable page — including legacy pre-engine content (no `version`
 * field), which is deliberately unrenderable.
 */
export const parseWebPopupContent = (json: string): WebPopupParams | null => {
  const parsed = parseWebPopupJson(json);
  if (!parsed) {
    return null;
  }

  if (resolveWebPopupPages(parsed.params).length === 0) {
    return null;
  }

  return parsed.params;
};

// Mount the popup into the shadow root; the reader draws the whole chrome and
// owns page switching. Forms submit to their service, choice/rating via `handlers`.
export const renderWebPopup = (
  container: HTMLElement,
  params: WebPopupParams,
  onRequestClose: () => void,
  handlers: WebPopupSubmitHandlers,
  colorScheme: WebPopupColorSchemePref = 'auto',
): void => {
  render(
    <WebPopupReader
      params={params}
      mode="live"
      colorScheme={colorScheme}
      onRequestClose={onRequestClose}
      onSubmitForm={submitSubscriptionForm}
      onSubmitChoice={handlers.onSubmitChoice}
      onSubmitRating={handlers.onSubmitRating}
      onRequestSubscribe={handlers.onRequestSubscribe}
    />,
    container,
  );
};

/**
 * Unmount a popup rendered by `renderWebPopup`. Dropping the host element alone
 * leaves the tree mounted on a detached node, so component cleanup never runs —
 * harmless for a popup shown once, not harmless now that popups cycle.
 */
export const unmountWebPopup = (container: HTMLElement): void => {
  render(null, container);
};
