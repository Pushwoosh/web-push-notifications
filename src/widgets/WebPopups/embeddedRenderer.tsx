import { render } from 'preact';

import {
  WebPopupInline, type WebPopupColorSchemePref, type WebPopupParams,
} from '@pushwoosh/websdk-common/web-popups';

import { type WebPopupSubmitHandlers } from './renderer';
import { submitSubscriptionForm } from './subscriptionFormApi';
import { webPopupLogger } from './webPopupLogger';

/** Mount an EMBEDDED campaign inline; unmount it with `unmountWebPopup`. `onRequestRemove` is the subscribe button's close. */
export const renderEmbeddedWebPopup = (
  container: HTMLElement,
  params: WebPopupParams,
  handlers: WebPopupSubmitHandlers,
  colorScheme: WebPopupColorSchemePref = 'auto',
  onRequestRemove?: () => void,
): void => {
  render(
    <WebPopupInline
      params={params}
      colorScheme={colorScheme}
      onSubmitForm={submitSubscriptionForm}
      onSubmitFormValues={handlers.onSubmitFormValues}
      onSubmitChoice={handlers.onSubmitChoice}
      onSubmitRating={handlers.onSubmitRating}
      onRequestSubscribe={handlers.onRequestSubscribe}
      onRequestRemove={onRequestRemove}
      logger={webPopupLogger}
    />,
    container,
  );
};
