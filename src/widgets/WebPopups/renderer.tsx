import { render } from 'preact';
import {
  parseWebPopupJson, resolveWebPopupPages, WebPopupReader,
  type WebPopupParams,
} from 'smart-blocks-utils';

import { submitSubscriptionForm } from './subscriptionFormApi';

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

/**
 * Mount the popup into the shadow-root container. The reader draws the whole
 * chrome itself: page-dim overlay (click closes), fixed viewport placement,
 * enter animation, the close button — and owns page switching for multi-page
 * popups (buttons with a `page` action). Email-subscription-form slots
 * submit through the subscription-form service.
 */
export const renderWebPopup = (
  container: HTMLElement,
  params: WebPopupParams,
  onRequestClose: () => void,
): void => {
  render(
    <WebPopupReader
      params={params}
      mode="live"
      onRequestClose={onRequestClose}
      onSubmitForm={submitSubscriptionForm}
    />,
    container,
  );
};
