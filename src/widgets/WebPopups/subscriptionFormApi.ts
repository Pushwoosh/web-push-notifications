import { type WebPopupFormSubmitHandler, type WebPopupFormSubmitResult } from 'smart-blocks-utils';

import { SUBSCRIPTION_FORMS_API_URL } from './constants';
import { Logger } from '../../core/logger';

// The subscription-form service client for popup-embedded forms
// (email-subscription-form slots). Same endpoints and payloads the hosted
// <pushwoosh-subscribe-widget> uses — the popup reader only renders the
// fields; subscribing an email goes through the service so form stats,
// double opt-in and tag mapping keep working.

const SUBMIT_RESULTS: Record<string, WebPopupFormSubmitResult> = {
  SUBMIT_FORM_RESULT_SUBSCRIBED: 'subscribed',
  SUBMIT_FORM_RESULT_CONFIRM_EMAIL: 'confirm-email',
  SUBMIT_FORM_RESULT_ALREADY_SUBSCRIBED: 'already-subscribed',
};

const formUrl = (formCode: string, action: string): string => (
  `${SUBSCRIPTION_FORMS_API_URL}/forms/code/${encodeURIComponent(formCode)}${action}`
);

/**
 * The reader's `onSubmitForm` handler: POST the slot's payload to the bound
 * form's submit endpoint. Throws on transport errors and unrecognized
 * results — the form slot shows its generic retryable error then; the
 * reader doesn't log, so the failure is recorded here before rethrowing.
 */
export const submitSubscriptionForm: WebPopupFormSubmitHandler = async (formCode, payload) => {
  try {
    const response = await fetch(formUrl(formCode, '/submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // userId mirrors the hosted widget's convention: same as the email.
      body: JSON.stringify({ ...payload, userId: payload.email }),
    });
    if (!response.ok) {
      throw new Error(`Subscription form submit failed: HTTP ${response.status}`);
    }
    const data = await response.json() as { result?: string };
    const result = SUBMIT_RESULTS[data.result ?? ''];
    if (!result) {
      throw new Error(`Subscription form submit failed: unexpected result "${data.result}"`);
    }
    return result;
  } catch (error) {
    Logger.error(error, `Failed to submit subscription form "${formCode}"`);
    throw error;
  }
};

/**
 * Fire-and-forget view stat for a popup-embedded form — the denominator of
 * the form's conversion rate. Never blocks or breaks the popup itself.
 */
export const recordSubscriptionFormView = (formCode: string, hwid: string): void => {
  fetch(formUrl(formCode, '/view'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: formCode, userId: hwid, hwid }),
  }).catch((error) => {
    Logger.error(error, `Failed to record subscription form view for "${formCode}"`);
  });
};
