import { collectWebPopupFormCodes, webPopupExpired } from '@pushwoosh/websdk-common/web-popups';

import { Logger } from '../../../core/logger';
import { type Pushwoosh } from '../../../core/Pushwoosh';
import { renderEmbeddedWebPopup } from '../embeddedRenderer';
import { renderWebPopup, unmountWebPopup } from '../renderer';
import { recordSubscriptionFormView } from '../subscriptionFormApi';
import { type WebPopup } from '../types';
import { WebPopupsWidget } from '../WebPopupsWidget';

jest.mock('../renderer', () => ({
  parseWebPopupContent: jest.fn(() => ({ overlay: false })),
  renderWebPopup: jest.fn(),
  unmountWebPopup: jest.fn(),
}));

jest.mock('../embeddedRenderer', () => ({
  renderEmbeddedWebPopup: jest.fn(),
}));

jest.mock('../subscriptionFormApi', () => ({
  recordSubscriptionFormView: jest.fn(),
  submitSubscriptionForm: jest.fn(),
}));

jest.mock('@pushwoosh/websdk-common/web-popups', () => ({
  collectWebPopupFormCodes: jest.fn(() => []),
  webPopupExpired: jest.fn(() => false),
  webPopupHasForm: jest.fn(() => false),
}));

const EMBEDDED: WebPopup = {
  code: 'EMBEDDED-1',
  popup_form_content_code: 'CONTENT-1',
  device_type: 'ALL',
  visitors_type: 'ALL',
  matching_pages: [],
  delay: 0,
  frequency: 'EVERY_VISIT',
  trigger_type: 'PAGE_LOAD',
  kind: 'EMBEDDED',
  css_selector: '#promo',
};

const POPUP: WebPopup = {
  code: 'POPUP-1',
  popup_form_content_code: 'CONTENT-OF-POPUP',
  device_type: 'ALL',
  visitors_type: 'ALL',
  matching_pages: [],
  delay: 0,
  frequency: 'EVERY_VISIT',
  trigger_type: 'PAGE_LOAD',
};

const VALUES = { email: 'visitor@example.com', tags: { City: 'Berlin' }, policyAccepted: true };

function buildPw(popupForms: Array<WebPopup>, initParams: object = {}) {
  return <Pushwoosh><unknown>{
    initParams,
    moduleRegistry: {},
    platformChecker: { formFactor: 'DESKTOP' },
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
      getPopupForms: jest.fn().mockResolvedValue(popupForms),
      getPopupFormContent: jest.fn().mockResolvedValue({ json: '{}' }),
      recordPopupFormEvent: jest.fn().mockResolvedValue(undefined),
      submitPopupForm: jest.fn().mockResolvedValue({ result: 'OK' }),
    },
    dispatchEvent: jest.fn(),
  };
}

async function start(popupForms: Array<WebPopup>, initParams: object = {}) {
  const pw = buildPw(popupForms, initParams);
  const widget = new WebPopupsWidget(pw);
  await widget.run();

  return { pw, widget };
}

const blockId = (code: string): string => `pushwoosh-web-popups-embedded-${code}`;

// Ids of the blocks inside the element, in DOM order.
function blocksIn(selector: string): Array<string> {
  return Array.from(document.querySelector(selector)?.children ?? []).map((child) => child.id);
}

// Delay timers are window.setTimeout(…, delay * 1000): a delay-0 popup shows on the next macrotask.
const nextMacrotask = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

// jsdom has no IntersectionObserver: a stub the tests scroll by hand.
class FakeIntersectionObserver {
  static instances: Array<FakeIntersectionObserver> = [];

  readonly callback: IntersectionObserverCallback;

  readonly targets = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }
}

// Every watched block enters (true) or leaves (false) the viewport.
function setInViewport(isIntersecting: boolean): void {
  FakeIntersectionObserver.instances.forEach((observer) => {
    const records = [...observer.targets].map((target) => <IntersectionObserverEntry>{ target, isIntersecting });
    if (records.length > 0) {
      observer.callback(records, <IntersectionObserver><unknown>observer);
    }
  });
}

