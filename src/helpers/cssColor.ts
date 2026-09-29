/** Drawn when the configured colour is one the browser would refuse. */
export const FALLBACK_COLOR = '#333';

// A colour value never needs these, and they are exactly what would end the
// declaration or the rule it is interpolated into.
const RULE_BREAKERS = /[;{}]/;

// One element, reused: the widgets validate every colour of their config on
// each render.
let probe: HTMLElement | null = null;

/** Keeps a colour the browser accepts, and replaces anything else with {@link FALLBACK_COLOR}. */
export function getValidColor(color: string): string {
  if (RULE_BREAKERS.test(color)) {
    return FALLBACK_COLOR;
  }

  if (!probe) {
    probe = document.createElement('div');
  }

  probe.style.color = '';
  probe.style.color = color;

  return probe.style.color ? color : FALLBACK_COLOR;
}
