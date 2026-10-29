const CONTAINER_SELECTOR = '[data-pw-recommendations]';

/**
 * Calls `load` once a recommendations block is on the page: a site without one never fetches the bundle.
 * Only `spa` keeps watching for blocks added later, so other sites carry no document-wide observer.
 */
export function loadWhenRecommendationsAppear(root: Document, load: () => void, spa: boolean = false): void {
  if (root.querySelector(CONTAINER_SELECTOR)) {
    load();

    return;
  }
  if (!spa) {
    return;
  }

  // one lookup per frame however many mutations a busy SPA produces
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (root.querySelector(CONTAINER_SELECTOR)) {
        observer.disconnect();
        load();
      }
    });
  });
  observer.observe(root.documentElement, { childList: true, subtree: true });
}