const impressionsOf = (pw: Pushwoosh): number => (
  (<jest.Mock>pw.api.recordPopupFormEvent).mock.calls.filter(([, event]) => event === 2).length
);

// A stub Navigation API per test: the widget prefers it, so no popstate listeners or
// href polling outlive the test.
let navigation: EventTarget;

function navigate(path: string): void {
  window.history.pushState({}, '', path);
  navigation.dispatchEvent(new Event('currententrychange'));
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  Object.defineProperty(window, 'IntersectionObserver', { value: FakeIntersectionObserver, configurable: true });
  navigation = new EventTarget();
  Object.defineProperty(window, 'navigation', { value: navigation, configurable: true });
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = '<div id="promo"></div>';
});

afterEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
  sessionStorage.clear();
});

describe('EMBEDDED web campaigns on page load', () => {
  it('renders into the first element the selector matches, not as a popup', async () => {
    document.body.innerHTML = '<div class="promo" id="first"></div><div class="promo" id="second"></div>';

    const { pw, widget } = await start([{ ...EMBEDDED, css_selector: '.promo' }]);
    setInViewport(true);

    expect(blocksIn('#first')).toEqual([blockId('EMBEDDED-1')]);
    expect(blocksIn('#second')).toEqual([]);
    expect(renderEmbeddedWebPopup).toHaveBeenCalledTimes(1);
    expect(renderWebPopup).not.toHaveBeenCalled();
    expect(widget.getVisibleCode()).toBeNull();
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledWith('EMBEDDED-1', 1);
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledWith('EMBEDDED-1', 2);
    expect(pw.dispatchEvent).toHaveBeenCalledWith('show-web-popup', { code: 'EMBEDDED-1', trigger: 'auto' });
  });

  it('stretches the block across a flex container', async () => {
    document.body.innerHTML = '<div id="promo" style="display: flex"></div>';

    await start([EMBEDDED]);

    expect((<HTMLElement>document.getElementById(blockId('EMBEDDED-1'))).style.width).toBe('100%');
  });

  it('stacks several campaigns with one selector in server order', async () => {
    await start([
      { ...EMBEDDED, code: 'A' },
      { ...EMBEDDED, code: 'B' },
    ]);

    expect(blocksIn('#promo')).toEqual([blockId('A'), blockId('B')]);
  });

  it('skips silently when no element matches, the selector is broken or missing', async () => {
    const { pw } = await start([
      { ...EMBEDDED, code: 'ABSENT', css_selector: '#absent' },
      { ...EMBEDDED, code: 'BROKEN', css_selector: 'div[' },
      { ...EMBEDDED, code: 'NO-SELECTOR', css_selector: undefined },
      { ...EMBEDDED, code: 'OK' },
    ]);

    expect(blocksIn('#promo')).toEqual([blockId('OK')]);
    expect(renderEmbeddedWebPopup).toHaveBeenCalledTimes(1);
    ['ABSENT', 'BROKEN', 'NO-SELECTOR'].forEach((code) => {
      expect(pw.api.recordPopupFormEvent).not.toHaveBeenCalledWith(code, 1);
      expect(pw.dispatchEvent).not.toHaveBeenCalledWith('show-web-popup', expect.objectContaining({ code }));
    });
    expect(pw.dispatchEvent).toHaveBeenCalledWith('web-popups-ready', {});
  });

  it('ignores delay and frequency', async () => {
    const pw = buildPw([{ ...EMBEDDED, delay: 30, frequency: 'ONCE' }]);
    (<jest.Mock>pw.data.getShownWebPopups).mockResolvedValue(['EMBEDDED-1']);

    await new WebPopupsWidget(pw).run();

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(pw.data.addShownWebPopup).not.toHaveBeenCalled();
  });

  it('renders even when the frequency storage cannot be read', async () => {
    const pw = buildPw([{ ...EMBEDDED, frequency: 'ONCE' }]);
    (<jest.Mock>pw.data.getShownWebPopups).mockRejectedValue(new Error('storage'));

    await new WebPopupsWidget(pw).run();

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
  });

  it('respects device type, visitor type and page rules', async () => {
    await start([
      { ...EMBEDDED, code: 'MOBILE-ONLY', device_type: 'MOBILE' },
      { ...EMBEDDED, code: 'RECURRING-ONLY', visitors_type: 'RECURRING' },
      { ...EMBEDDED, code: 'CHECKOUT-ONLY', matching_page_rules: [{ path: '/checkout', operator: 'EQUALS' }] },
      { ...EMBEDDED, code: 'NOT-HOME', excluded_pages: [{ path: '/', operator: 'EQUALS' }] },
    ]);

    expect(blocksIn('#promo')).toEqual([]);
  });

  it('leaves the block to show() when autoShow is off or the trigger is API', async () => {
    await start([EMBEDDED], { webPopups: { autoShow: false } });
    expect(blocksIn('#promo')).toEqual([]);

    await start([{ ...EMBEDDED, trigger_type: 'API' }]);
    expect(blocksIn('#promo')).toEqual([]);
  });

  it.each([undefined, 'BANNER'])('treats kind %p as a popup', async (kind) => {
    await start([{ ...EMBEDDED, kind }]);
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
    expect(renderEmbeddedWebPopup).not.toHaveBeenCalled();
  });

  it('renders a campaign whose countdown has already passed', async () => {
    (<jest.Mock>webPopupExpired).mockReturnValue(true);

    await start([EMBEDDED]);
    (<jest.Mock>webPopupExpired).mockReturnValue(false);

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
  });

  it('does not watch for an element added after the SDK is ready; show() renders into it', async () => {
    document.body.innerHTML = '';
    const { widget } = await start([EMBEDDED]);

    document.body.innerHTML = '<div id="promo"></div>';
    await nextMacrotask();
    expect(blocksIn('#promo')).toEqual([]);

    await expect(widget.show('EMBEDDED-1')).resolves.toBe(true);
    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
  });

  it('renders beside a visible popup without taking its display slot', async () => {
    const { widget } = await start([POPUP, EMBEDDED]);
    await nextMacrotask();

    expect(widget.getVisibleCode()).toBe('POPUP-1');
    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
  });
});

