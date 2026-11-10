import { collectWebPopupProductSlots, loadWebPopupProducts, webPopupHasForm } from '@pushwoosh/websdk-common/web-popups';

import { type Pushwoosh } from '../../../core/Pushwoosh';
import { QUEUE_GAP_MS } from '../constants';
import { renderEmbeddedWebPopup } from '../embeddedRenderer';
import { renderWebPopup } from '../renderer';
import { type WebPlacement, type WebPopup } from '../types';
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

const INLINE: WebPlacement = {
  hash: 'HASH-INLINE',
  content_code: 'CONTENT-INLINE',
  kind: 'WEB_PLACEMENT_KIND_EMBEDDED',
  css_selector: '#cart-slot',
  priority: 'WEB_PLACEMENT_PRIORITY_MEDIUM',
  expires_at: null,
  dismissible: false,
};

const POPUP: WebPlacement = {
  hash: 'HASH-POPUP',
  content_code: 'CONTENT-POPUP',
  kind: 'WEB_PLACEMENT_KIND_POPUP',
  priority: 'WEB_PLACEMENT_PRIORITY_MEDIUM',
  expires_at: null,
};

const CAMPAIGN: WebPopup = {
  code: 'CAMPAIGN-1',
  popup_form_content_code: 'CONTENT-OF-CAMPAIGN',
  device_type: 'ALL',
  visitors_type: 'ALL',
  matching_pages: [],
  delay: 0,
  frequency: 'EVERY_VISIT',
  trigger_type: 'PAGE_LOAD',
  kind: 'EMBEDDED',
  css_selector: '#cart-slot',
};

type FakePw = Pushwoosh & { webPlacementsSink: ((placements: Array<WebPlacement>) => void) | null };

function buildPw(options: {
  features?: object;
  pulls?: Array<Array<WebPlacement>>;
  buffered?: Array<WebPlacement>;
  popupForms?: Array<WebPopup>;
  initParams?: object;
} = {}): FakePw {
  const pulls = [...(options.pulls ?? [[]])];
  let buffered = options.buffered ?? [];

  return <FakePw><unknown>{
    initParams: options.initParams ?? {},
    moduleRegistry: {},
    platformChecker: { formFactor: 'DESKTOP' },
    getPushPermissionStatus: jest.fn(() => 'not_determined'),
    addSdkEventHandler: jest.fn(),
    addEventHandler: jest.fn(),
    webPlacementsSink: null,
    takeWebPlacements: jest.fn(() => {
      const taken = buffered;
      buffered = [];
      return taken;
    }),
    data: {
      getFeatures: jest.fn().mockResolvedValue(options.features ?? { web_placements: { enabled: true } }),
      getIsRecurringVisitor: jest.fn().mockResolvedValue(false),
      setIsRecurringVisitor: jest.fn().mockResolvedValue(undefined),
      getShownWebPopups: jest.fn().mockResolvedValue([]),
      addShownWebPopup: jest.fn().mockResolvedValue(undefined),
      getHwid: jest.fn().mockResolvedValue('hwid'),
    },
    api: {
      ensureDeviceRegistered: jest.fn().mockResolvedValue(undefined),
      getPopupForms: jest.fn().mockResolvedValue(options.popupForms ?? []),
      getPopupFormContent: jest.fn().mockResolvedValue({ json: '{}' }),
      recordPopupFormEvent: jest.fn().mockResolvedValue(undefined),
      getWebPlacements: jest.fn(() => Promise.resolve(pulls.length > 1 ? pulls.shift()! : pulls[0])),
      trackWebPlacement: jest.fn().mockResolvedValue(undefined),
    },
    dispatchEvent: jest.fn(),
  };
}

const flush = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const blockId = (code: string): string => `pushwoosh-web-popups-embedded-${code}`;

function blocksIn(selector: string): Array<string> {
  return Array.from(document.querySelector(selector)?.children ?? []).map((child) => child.id);
}

// Each test gets its own navigation target, so widgets of earlier tests never hear its navigations.
let navigation: EventTarget;

function navigate(): void {
  navigation.dispatchEvent(new Event('currententrychange'));
}

beforeEach(() => {
  document.body.innerHTML = '<div id="cart-slot"></div>';
  navigation = new EventTarget();
  Object.defineProperty(window, 'navigation', { value: navigation, configurable: true });
});

afterEach(() => {
  jest.clearAllMocks();
  (<jest.Mock>webPopupHasForm).mockReturnValue(false);
  (<jest.Mock>collectWebPopupProductSlots).mockReturnValue([]);
  (<jest.Mock>loadWebPopupProducts).mockImplementation((host, slot) => host.load(slot));
  document.body.innerHTML = '';
  Object.defineProperty(window, 'navigation', { value: undefined, configurable: true });
});

