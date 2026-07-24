import { SUBSCRIPTION_FORMS_WIDGET_TAG, SUBSCRIPTION_FORMS_WIDGET_URL } from './constants';

const WIDGET_DEFINITION_TIMEOUT_MS = 10000;

let loadPromise: Promise<void> | null = null;

/**
 * Loads the subscription forms widget (an ES module that registers the
 * <pushwoosh-subscribe-widget> custom element) exactly once per page.
 * Resolves when the custom element is defined.
 *
 * The wait is bounded by a timeout: a script that loads but throws during
 * evaluation never registers the element and never fires the script `error`
 * event, so `customElements.whenDefined()` alone would hang forever (and with
 * it the whole web popups pipeline). On failure the memoized promise is reset
 * so the next popup can retry.
 */
export function ensureSubscriptionFormsWidgetLoaded(): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }

  if (customElements.get(SUBSCRIPTION_FORMS_WIDGET_TAG)) {
    loadPromise = Promise.resolve();
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    let timeoutId = 0;

    const fail = (error: Error): void => {
      window.clearTimeout(timeoutId);
      loadPromise = null;
      reject(error);
    };

    timeoutId = window.setTimeout(() => {
      fail(new Error(`Subscription forms widget did not define <${SUBSCRIPTION_FORMS_WIDGET_TAG}> within ${WIDGET_DEFINITION_TIMEOUT_MS}ms`));
    }, WIDGET_DEFINITION_TIMEOUT_MS);

    const script = document.createElement('script');
    script.type = 'module';
    script.src = SUBSCRIPTION_FORMS_WIDGET_URL;
    script.onerror = () => {
      fail(new Error(`Failed to load subscription forms widget script: ${SUBSCRIPTION_FORMS_WIDGET_URL}`));
    };
    document.head.appendChild(script);

    customElements.whenDefined(SUBSCRIPTION_FORMS_WIDGET_TAG).then(() => {
      window.clearTimeout(timeoutId);
      resolve();
    });
  });

  return loadPromise;
}
