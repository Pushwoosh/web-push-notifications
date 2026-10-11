import { type Pushwoosh } from '../../../core/Pushwoosh';
import { renderWebPopup } from '../renderer';
import { type WebPopup } from '../types';
import { WebPopupsWidget } from '../WebPopupsWidget';

jest.mock('../renderer', () => ({
  parseWebPopupContent: jest.fn(() => ({ overlay: false })),
  renderWebPopup: jest.fn(),
  unmountWebPopup: jest.fn(),
}));

jest.mock('@pushwoosh/websdk-common/web-popups', () => ({
  collectWebPopupFormCodes: jest.fn(() => []),
  webPopupExpired: jest.fn(() => false),
}));

const CAMPAIGN: WebPopup = {
  code: 'CAMPAIGN-1',
  popup_form_content_code: 'CONTENT-OF-CAMPAIGN',
  device_type: 'ALL',
  visitors_type: 'ALL',
  matching_pages: [],
  delay: 0,
  frequency: 'EVERY_VISIT',
  trigger_type: 'PAGE_LOAD',
};

function buildPw(features: object, popupForms: Array<WebPopup> = []) {
  return <Pushwoosh><unknown>{
    initParams: {},
    moduleRegistry: {},
    platformChecker: { formFactor: 'DESKTOP' },
    data: {
      getFeatures: jest.fn().mockResolvedValue(features),
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

afterEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
});

describe('WebPopupsWidget', () => {
  it('does nothing but report ready when webPopups.enable is false', async () => {
    const pw = <Pushwoosh><unknown>{
      initParams: { webPopups: { enable: false } },
      moduleRegistry: {},
      data: { getFeatures: jest.fn() },
      api: { ensureDeviceRegistered: jest.fn(), getPopupForms: jest.fn() },
      dispatchEvent: jest.fn(),
    };

    await new WebPopupsWidget(pw).run();

    expect(pw.data.getFeatures).not.toHaveBeenCalled();
    expect(pw.api.ensureDeviceRegistered).not.toHaveBeenCalled();
    expect(pw.dispatchEvent).toHaveBeenCalledWith('web-popups-ready', {});
  });

  it('shows a campaign by its code and records its stats', async () => {
    const pw = buildPw({}, [{ ...CAMPAIGN, trigger_type: 'API' }]);
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    await expect(widget.show('CAMPAIGN-1')).resolves.toBe(true);

    expect(pw.api.getPopupFormContent).toHaveBeenCalledWith('CONTENT-OF-CAMPAIGN');
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledWith('CAMPAIGN-1', 1);
    expect(pw.api.recordPopupFormEvent).toHaveBeenCalledWith('CAMPAIGN-1', 2);
    expect(widget.getVisibleCode()).toBe('CAMPAIGN-1');
  });

  it('shows a content code no campaign has, without popup form events', async () => {
    const pw = buildPw({}, [{ ...CAMPAIGN, trigger_type: 'API' }]);
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    await expect(widget.show('INBOX-CONTENT')).resolves.toBe(true);

    expect(pw.api.getPopupFormContent).toHaveBeenCalledWith('INBOX-CONTENT');
    expect(pw.api.recordPopupFormEvent).not.toHaveBeenCalled();
    expect(pw.dispatchEvent).toHaveBeenCalledWith('show-web-popup', { code: 'INBOX-CONTENT', trigger: 'api' });
    expect(widget.getAvailableCodes()).toEqual(['CAMPAIGN-1']);
  });

  it('resolves false without throwing when the content is not found', async () => {
    const pw = buildPw({});
    (<jest.Mock>pw.api.getPopupFormContent).mockRejectedValue(new Error('NotFound'));
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    await expect(widget.show('MISSING')).resolves.toBe(false);
    expect(widget.getVisibleCode()).toBeNull();
  });

  it('without active campaigns skips automatic display but still shows a content', async () => {
    const pw = buildPw({ popup_forms: { enabled: false } }, [CAMPAIGN]);
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    expect(pw.api.getPopupForms).not.toHaveBeenCalled();
    expect(renderWebPopup).not.toHaveBeenCalled();
    expect(pw.dispatchEvent).toHaveBeenCalledWith('web-popups-ready', {});

    await expect(widget.show('INBOX-CONTENT')).resolves.toBe(true);
    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });

  it('holds a show() called before the widget is ready until web-popups-ready', async () => {
    let releaseFeatures!: (features: object) => void;
    const pw = buildPw({});
    (<jest.Mock>pw.data.getFeatures).mockReturnValue(new Promise((resolve) => {
      releaseFeatures = resolve;
    }));
    const widget = new WebPopupsWidget(pw);
    const running = widget.run();

    const shown = widget.show('INBOX-CONTENT');
    await Promise.resolve();
    expect(pw.api.getPopupFormContent).not.toHaveBeenCalled();

    releaseFeatures({ popup_forms: { enabled: false } });
    await running;

    await expect(shown).resolves.toBe(true);
    expect(pw.dispatchEvent).toHaveBeenCalledWith('web-popups-ready', {});
  });
});