describe('journey web placements', () => {
  it('pulls placements on load and renders an inline one ahead of the campaigns on its element', async () => {
    const pw = buildPw({ pulls: [[INLINE]], popupForms: [CAMPAIGN] });

    await new WebPopupsWidget(pw).run();

    expect(pw.api.getWebPlacements).toHaveBeenCalledTimes(1);
    expect(pw.api.getPopupFormContent).toHaveBeenCalledWith('CONTENT-INLINE');
    expect(blocksIn('#cart-slot')).toEqual([blockId('HASH-INLINE'), blockId('CAMPAIGN-1')]);
    // No IntersectionObserver in jsdom: the block counts as seen at once, reported by hash.
    expect(pw.api.trackWebPlacement).toHaveBeenCalledWith('HASH-INLINE', 'WEB_PLACEMENT_ACTION_SHOW');
    expect(pw.api.recordPopupFormEvent).not.toHaveBeenCalledWith('HASH-INLINE', expect.anything());
  });

  it('pulls placements for an application without campaigns', async () => {
    const pw = buildPw({ features: { popup_forms: { enabled: false }, web_placements: { enabled: true } }, pulls: [[INLINE]] });

    await new WebPopupsWidget(pw).run();

    expect(pw.api.getPopupForms).not.toHaveBeenCalled();
    expect(blocksIn('#cart-slot')).toEqual([blockId('HASH-INLINE')]);
  });

  it('keeps one placement per element: the higher priority wins', async () => {
    const low = { ...INLINE, hash: 'HASH-LOW', priority: 'WEB_PLACEMENT_PRIORITY_LOW' };
    const high = { ...INLINE, hash: 'HASH-HIGH', priority: 'WEB_PLACEMENT_PRIORITY_HIGH' };
    const pw = buildPw({ pulls: [[low, high]] });

    await new WebPopupsWidget(pw).run();

    expect(blocksIn('#cart-slot')).toEqual([blockId('HASH-HIGH')]);
  });

  it('applies the width and closes a dismissible block for good', async () => {
    const pw = buildPw({ pulls: [[{ ...INLINE, width: '320px', dismissible: true }]] });
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    const host = <HTMLElement>document.getElementById(blockId('HASH-INLINE'));
    expect(host.style.width).toBe('320px');

    host.shadowRoot!.querySelector<HTMLButtonElement>('[data-pushwoosh-placement-dismiss]')!.click();

    expect(document.getElementById(blockId('HASH-INLINE'))).toBeNull();
    expect(pw.api.trackWebPlacement).toHaveBeenCalledWith('HASH-INLINE', 'WEB_PLACEMENT_ACTION_DISMISS');

    // A pull answered before the server saw the dismiss does not bring it back.
    navigate();
    await flush();
    expect(document.getElementById(blockId('HASH-INLINE'))).toBeNull();
  });

  it('lets the content close buttons of a dismissible block only dismiss it for good', async () => {
    const pw = buildPw({ pulls: [[{ ...INLINE, dismissible: true }]] });
    await new WebPopupsWidget(pw).run();
    const pinned = buildPw({ pulls: [[INLINE]] });
    await new WebPopupsWidget(pinned).run();

    const calls = (<jest.Mock>renderEmbeddedWebPopup).mock.calls;
    expect(calls[1][5]).toBeUndefined();
    calls[0][5]();

    expect(pw.api.trackWebPlacement).toHaveBeenCalledWith('HASH-INLINE', 'WEB_PLACEMENT_ACTION_DISMISS');
  });

  it('reports a content close button of a placement as a dismiss only, never a click', async () => {
    const closeButtonCalling = (onClose: () => void, container: HTMLElement): void => {
      const button = document.createElement('button');
      button.textContent = 'Keep shopping';
      button.addEventListener('click', onClose);
      container.appendChild(button);
    };
    (<jest.Mock>renderEmbeddedWebPopup).mockImplementationOnce((container, _params, _handlers, _scheme, _remove, onRequestClose) => {
      closeButtonCalling(onRequestClose, container);
    });
    (<jest.Mock>renderWebPopup).mockImplementationOnce((container, _params, onRequestClose) => {
      closeButtonCalling(onRequestClose, container);
    });
    const pw = buildPw({ pulls: [[{ ...INLINE, dismissible: true }, POPUP]] });
    await new WebPopupsWidget(pw).run();
    await flush();

    document.getElementById(blockId('HASH-INLINE'))!.shadowRoot!.querySelector('button:not([data-pushwoosh-placement-dismiss])')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    const popupButton = [...document.querySelectorAll('*')].map((el) => el.shadowRoot?.querySelector('button') ?? null)
      .find((button) => button?.textContent === 'Keep shopping' && !button.closest('[id^="pushwoosh-web-popups-embedded"]'));
    popupButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    const actions = (<jest.Mock>pw.api.trackWebPlacement).mock.calls.filter(([, action]) => action !== 'WEB_PLACEMENT_ACTION_SHOW');
    expect(actions).toEqual([
      ['HASH-INLINE', 'WEB_PLACEMENT_ACTION_DISMISS'],
      ['HASH-POPUP', 'WEB_PLACEMENT_ACTION_DISMISS'],
    ]);
  });

  it('takes an inline block off the page once the server stops returning it', async () => {
    const pw = buildPw({ pulls: [[INLINE], []] });
    await new WebPopupsWidget(pw).run();
    expect(blocksIn('#cart-slot')).toEqual([blockId('HASH-INLINE')]);

    navigate();
    await flush();

    expect(pw.api.getWebPlacements).toHaveBeenCalledTimes(2);
    expect(blocksIn('#cart-slot')).toEqual([]);
  });

  it('drops a waiting popup the server stops returning, but lets the visible one finish', async () => {
    const SECOND: WebPlacement = { ...POPUP, hash: 'HASH-POPUP-2', content_code: 'CONTENT-POPUP-2' };
    const pw = buildPw({ pulls: [[POPUP, SECOND], []] });
    await new WebPopupsWidget(pw).run();
    await flush();
    expect(renderWebPopup).toHaveBeenCalledTimes(1);

    navigate();
    await flush();
    const close = <() => void>(<jest.Mock>renderWebPopup).mock.calls[0][2];
    close();
    navigate();
    await new Promise((resolve) => {
      setTimeout(resolve, QUEUE_GAP_MS + 50);
    });

    expect(pw.api.getWebPlacements).toHaveBeenCalledTimes(3);
    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });

  it('shows a popup a postEvent response brought, once, with its SHOW', async () => {
    const pw = buildPw({ features: {} });
    await new WebPopupsWidget(pw).run();

    expect(pw.api.getWebPlacements).not.toHaveBeenCalled();

    pw.webPlacementsSink!([POPUP]);
    await flush();
    await flush();
    pw.webPlacementsSink!([POPUP]);
    await flush();
    await flush();

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
    expect(pw.api.trackWebPlacement).toHaveBeenCalledTimes(1);
    expect(pw.api.trackWebPlacement).toHaveBeenCalledWith('HASH-POPUP', 'WEB_PLACEMENT_ACTION_SHOW');
    expect(pw.api.recordPopupFormEvent).not.toHaveBeenCalled();
  });

  it('renders what the core buffered before the widget loaded', async () => {
    const pw = buildPw({ features: { popup_forms: { enabled: false } }, buffered: [INLINE], pulls: [[]] });

    await new WebPopupsWidget(pw).run();

    expect(blocksIn('#cart-slot')).toEqual([blockId('HASH-INLINE')]);
  });

  it('skips a placement whose hideWhenEmpty products block has nothing', async () => {
    (<jest.Mock>collectWebPopupProductSlots).mockReturnValue([{ type: 'products', key: 'recs', hideWhenEmpty: true }]);
    (<jest.Mock>loadWebPopupProducts).mockResolvedValue([]);
    const pw = buildPw({ pulls: [[INLINE, POPUP]] });

    await new WebPopupsWidget(pw).run();
    await flush();

    expect(renderEmbeddedWebPopup).not.toHaveBeenCalled();
    expect(renderWebPopup).not.toHaveBeenCalled();
  });

  it('refuses a content with a form: it submits under a campaign code', async () => {
    (<jest.Mock>webPopupHasForm).mockReturnValue(true);
    const pw = buildPw({ pulls: [[INLINE, POPUP]] });

    await new WebPopupsWidget(pw).run();
    await flush();

    expect(renderEmbeddedWebPopup).not.toHaveBeenCalled();
    expect(renderWebPopup).not.toHaveBeenCalled();
  });

  it('skips an expired placement', async () => {
    const pw = buildPw({ pulls: [[{ ...INLINE, expires_at: '2000-01-01T00:00:00Z' }]] });

    await new WebPopupsWidget(pw).run();

    expect(pw.api.getPopupFormContent).not.toHaveBeenCalled();
    expect(blocksIn('#cart-slot')).toEqual([]);
  });

  it('ignores placements when the site switched them off', async () => {
    const pw = buildPw({ pulls: [[INLINE]], initParams: { webPlacements: { enable: false } } });

    await new WebPopupsWidget(pw).run();

    expect(pw.takeWebPlacements).not.toHaveBeenCalled();
    expect(pw.webPlacementsSink).toBeNull();
    expect(pw.api.getWebPlacements).not.toHaveBeenCalled();
  });
});
