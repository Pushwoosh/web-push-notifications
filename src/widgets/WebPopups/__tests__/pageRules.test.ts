import { type Pushwoosh } from '../../../core/Pushwoosh';
import { renderWebPopup } from '../renderer';
import { type PageRule, type WebPopup } from '../types';
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

type PageConditions = Pick<WebPopup, 'matching_pages' | 'matching_page_rules' | 'excluded_pages'>;

const POPUP: WebPopup = {
  code: 'POPUP-1',
  popup_form_content_code: 'CONTENT-1',
  device_type: 'ALL',
  visitors_type: 'ALL',
  matching_pages: [],
  delay: 0,
  frequency: 'EVERY_VISIT',
  trigger_type: 'PAGE_LOAD',
};

const EMBEDDED: WebPopup = { ...POPUP, code: 'EMBEDDED-1', kind: 'EMBEDDED', css_selector: '#promo' };

const include = (operator: PageRule['operator'], path: string): PageConditions => (
  { matching_pages: [], matching_page_rules: [{ operator, path }] }
);

const exclude = (operator: PageRule['operator'], path: string): PageConditions => (
  { matching_pages: [], excluded_pages: [{ operator, path }] }
);

const legacy = (path: string): PageConditions => ({ matching_pages: [path] });

// [rules, page as the site navigates to it, shown]
const CASES: Array<[string, PageConditions, string, boolean]> = [
  ['EQUALS cyrillic', include('EQUALS', '/каталог/обувь'), '/каталог/обувь', true],
  ['EQUALS cyrillic, parent page', include('EQUALS', '/каталог/обувь'), '/каталог/', false],
  ['STARTS_WITH hebrew', include('STARTS_WITH', '/חדשות/'), '/חדשות/2026/x', true],
  ['STARTS_WITH hebrew, other page', include('STARTS_WITH', '/חדשות/'), '/about', false],
  ['EQUALS with a dot', include('EQUALS', '/page.html'), '/page.html', true],
  ['EQUALS with a space', include('EQUALS', '/my page'), '/my%20page', true],
  ['EQUALS lowercase on an uppercase page', include('EQUALS', '/catalog/обувь'), '/CATALOG/ОБУВЬ', true],
  ['EQUALS saved with capitals', include('EQUALS', '/Catalog/Обувь'), '/catalog/обувь', true],
  ['STARTS_WITH latin', include('STARTS_WITH', '/welcome'), '/welcome/tour', true],
  ['STARTS_WITH latin, other page', include('STARTS_WITH', '/welcome'), '/projects', false],
  ['excluded hebrew', exclude('STARTS_WITH', '/חדשות/'), '/חדשות/x', false],
  ['excluded hebrew, other page', exclude('STARTS_WITH', '/חדשות/'), '/about', true],
  ['excluded with a dot', exclude('EQUALS', '/page.html'), '/page.html', false],
  ['excluded latin', exclude('EQUALS', '/projects'), '/projects', false],
  ['legacy cyrillic', legacy('/каталог/обувь'), '/каталог/обувь', true],
  ['legacy hebrew, other page', legacy('/חדשות/'), '/about', false],
  ['legacy with a dot and capitals', legacy('/Page.HTML'), '/page.html', true],
];

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

// Delay timers are window.setTimeout(…, delay * 1000): a delay-0 popup shows on the next macrotask.
const nextMacrotask = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const hasBlock = (): boolean => document.getElementById('pushwoosh-web-popups-embedded-EMBEDDED-1') !== null;

// A stub Navigation API: the widget prefers it, so no popstate listeners or href polling outlive the test.
let navigation: EventTarget;

beforeEach(() => {
  navigation = new EventTarget();
  Object.defineProperty(window, 'navigation', { value: navigation, configurable: true });
  Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true });
  document.body.innerHTML = '<div id="promo"></div>';
});

afterEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

describe('page rules against the page path', () => {
  it.each(CASES)('popup, %s', async (_name, conditions, page, shown) => {
    window.history.replaceState({}, '', page);

    await new WebPopupsWidget(buildPw([{ ...POPUP, ...conditions }])).run();
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(shown ? 1 : 0);
  });

  it.each(CASES)('inline block, %s', async (_name, conditions, page, shown) => {
    window.history.replaceState({}, '', page);

    await new WebPopupsWidget(buildPw([{ ...EMBEDDED, ...conditions }])).run();

    expect(hasBlock()).toBe(shown);
  });

  it('checks the page path again on SPA navigation', async () => {
    await new WebPopupsWidget(buildPw([{ ...EMBEDDED, ...include('STARTS_WITH', '/каталог/') }])).run();
    expect(hasBlock()).toBe(false);

    window.history.pushState({}, '', '/Каталог/Обувь');
    navigation.dispatchEvent(new Event('currententrychange'));

    expect(hasBlock()).toBe(true);
  });

  it('skips a rule with a null path and checks the others', async () => {
    window.history.replaceState({}, '', '/catalog');
    const rules = [<PageRule><unknown>{ operator: 'STARTS_WITH', path: null }, { operator: 'EQUALS', path: '/catalog' }];

    await new WebPopupsWidget(buildPw([{ ...POPUP, matching_page_rules: rules }])).run();
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });
});
