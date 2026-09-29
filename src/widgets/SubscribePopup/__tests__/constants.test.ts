import * as fs from 'fs';
import * as path from 'path';

import { describeStyleConfiguration } from '../../../helpers/__tests__/styleConfigContract';
import {
  CONFIG_STYLES as INBOX_CONFIG_STYLES,
  STYLE_PREFIX as INBOX_STYLE_PREFIX,
} from '../../Inbox/constants';
import { CONFIG_STYLES, DEFAULT_CONFIG, STYLE_PREFIX } from '../constants';

const css = fs.readFileSync(
  path.join(__dirname, '..', 'styles', 'popup.css'),
  'utf8',
);

describeStyleConfiguration(css, STYLE_PREFIX, CONFIG_STYLES, DEFAULT_CONFIG);

// Both widgets can be on one page and four field names are shared, so the
// prefixes are the only thing keeping them apart.
describe('prefixes across widgets', () => {
  it('never produces the same variable name twice', () => {
    const inbox = INBOX_CONFIG_STYLES.map((style) => `--${INBOX_STYLE_PREFIX}-${style.name}`);
    const popup = CONFIG_STYLES.map((style) => `--${STYLE_PREFIX}-${style.name}`);
    const shared = inbox.filter((name) => popup.indexOf(name) !== -1);

    expect(shared).toEqual([]);
  });

  it('does share plain field names, which is what the prefixes are for', () => {
    const inbox = INBOX_CONFIG_STYLES.map((style) => <string>style.name);
    const popup = CONFIG_STYLES.map((style) => <string>style.name);

    expect(inbox.filter((name) => popup.indexOf(name) !== -1).sort())
      .toEqual(['bgColor', 'borderColor', 'fontFamily', 'textColor']);
  });
});
