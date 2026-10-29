export function isElementFixed(element: HTMLElement): boolean {
  let isFixed = window.getComputedStyle(element).position === 'fixed';
  if (!isFixed && element.parentElement) {
    isFixed = isElementFixed(element.parentElement);
  }
  return isFixed;
}
