import { FALLBACK_COLOR, getValidColor } from '../cssColor';

describe('getValidColor', () => {
  it('keeps hex in any case, which the old pattern rejected', () => {
    // `#FFFFFF` in `inboxWidget` used to come out as a dark grey widget: the
    // inbox copy of the pattern had no `i` flag, the popup copy did.
    ['#FFFFFF', '#FFF', '#00A2FF', '#ffffff', '#fff', '#00a2ff'].forEach((color) => {
      expect(getValidColor(color)).toBe(color);
    });
  });

  it('keeps named colours, the plainest form there is', () => {
    ['white', 'black', 'red', 'rebeccapurple', 'transparent'].forEach((color) => {
      expect(getValidColor(color)).toBe(color);
    });
  });

  it('keeps hex with an alpha channel', () => {
    ['#ffff', '#ffffffff'].forEach((color) => {
      expect(getValidColor(color)).toBe(color);
    });
  });

  it('keeps every functional form, in either syntax', () => {
    [
      'rgb(0,0,0)',
      'rgb(0, 0, 0)',
      'rgba(0,0,0,.5)',
      'rgb(0 0 0 / 50%)',
      'hsl(0,0%,0%)',
    ].forEach((color) => {
      expect(getValidColor(color)).toBe(color);
    });
  });

  it('replaces a value the browser would not accept', () => {
    ['nonsense', '', 'rgb(', '#gg'].forEach((color) => {
      expect(getValidColor(color)).toBe(FALLBACK_COLOR);
    });
  });

  it('refuses a value that would break out of the rule it lands in', () => {
    // The widgets interpolate the result into a stylesheet, so a value
    // carrying its own `}` or `;` must never survive.
    [
      '#fff; } body { display: none;',
      'red; background: url(https://evil/x)',
      '#fff} body{color:red',
      '{color:red}',
    ].forEach((color) => {
      expect(getValidColor(color)).toBe(FALLBACK_COLOR);
    });
  });

  it('refuses a rule-breaking payload hidden behind var(), which jsdom alone would let through', () => {
    // jsdom short-circuits on anything starting with `var(`, so without the
    // character guard this suite would stay green while the value passed.
    [
      'var(--x); } body { color: red',
      'var(--x); background: url(https://evil/x)',
      'var(--x)} body{color:red',
    ].forEach((color) => {
      expect(getValidColor(color)).toBe(FALLBACK_COLOR);
    });
  });

  it('still keeps a plain var() reference, which is a legitimate colour value', () => {
    expect(getValidColor('var(--brand)')).toBe('var(--brand)');
  });
});