describe('EMBEDDED IMPRESSION and form views on entering the viewport', () => {
  beforeEach(() => {
    (<jest.Mock>collectWebPopupFormCodes).mockReturnValue(['FORM-1']);
  });

  afterEach(() => {
    (<jest.Mock>collectWebPopupFormCodes).mockReturnValue([]);
  });

  it('renders at once but reports no IMPRESSION or form view while the block is out of view', async () => {
    const { pw } = await start([EMBEDDED]);
    setInViewport(false);
    await nextMacrotask();

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledWith('EMBEDDED-1', 1);
    expect(impressionsOf(pw)).toBe(0);
    expect(recordSubscriptionFormView).not.toHaveBeenCalled();
  });

  it('reports one IMPRESSION and one form view when the block enters the viewport', async () => {
    const { pw } = await start([EMBEDDED]);
    setInViewport(true);
    await nextMacrotask();

    expect(impressionsOf(pw)).toBe(1);
    expect(recordSubscriptionFormView).toHaveBeenCalledTimes(1);
    expect(recordSubscriptionFormView).toHaveBeenCalledWith('FORM-1', 'hwid');
  });

  it('reports nothing more when the block leaves and enters the viewport again', async () => {
    const { pw } = await start([EMBEDDED]);
    setInViewport(true);
    setInViewport(false);
    setInViewport(true);
    await nextMacrotask();

    expect(impressionsOf(pw)).toBe(1);
    expect(recordSubscriptionFormView).toHaveBeenCalledTimes(1);
  });

  it('reports IMPRESSION and form view once at render when the browser has no IntersectionObserver', async () => {
    Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true });

    const { pw } = await start([EMBEDDED]);
    await nextMacrotask();

    expect(impressionsOf(pw)).toBe(1);
    expect(recordSubscriptionFormView).toHaveBeenCalledTimes(1);
    expect(recordSubscriptionFormView).toHaveBeenCalledWith('FORM-1', 'hwid');
  });
});

