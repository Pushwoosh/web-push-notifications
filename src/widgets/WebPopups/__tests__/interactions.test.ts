import { stringifyWebPopup, type WebPopupParams, type WebPopupSlot } from '@pushwoosh/websdk-common/web-popups';

import { type Pushwoosh } from '../../../core/Pushwoosh';
import { type WebPopup } from '../types';
import { WebPopupsWidget } from '../WebPopupsWidget';

const slot = (key: string, label: string, action: Extract<WebPopupSlot, { type: 'button' }>['action']): WebPopupSlot => ({
  type: 'button', key, variant: 'primary', label, action,
});

const TEXT_AND_BUTTONS: Array<WebPopupSlot> = [
  { type: 'text', key: 'title', variant: 'body', html: 'Stay in touch' },
  slot('more', 'Learn more', { type: 'href', url: 'https://example.com/more' }),
  slot('later', 'Not now', { type: 'close' }),
];

const FORM_FIELDS: Array<WebPopupSlot> = [
  {
    type: 'email-input', key: 'email', label: 'Email', placeholder: 'you@example.com',
    invalidMessage: 'Enter a valid email', requiredMessage: 'Required',
  },
  {
    type: 'consent', key: 'consent', checkboxLabel: 'I agree', linkLabel: 'Privacy policy',
    url: 'https://example.com/policy', requiredMessage: 'Required',
  },
];

const contentWith = (slots: Array<WebPopupSlot>): WebPopupParams => (<WebPopupParams>{
  colors: {
    background: '#ffffff', accent: '#000000', text: '#000000', textSecondary: '#666666', textInverse: '#ffffff',
  },
  placement: { v: 'middle', h: 'center', offset: 20 },
  overlay: { color: '#000000', opacity: 0.5 },
  animation: 'fade',
  borderRadius: 8,
  boxShadow: 'none',
  pages: [{
    key: 'main',
    kind: 'content',
    layout: { type: 'Content', props: { content: 'main' } },
    images: [],
    contents: [{ key: 'main', label: 'Main', slots }],
  }],
});

const POPUP: WebPopup = {
  code: 'CAMPAIGN-1',
  popup_form_content_code: 'CONTENT-1',
  device_type: 'ALL',
  visitors_type: 'ALL',
  matching_pages: [],
  delay: 0,
  frequency: 'EVERY_VISIT',
  trigger_type: 'API',
};

const INLINE: WebPopup = { ...POPUP, code: 'CAMPAIGN-2', kind: 'EMBEDDED', css_selector: '#promo' };

function buildPw() {
  return <Pushwoosh><unknown>{
    initParams: {},
    moduleRegistry: {},
    platformChecker: { formFactor: 'DESKTOP' },
    getPushPermissionStatus: jest.fn(() => 'not_determined'),
    addSdkEventHandler: jest.fn(),
    data: {
      getFeatures: jest.fn().mockResolvedValue({}),
      getIsRecurringVisitor: jest.fn().mockResolvedValue(false),
      setIsRecurringVisitor: jest.fn().mockResolvedValue(undefined),
      getShownWebPopups: jest.fn().mockResolvedValue([]),
      addShownWebPopup: jest.fn().mockResolvedValue(undefined),
      getHwid: jest.fn().mockResolvedValue('hwid'),
    },
    api: {
      ensureDeviceRegistered: jest.fn().mockResolvedValue(undefined),
      getPopupForms: jest.fn().mockResolvedValue([POPUP, INLINE]),
      getPopupFormContent: jest.fn().mockResolvedValue({ json: stringifyWebPopup(contentWith([...TEXT_AND_BUTTONS, ...FORM_FIELDS])) }),
      recordPopupFormEvent: jest.fn().mockResolvedValue(undefined),
    },
    dispatchEvent: jest.fn(),
  };
}

const interactionsOf = (pw: Pushwoosh): Array<string> => (
  (<jest.Mock>pw.api.recordPopupFormEvent).mock.calls.filter(([, event]) => event === 3).map(([code]) => code)
);

const hostOf = (id: string): ShadowRoot => (<HTMLElement>document.getElementById(id)).shadowRoot!;

const byText = (root: ShadowRoot, selector: string, text: string): HTMLElement => (
  <HTMLElement>[...root.querySelectorAll(selector)].find((element) => element.textContent?.trim() === text)
);

// The link would navigate jsdom away.
function clickLink(link: HTMLElement): void {
  link.addEventListener('click', (event) => event.preventDefault());
  link.click();
}

const CASES: Array<[string, string, string]> = [
  ['a popup', 'CAMPAIGN-1', 'pushwoosh-web-popups-CAMPAIGN-1'],
  ['an inline block', 'CAMPAIGN-2', 'pushwoosh-web-popups-embedded-CAMPAIGN-2'],
];

beforeEach(() => {
  document.body.innerHTML = '<div id="promo"></div>';
});

afterEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
});

describe.each(CASES)('interactions in %s', (_name, code, hostId) => {
  async function open() {
    const pw = buildPw();
    const widget = new WebPopupsWidget(pw);
    await widget.run();
    await widget.show(code);

    return { pw, root: hostOf(hostId) };
  }

  it('counts every click on a link or a button of the content', async () => {
    const { pw, root } = await open();

    clickLink(byText(root, 'a', 'Learn more'));
    clickLink(byText(root, 'a', 'Learn more'));
    clickLink(byText(root, 'a', 'Privacy policy'));

    expect(interactionsOf(pw)).toEqual([code, code, code]);
  });

  it('does not count text, inputs and labels', async () => {
    const { pw, root } = await open();

    byText(root, 'div', 'Stay in touch').click();
    (<HTMLElement>root.querySelector('input[placeholder="you@example.com"]')).click();
    (<HTMLElement>root.querySelector('input[type="checkbox"]')).click();
    (<HTMLElement>root.querySelector('label')).click();

    expect(interactionsOf(pw)).toEqual([]);
  });
});

// Only the FORM Submit carries the marker; the other submits stay interactions.
const SUBMITS: Array<WebPopupSlot> = [
  ...FORM_FIELDS,
  { type: 'submit', key: 'send', variant: 'primary', label: 'Send form', errorMessage: 'Try again' },
  {
    type: 'email-subscription-form', key: 'esf', formCode: 'FORM-1', submitLabel: 'Subscribe me', submitVariant: 'primary',
    fields: [{ key: 'esf-email', kind: 'email', label: 'Email', placeholder: 'esf@example.com', required: true }],
    successMessage: 'Thanks', confirmEmailMessage: 'Check your inbox',
  },
  {
    type: 'choice', key: 'topics', control: 'chips', tagName: 'Topics', options: [{ value: 'news', label: 'News' }],
    min: 0, max: 0, submitLabel: 'Save topics', submitVariant: 'primary', successMessage: 'Saved',
  },
  slot('more', 'Learn more', { type: 'href', url: 'https://example.com/more' }),
];

describe.each(CASES)('submits in %s', (_name, code, hostId) => {
  async function open() {
    const pw = buildPw();
    (<jest.Mock>pw.api.getPopupFormContent).mockResolvedValue({ json: stringifyWebPopup(contentWith(SUBMITS)) });
    const widget = new WebPopupsWidget(pw);
    await widget.run();
    await widget.show(code);

    return { pw, root: hostOf(hostId) };
  }

  it('does not count the FORM content Submit: its send counts in Submits', async () => {
    const { pw, root } = await open();

    byText(root, 'button', 'Send form').click();

    expect(interactionsOf(pw)).toEqual([]);
  });

  it('counts the email-subscription-form submit, the choice button and a plain button', async () => {
    const { pw, root } = await open();

    byText(root, 'button', 'Subscribe me').click();
    byText(root, 'button', 'Save topics').click();
    clickLink(byText(root, 'a', 'Learn more'));

    expect(interactionsOf(pw)).toEqual([code, code, code]);
  });
});

describe('interactions in a popup', () => {
  async function open() {
    const pw = buildPw();
    const widget = new WebPopupsWidget(pw);
    await widget.run();
    await widget.show('CAMPAIGN-1');

    return { pw, widget, root: hostOf('pushwoosh-web-popups-CAMPAIGN-1') };
  }

  it('counts a close button of the content', async () => {
    const { pw, widget, root } = await open();

    byText(root, 'button', 'Not now').click();

    expect(widget.getVisibleCode()).toBeNull();
    expect(interactionsOf(pw)).toEqual(['CAMPAIGN-1']);
  });

  it('does not count the ✕', async () => {
    const { pw, root } = await open();

    (<HTMLElement>root.querySelector('[data-pw-close]')).click();

    expect(interactionsOf(pw)).toEqual([]);
  });

  it('does not count the overlay', async () => {
    const { pw, widget, root } = await open();
    const overlay = <HTMLElement>[...root.querySelectorAll('div')].find((element) => element.style.animation.includes('pw-vpopup-overlay'));

    overlay.click();

    expect(widget.getVisibleCode()).toBeNull();
    expect(interactionsOf(pw)).toEqual([]);
  });

  // A form content opens by a campaign only, so the content here has none.
  it('sends nothing for a content opened by its own code', async () => {
    const pw = buildPw();
    (<jest.Mock>pw.api.getPopupFormContent).mockResolvedValue({ json: stringifyWebPopup(contentWith(TEXT_AND_BUTTONS)) });
    const widget = new WebPopupsWidget(pw);
    await widget.run();
    await widget.show('INBOX-CONTENT');

    byText(hostOf('pushwoosh-web-popups-INBOX-CONTENT'), 'button', 'Not now').click();

    expect(interactionsOf(pw)).toEqual([]);
  });
});
