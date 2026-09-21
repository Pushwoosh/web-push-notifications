import * as fs from 'fs';
import * as path from 'path';

import { type Pushwoosh } from '../../../core/Pushwoosh';
import { readCssVariableUsages } from '../../../helpers/__tests__/cssVariableUsage';
import { formatStyleVariable } from '../../../helpers/cssVariables';
import { CONFIG_STYLES, DEFAULT_CONFIG, STYLE_PREFIX } from '../constants';
import { PWSubscribePopupWidget } from '../SubscribePopup';
import { type ISubscribePopupConfig } from '../types/subscribe-popup';

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'popup.css'), 'utf8');

function buildPopup(config: Partial<ISubscribePopupConfig> = {}) {
  const pw = <Pushwoosh><unknown>{
    initParams: { subscribePopup: { enable: true, ...config } },
    isPushAvailable: () => true,
    driver: { getPermission: () => 'default' },
    isSubscribed: jest.fn().mockResolvedValue(false),
    data: { getStatusManualUnsubscribed: jest.fn().mockResolvedValue(false) },
    moduleRegistry: {},
    dispatchEvent: jest.fn(),
    subscribe: jest.fn(),
  };

  document.body.innerHTML = '';

  return new PWSubscribePopupWidget(pw);
}

function root(): HTMLElement {
  return document.getElementById('pwSubscribePopup')!;
}

describe('PWSubscribePopupWidget style variables', () => {
  it('puts every configured style on the popup root, not on :root', async () => {
    const widget = buildPopup({ manualToggle: true });
    await widget.run();

    CONFIG_STYLES.forEach(({ name, type }) => {
      expect([name, root().style.getPropertyValue(`--${STYLE_PREFIX}-${name}`)])
        .toEqual([name, formatStyleVariable(type, DEFAULT_CONFIG[name])]);
    });

    expect(document.documentElement.getAttribute('style')).toBeNull();
  });

  it('has a setter for every variable the stylesheet reads', async () => {
    const widget = buildPopup({ manualToggle: true });
    await widget.run();

    const unset = [...new Set(readCssVariableUsages(css, STYLE_PREFIX).map((usage) => usage.name))]
      .filter((name) => !root().style.getPropertyValue(`--${STYLE_PREFIX}-${name}`));

    expect(unset).toEqual([]);
  });

  it('carries a configured value through to the custom property', async () => {
    const widget = buildPopup({ manualToggle: true, subscribeBtnBgColor: '#010203' });
    await widget.run();

    expect(root().style.getPropertyValue(`--${STYLE_PREFIX}-subscribeBtnBgColor`)).toBe('#010203');
  });

  it('leaves an invalid colour unset, so the stylesheet fallback applies', async () => {
    const widget = buildPopup({ manualToggle: true, bgColor: 'rgb(oops)' });
    await widget.run();

    expect(root().style.getPropertyValue(`--${STYLE_PREFIX}-bgColor`)).toBe('');
    expect(css).toContain(`var(--${STYLE_PREFIX}-bgColor, ${DEFAULT_CONFIG.bgColor})`);
  });

  it('keeps a rule-breaking string inside its own custom property', async () => {
    const widget = buildPopup({ manualToggle: true, boxShadow: 'none} body { display: none; }' });
    await widget.run();

    expect(root().style.display).toBe('');
    expect(document.body.style.display).toBe('');
  });

  it('never writes the configuration into the stylesheet text', async () => {
    const widget = buildPopup({ manualToggle: true, subscribeBtnBgColor: '#010203' });
    await widget.run();

    const sheets = [...document.querySelectorAll('style')].map((node) => node.innerHTML).join('');

    expect(sheets).not.toContain('#010203');
  });
});

// `mobileViewMargin` used to arrive as `auto!important` inside a placeholder;
// `!important` cannot ride inside a custom property, so it is a class now.
describe('PWSubscribePopupWidget mobile view margin', () => {
  it('marks the popup when a margin is configured', async () => {
    const widget = buildPopup({ manualToggle: true, mobileViewMargin: '20px' });
    await widget.run();

    expect(root().classList.contains('pw-mobile-view-margin')).toBe(true);
    expect(root().style.getPropertyValue(`--${STYLE_PREFIX}-mobileViewMargin`)).toBe('20px');
  });

  // An explicit empty margin used to emit `bottom: ;` and strand the popup at
  // -110%; it now means the same as omitting the field.
  it('treats an explicitly empty margin the same as an omitted one', async () => {
    const widget = buildPopup({ manualToggle: true, mobileViewMargin: '' });
    await widget.run();

    expect(root().classList.contains('pw-mobile-view-margin')).toBe(false);
    expect(root().style.getPropertyValue(`--${STYLE_PREFIX}-mobileViewMargin`)).toBe('');
    expect(css).toContain(`var(--${STYLE_PREFIX}-mobileViewMargin, ${DEFAULT_CONFIG.mobileViewMargin})`);
  });

  it('leaves the popup unmarked when no margin is configured', async () => {
    const widget = buildPopup({ manualToggle: true });
    await widget.run();

    expect(root().classList.contains('pw-mobile-view-margin')).toBe(false);
  });

  it('overrides the shown position only for the marked popup', () => {
    const marked = css.slice(css.indexOf('.pw-subscribe-popup.pw-mobile-view-margin'));

    expect(marked).toContain('top: auto !important;');
    expect(marked).toContain('transition: none;');
  });
});

describe('PWSubscribePopupWidget rendering', () => {
  it('appends the stylesheet once the popup is on the page', async () => {
    const widget = buildPopup({ manualToggle: true });
    await widget.run();

    expect(root()).not.toBeNull();
    expect(document.querySelectorAll('style')).toHaveLength(1);
  });

  it('does not render when the permission was already answered', async () => {
    const widget = buildPopup({ manualToggle: true });
    (<{ pw: { driver: { getPermission(): string } } }><unknown>widget).pw.driver.getPermission = () => 'granted';
    await widget.run();

    expect(document.getElementById('pwSubscribePopup')).toBeNull();
  });
});