describe('EMBEDDED web campaigns across SPA navigation', () => {
  const SHOP_ONLY: WebPopup = { ...EMBEDDED, matching_page_rules: [{ path: '/shop', operator: 'STARTS_WITH' }] };

  it('removes the block when the page rules stop matching and brings it back, with one IMPRESSION', async () => {
    window.history.replaceState({}, '', '/shop');
    const { pw } = await start([SHOP_ONLY]);
    setInViewport(true);

    navigate('/about');
    expect(blocksIn('#promo')).toEqual([]);
    expect(unmountWebPopup).toHaveBeenCalledTimes(1);

    navigate('/shop/shoes');
    setInViewport(true);
    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(impressionsOf(pw)).toBe(1);
  });

  it('keeps a block untouched while the page rules keep matching', async () => {
    await start([EMBEDDED]);

    navigate('/anything');

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(renderEmbeddedWebPopup).toHaveBeenCalledTimes(1);
  });

  it('renders into an element that appeared after navigation', async () => {
    document.body.innerHTML = '';
    await start([EMBEDDED]);

    document.body.innerHTML = '<div id="promo"></div>';
    navigate('/next');

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
  });

  it('releases the block when its element is gone and renders it again when the element returns', async () => {
    const { pw } = await start([EMBEDDED]);
    setInViewport(true);

    document.body.innerHTML = '';
    navigate('/no-promo');
    expect(unmountWebPopup).toHaveBeenCalledTimes(1);

    document.body.innerHTML = '<div id="promo"></div>';
    navigate('/promo');
    setInViewport(true);

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(unmountWebPopup).toHaveBeenCalledTimes(1);
    expect(impressionsOf(pw)).toBe(1);
  });

  it('moves the block into the element the router rendered instead of the old one', async () => {
    const { pw } = await start([EMBEDDED]);
    setInViewport(true);

    document.body.innerHTML = '<div id="promo"></div>';
    navigate('/next');
    setInViewport(true);

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(unmountWebPopup).toHaveBeenCalledTimes(1);
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledTimes(2);
  });

  it('logs a missing element once per campaign however many navigations follow', async () => {
    document.body.innerHTML = '';
    const debug = jest.spyOn(Logger, 'debug');

    await start([EMBEDDED]);
    navigate('/a');
    navigate('/b');

    expect(debug.mock.calls.filter(([message]) => String(message).includes('nothing matches'))).toHaveLength(1);
    debug.mockRestore();
  });

  it('keeps server order when a block comes back', async () => {
    window.history.replaceState({}, '', '/shop');
    await start([
      { ...SHOP_ONLY, code: 'A' },
      { ...EMBEDDED, code: 'B' },
    ]);

    navigate('/about');
    navigate('/shop');

    expect(blocksIn('#promo')).toEqual([blockId('A'), blockId('B')]);
  });
});

