export const WEB_POPUPS_WIDGET_NAMESPACE = 'pushwoosh-web-popups';

// Prefix for every log line emitted by the web popups widget so its output is
// easy to spot and filter in the console.
export const WEB_POPUPS_LOG_PREFIX = '[WebPopups]';

export const POPUP_HOST_Z_INDEX = 2147483647;

export const SUBSCRIPTION_FORMS_WIDGET_URL = 'https://cdn.pushwoosh.com/subscription-forms/widget.js';

export const SUBSCRIPTION_FORMS_WIDGET_TAG = 'pushwoosh-subscribe-widget';

// The subscription-form service's public HTTP gateway — the same host the
// hosted widget above is built against. Serves email-subscription-form slot
// submits and view stats for popup-embedded forms.
export const SUBSCRIPTION_FORMS_API_URL = 'https://subscription-form.svc-nue.pushwoosh.com/api/v1';
