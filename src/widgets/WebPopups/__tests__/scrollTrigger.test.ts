import { type Pushwoosh } from '../../../core/Pushwoosh';
import { renderWebPopup } from '../renderer';
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

jest.mock('@pushwoosh/websdk-common/web-popups', () => ({
  collectWebPopupFormCodes: jest.fn(() => []),
  collectWebPopupProductSlots: jest.fn(() => []),
  loadWebPopupProducts: jest.fn((host, slot) => host.load(slot)),
  webPopupExpired: jest.fn(() => false),
  webPopupHasForm: jest.fn(() => false),
}));

const SCROLL: WebPopup = {
  code: 'SCROLL-1',
  popup_form_content_code: 'CONTENT-1',
  device_type: 'ALL',
  visitors_type: 'ALL',
  matching_pages: [],
  delay: 0,
  frequency: 'EVERY_VISIT',
  trigger_type: 'SCROLL',
  scroll_depth: 50,
};

const PAGE_LOAD: WebPopup = { ...SCROLL, code: 'PAGE-LOAD-1', trigger_type: 'PAGE_LOAD', scroll_depth: 0 };

// A 4000 px page in an 800 px window: at the top the middle of the screen is at 10%, scrollY 1600 puts it at 50%.
const VIEWPORT_HEIGHT = 800;
const LONG_PAGE = 4000;

function buildPw(popupForms: Array<WebPopup>) {
  return <Pushwoosh><unknown>{
    initParams: {},
    moduleRegistry: {},
    platformChecker: { formFactor: 'DESKTOP' },
    getPushPermissionStatus: jest.fn(() => 'not_determined'),
    addSdkEventHandler: jest.fn(),
    addEventHandler: jest.fn(),
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
    },
    dispatchEvent: jest.fn(),
  };
}

// jsdom lays nothing out: the page height and the scroll position are set by hand.
function setPageHeight(height: number): void {
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: height, configurable: true });
}

// jsdom has no ResizeObserver: a stub the tests notify by hand.
class FakeResizeObserver {
  static instances: Array<FakeResizeObserver> = [];

  readonly callback: ResizeObserverCallback;

  readonly targets = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  disconnect(): void {
    this.targets.clear();
  }
}

const observedTargets = (): Array<Element> => FakeResizeObserver.instances.flatMap((observer) => [...observer.targets]);

// The page height changes with no scroll or resize event, as when an SPA draws its route.
function resizePage(height: number): void {
  setPageHeight(height);
  FakeResizeObserver.instances.forEach((observer) => {
    const records = [...observer.targets].map((target) => <ResizeObserverEntry>{ target });
    if (records.length > 0) {
      observer.callback(records, <ResizeObserver><unknown>observer);
    }
  });
}

function scrollPageTo(scrollY: number): void {
  Object.defineProperty(window, 'scrollY', { value: scrollY, configurable: true });
  window.dispatchEvent(new Event('scroll'));
}

const nextMacrotask = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

// The widget measures once per animation frame; its frame was requested first, so it has run by then.
const nextFrame = (): Promise<void> => new Promise((resolve) => {
  window.requestAnimationFrame(() => resolve());
});

// A reached depth queues the popup on the next macrotask, as a 0 s delay does.
async function scrollAndWait(scrollY: number): Promise<void> {
  scrollPageTo(scrollY);
  await nextFrame();
  await nextMacrotask();
}

// Widgets outlive their test and listen on the shared window: hideAll() in afterEach stops their scroll watch.
const widgets: Array<WebPopupsWidget> = [];

async function start(popupForms: Array<WebPopup>): Promise<{ widget: WebPopupsWidget; pw: Pushwoosh }> {
  const pw = buildPw(popupForms);
  const widget = new WebPopupsWidget(pw);
  widgets.push(widget);
  await widget.run();

  return { widget, pw };
}

let navigation: EventTarget;

beforeEach(() => {
  navigation = new EventTarget();
  Object.defineProperty(window, 'navigation', { value: navigation, configurable: true });
  Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true });
  FakeResizeObserver.instances = [];
  Object.defineProperty(window, 'ResizeObserver', { value: FakeResizeObserver, configurable: true });
  Object.defineProperty(document, 'scrollingElement', { value: document.documentElement, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_HEIGHT, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  setPageHeight(LONG_PAGE);
});

