import * as fs from 'fs';
import * as path from 'path';

import { describeStyleConfiguration } from '../../../helpers/__tests__/styleConfigContract';
import { CONFIG_STYLES, DEFAULT_CONFIG, STYLE_PREFIX } from '../constants';

const css = fs.readFileSync(
  path.join(__dirname, '..', 'css', 'inboxWidgetStyle.css'),
  'utf8',
);

describeStyleConfiguration(css, STYLE_PREFIX, CONFIG_STYLES, DEFAULT_CONFIG);

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