describe('show() for EMBEDDED web campaigns', () => {
  const API_ONLY: WebPopup = { ...EMBEDDED, trigger_type: 'API' };

  it('renders an API-triggered campaign into its element', async () => {
    const { pw, widget } = await start([API_ONLY]);

    await expect(widget.show('EMBEDDED-1')).resolves.toBe(true);
    setInViewport(true);

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(renderWebPopup).not.toHaveBeenCalled();
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledWith('EMBEDDED-1', 2);
    expect(pw.dispatchEvent).toHaveBeenCalledWith('show-web-popup', { code: 'EMBEDDED-1', trigger: 'api' });
  });

  it('works with autoShow off', async () => {
    const { widget } = await start([EMBEDDED], { webPopups: { autoShow: false } });

    await expect(widget.show('EMBEDDED-1')).resolves.toBe(true);
    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
  });

  it('resolves false when no element matches', async () => {
    const { pw, widget } = await start([{ ...API_ONLY, css_selector: '#absent' }]);

    await expect(widget.show('EMBEDDED-1')).resolves.toBe(false);
    setInViewport(true);

    expect(pw.dispatchEvent).not.toHaveBeenCalledWith('show-web-popup', expect.anything());
    expect(pw.api.recordPopupFormEvent).not.toHaveBeenCalled();
  });

  it('renders one block and one IMPRESSION however often it is called', async () => {
    const { pw, widget } = await start([API_ONLY]);

    await widget.show('EMBEDDED-1');
    setInViewport(true);
    await widget.show('EMBEDDED-1');
    setInViewport(true);

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(impressionsOf(pw)).toBe(1);
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledTimes(2);
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledWith('EMBEDDED-1', 1);
    expect((<jest.Mock>pw.dispatchEvent).mock.calls.filter(([name]) => name === 'show-web-popup')).toHaveLength(1);
  });

  it('keeps the block on navigation to a page the rules do not match', async () => {
    window.history.replaceState({}, '', '/shop');
    const { widget } = await start([{ ...API_ONLY, matching_page_rules: [{ path: '/shop', operator: 'STARTS_WITH' }] }]);
    await widget.show('EMBEDDED-1');

    navigate('/about');

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(unmountWebPopup).not.toHaveBeenCalled();
  });

  it('keeps an auto-rendered block on navigation once show() asked for it', async () => {
    window.history.replaceState({}, '', '/shop');
    const { widget } = await start([{ ...EMBEDDED, matching_page_rules: [{ path: '/shop', operator: 'STARTS_WITH' }] }]);
    await widget.show('EMBEDDED-1');

    navigate('/about');

    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
    expect(renderEmbeddedWebPopup).toHaveBeenCalledTimes(1);
  });

  it('removes the block when its element leaves the page', async () => {
    const { widget } = await start([API_ONLY]);
    await widget.show('EMBEDDED-1');

    document.body.innerHTML = '';
    navigate('/about');

    expect(unmountWebPopup).toHaveBeenCalledTimes(1);

    document.body.innerHTML = '<div id="promo"></div>';
    navigate('/next');

    expect(blocksIn('#promo')).toEqual([]);
  });

  // An auto-trigger campaign: the auto pass would otherwise move it into the new first match.
  it('keeps the block in its element when another element becomes the first match', async () => {
    const { widget } = await start([EMBEDDED]);
    await widget.show('EMBEDDED-1');

    document.body.insertAdjacentHTML('afterbegin', '<div id="promo" class="newer"></div>');
    navigate('/next');

    expect(blocksIn('.newer')).toEqual([]);
    expect(document.getElementById(blockId('EMBEDDED-1'))?.parentElement?.className).toBe('');
    expect(renderEmbeddedWebPopup).toHaveBeenCalledTimes(1);
    expect(unmountWebPopup).not.toHaveBeenCalled();
  });

  it('logs a missing element on every call', async () => {
    const { widget } = await start([{ ...API_ONLY, css_selector: '#absent' }]);
    const debug = jest.spyOn(Logger, 'debug');

    await widget.show('EMBEDDED-1');
    await widget.show('EMBEDDED-1');

    expect(debug.mock.calls.filter(([message]) => String(message).includes('nothing matches'))).toHaveLength(2);
    debug.mockRestore();
  });

  it('leaves the visible popup on screen', async () => {
    const { widget } = await start([POPUP, API_ONLY]);
    await nextMacrotask();

    await widget.show('EMBEDDED-1');

    expect(widget.getVisibleCode()).toBe('POPUP-1');
    expect(blocksIn('#promo')).toEqual([blockId('EMBEDDED-1')]);
  });
});

describe('EMBEDDED form values', () => {
  it('binds each block to its own campaign, also when they share a content', async () => {
    const { pw } = await start([
      { ...EMBEDDED, code: 'A' },
      { ...EMBEDDED, code: 'B' },
    ]);

    const [[, , handlersA], [, , handlersB]] = (<jest.Mock>renderEmbeddedWebPopup).mock.calls;
    await handlersA.onSubmitFormValues(VALUES);
    await handlersB.onSubmitFormValues(VALUES);

    expect((<jest.Mock>pw.api.submitPopupForm).mock.calls).toEqual([['A', VALUES], ['B', VALUES]]);
  });
});
