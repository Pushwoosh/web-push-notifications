import { WEB_POPUP_CLOSE_ATTRIBUTE, WEB_POPUP_SUBMIT_ATTRIBUTE } from '@pushwoosh/websdk-common/web-popups';

/** One delegated listener per container: a click on any link or button of the content, except the ✕ and the FORM Submit. */
export function listenForContentClicks(container: HTMLElement, onClick: () => void): void {
  container.addEventListener('click', (event) => {
    // No contains() check: a close button unmounts the tree before the click bubbles up here.
    const control = event.target instanceof Element ? event.target.closest('a, button') : null;

    if (!control || control.hasAttribute(WEB_POPUP_CLOSE_ATTRIBUTE)) {
      return;
    }

    // The FORM send already counts in the campaign's Submits; the panel adds Submits to Interactions.
    if (control.hasAttribute(WEB_POPUP_SUBMIT_ATTRIBUTE)) {
      return;
    }

    onClick();
  });
}
