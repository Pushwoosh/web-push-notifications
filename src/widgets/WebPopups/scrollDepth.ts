import { type WebPopup } from './types';

// A zoomed browser scrolls by fractions of a pixel and may stop just short of the very end.
const PAGE_END_TOLERANCE_PX = 1;

export const isScrollWebPopup = (popup: WebPopup): boolean => popup.trigger_type === 'SCROLL';

/** The depth a SCROLL popup waits for, 0–100: absent, negative or not a number shows it at once. */
export function scrollThreshold(popup: WebPopup): number {
  const depth = popup.scroll_depth;
  if (typeof depth !== 'number' || Number.isNaN(depth)) {
    return 0;
  }

  return Math.min(Math.max(depth, 0), 100);
}

/** How far down the page the middle of the screen is, in percent; 100 on a page that does not scroll or at its end. */
function pageScrollDepth(): number {
  const { scrollY, innerHeight } = window;
  const { scrollHeight } = document.scrollingElement ?? document.documentElement;

  if (scrollHeight <= innerHeight || scrollY + innerHeight >= scrollHeight - PAGE_END_TOLERANCE_PX) {
    return 100;
  }

  return (scrollY + innerHeight / 2) / scrollHeight * 100;
}

// Calls onReached once the page is scrolled to threshold. Already there: calls it at once and returns null;
// otherwise returns the teardown of its listeners and observer.
export function watchScrollDepth(threshold: number, onReached: () => void): (() => void) | null {
  if (pageScrollDepth() >= threshold) {
    onReached();
    return null;
  }

  let frame: number | null = null;

  // Catches an SPA drawing its route after arming and a page that grows; without it, scroll and resize still work.
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;

  const stop = (): void => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    observer?.disconnect();

    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
  };

  const check = (): void => {
    frame = null;

    if (pageScrollDepth() >= threshold) {
      stop();
      onReached();
    }
  };

  // One measurement per frame however many scroll, resize or layout events the browser fires.
  function schedule(): void {
    if (frame === null) {
      frame = window.requestAnimationFrame(check);
    }
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  observer?.observe(document.documentElement);

  return stop;
}
