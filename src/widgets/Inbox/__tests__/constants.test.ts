import * as fs from 'fs';
import * as path from 'path';

import { CONFIG_STYLES, DEFAULT_CONFIG } from '../constants';

const css = fs.readFileSync(
  path.join(__dirname, '..', 'css', 'inboxWidgetStyle.css'),
  'utf8',
);

// `configureStyle` swaps `var(--name)` by regex before the browser sees it, so
// a name missing from `CONFIG_STYLES` ships verbatim and does nothing.
describe('style configuration', () => {
  const usedInCss = [...css.matchAll(/var\(--([a-zA-Z]+)\)/g)].map((match) => match[1]);
  const registered = CONFIG_STYLES.map((style) => style.name);

  it('registers every placeholder the stylesheet uses', () => {
    const unregistered = [...new Set(usedInCss)].filter((name) => registered.indexOf(<never>name) === -1);

    expect(unregistered).toEqual([]);
  });

  it('gives every registered style a default, so no placeholder resolves to undefined', () => {
    registered.forEach((name) => {
      expect(DEFAULT_CONFIG[name]).toBeDefined();
    });
  });

  it('leaves no placeholder unused, so the registry does not rot', () => {
    const unused = registered.filter((name) => usedInCss.indexOf(name) === -1);

    expect(unused).toEqual([]);
  });
});

// `legacyClassicCell` may only restore the classic cell: banner, captioned and
// carousel are new and have no older look to return to.
describe('legacy classic cell', () => {
  const LEGACY = 'pw-inbox-widget--legacy-cell';

  it('scopes every legacy rule to the classic layout', () => {
    const selectors = css
      .split('}')
      .map((block) => block.split('{')[0].trim())
      .filter((selector) => selector.indexOf(LEGACY) !== -1);

    expect(selectors.length).toBeGreaterThan(0);

    const unscoped = selectors.filter((selector) => selector.indexOf('pw-inbox_item--classic') === -1);

    expect(unscoped).toEqual([]);
  });
});