afterEach(() => {
  widgets.splice(0).forEach((widget) => widget.hideAll());
  jest.restoreAllMocks();
  jest.clearAllMocks();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

describe('SCROLL trigger', () => {
  it('waits in the waiting state until the middle of the screen reaches the depth, then shows', async () => {
    const { widget, pw } = await start([SCROLL]);
    await nextMacrotask();

    expect(renderWebPopup).not.toHaveBeenCalled();
    expect(widget.getState()).toMatchObject({ waiting: ['SCROLL-1'], queued: [] });
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledWith('SCROLL-1', 1);

    await scrollAndWait(1560);
    expect(renderWebPopup).not.toHaveBeenCalled();

    await scrollAndWait(1600);
    expect(renderWebPopup).toHaveBeenCalledTimes(1);
    expect(pw.dispatchEvent).toHaveBeenCalledWith('show-web-popup', { code: 'SCROLL-1', trigger: 'auto' });
  });

  it('shows at once on a page that does not scroll', async () => {
    setPageHeight(VIEWPORT_HEIGHT);

    await start([{ ...SCROLL, scroll_depth: 70 }]);
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });

  it('counts the page end from 1 px before it', async () => {
    await start([{ ...SCROLL, scroll_depth: 100 }]);

    await scrollAndWait(LONG_PAGE - VIEWPORT_HEIGHT - 2);
    expect(renderWebPopup).not.toHaveBeenCalled();

    await scrollAndWait(LONG_PAGE - VIEWPORT_HEIGHT - 1);
    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });

  it('measures again when the window is resized', async () => {
    await start([SCROLL]);

    Object.defineProperty(window, 'innerHeight', { value: LONG_PAGE, configurable: true });
    window.dispatchEvent(new Event('resize'));
    await nextFrame();
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });

  it('measures again when the page height changes without a scroll', async () => {
    await start([SCROLL]);
    expect(observedTargets()).toEqual([document.documentElement]);

    resizePage(VIEWPORT_HEIGHT);
    await nextFrame();
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });

  it('does not wait for its delay', async () => {
    setPageHeight(VIEWPORT_HEIGHT);

    await start([{ ...SCROLL, delay: 30 }]);
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['absent', undefined, true],
    ['0', 0, true],
    ['negative', -10, true],
    ['not a number', <number><unknown>'50', true],
    ['NaN', NaN, true],
    ['30, at 10%', 30, false],
    ['over 100, counted as 100', 150, false],
  ])('scroll_depth %s at the top of a long page shows it: %p', async (_name, depth, shown) => {
    await start([{ ...SCROLL, scroll_depth: depth }]);
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(shown ? 1 : 0);
  });

  it('stays queued when the visitor scrolls back', async () => {
    const { widget } = await start([PAGE_LOAD, SCROLL]);
    await nextMacrotask();
    expect(widget.getState()).toMatchObject({ visible: 'PAGE-LOAD-1', waiting: ['SCROLL-1'] });

    await scrollAndWait(1600);
    await scrollAndWait(0);

    expect(widget.getState()).toMatchObject({ visible: 'PAGE-LOAD-1', queued: ['SCROLL-1'], waiting: [] });
  });

  it('queues ahead of a popup with a shorter delay: its own delay counts as 0', async () => {
    jest.useFakeTimers();
    try {
      const { widget } = await start([PAGE_LOAD, { ...PAGE_LOAD, code: 'DELAY-1', delay: 1 }, { ...SCROLL, delay: 30 }]);
      await jest.advanceTimersByTimeAsync(1000);
      expect(widget.getState()).toMatchObject({ visible: 'PAGE-LOAD-1', queued: ['DELAY-1'] });

      scrollPageTo(1600);
      await jest.advanceTimersByTimeAsync(20);

      expect(widget.getState()).toMatchObject({ queued: ['SCROLL-1', 'DELAY-1'] });
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the server order with a 0 s PAGE_LOAD when its depth is already reached', async () => {
    setPageHeight(VIEWPORT_HEIGHT);

    const { widget } = await start([PAGE_LOAD, SCROLL]);
    expect(renderWebPopup).not.toHaveBeenCalled();
    await nextMacrotask();

    expect(widget.getState()).toMatchObject({ visible: 'PAGE-LOAD-1', queued: ['SCROLL-1'] });
  });

  it('renders an EMBEDDED one at once', async () => {
    document.body.innerHTML = '<div id="promo"></div>';

    await start([{ ...SCROLL, kind: 'EMBEDDED', css_selector: '#promo' }]);

    expect(document.getElementById('pushwoosh-web-popups-embedded-SCROLL-1')).not.toBeNull();
  });
});

describe('SCROLL trigger teardown', () => {
  it('show() takes a waiting popup out of the scroll watch', async () => {
    const { widget } = await start([SCROLL]);

    await expect(widget.show('SCROLL-1')).resolves.toBe(true);
    expect(observedTargets()).toEqual([]);
    await scrollAndWait(1600);

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
    expect(widget.getState()).toMatchObject({ visible: 'SCROLL-1', queued: [] });
  });

  it('hideAll() dismisses a waiting popup for good', async () => {
    const { widget } = await start([SCROLL]);

    widget.hideAll();
    expect(observedTargets()).toEqual([]);
    resizePage(VIEWPORT_HEIGHT);
    await scrollAndWait(1600);
    await nextMacrotask();

    expect(renderWebPopup).not.toHaveBeenCalled();
  });

  it('navigation away removes its listeners, and a matching page arms it again from the current position', async () => {
    window.history.replaceState({}, '', '/article');
    const added = jest.spyOn(window, 'addEventListener');
    const removed = jest.spyOn(window, 'removeEventListener');
    const { widget } = await start([{ ...SCROLL, matching_page_rules: [{ operator: 'EQUALS', path: '/article' }] }]);

    window.history.pushState({}, '', '/catalog');
    navigation.dispatchEvent(new Event('currententrychange'));

    expect(widget.getState()).toMatchObject({ waiting: [] });
    expect(observedTargets()).toEqual([]);
    const scrollListeners = added.mock.calls.filter(([type]) => ['scroll', 'resize'].includes(<string>type));
    expect(scrollListeners).toHaveLength(2);
    scrollListeners.forEach(([type, listener]) => {
      expect(removed).toHaveBeenCalledWith(type, listener);
    });

    await scrollAndWait(1600);
    window.history.pushState({}, '', '/article');
    navigation.dispatchEvent(new Event('currententrychange'));
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });
});
