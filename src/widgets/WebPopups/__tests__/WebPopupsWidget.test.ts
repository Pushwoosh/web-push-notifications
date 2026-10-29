import { webPopupExpired, webPopupHasForm } from '@pushwoosh/websdk-common/web-popups';

import { type Pushwoosh } from '../../../core/Pushwoosh';
import { type TPushPermissionStatus } from '../../../services/PushService/pushPermissionStatus';
import { renderWebPopup, type WebPopupSubmitHandlers } from '../renderer';
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
  webPopupHasForm: jest.fn(() => false),
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

const VALUES = { email: 'visitor@example.com', tags: { City: 'Berlin' }, policyAccepted: true };

let browserStatus: TPushPermissionStatus = 'not_determined';

const nextMacrotask = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

// What the core's change-permission brings; the widget re-reads the status itself.
function changePermission(pw: Pushwoosh): void {
  const call = (<jest.Mock>pw.addSdkEventHandler).mock.calls.find(([name]) => name === 'change-permission');
  call?.[1]({ permission: 'granted', eventId: 'event' });
}

function buildPw(features: object, popupForms: Array<WebPopup> = []) {
  return <Pushwoosh><unknown>{
    initParams: {},
    moduleRegistry: {},
    platformChecker: { formFactor: 'DESKTOP' },
    getPushPermissionStatus: jest.fn(() => browserStatus),
    addSdkEventHandler: jest.fn(),
    addEventHandler: jest.fn(),
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
      submitPopupForm: jest.fn().mockResolvedValue({ result: 'OK' }),
    },
    dispatchEvent: jest.fn(),
  };
}

afterEach(() => {
  jest.clearAllMocks();
  browserStatus = 'not_determined';
  (<jest.Mock>webPopupHasForm).mockReturnValue(false);
  document.body.innerHTML = '';
  Object.defineProperty(window, 'navigation', { value: undefined, configurable: true });
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

  it('neither prefetches nor auto-shows a frequency-capped popup, but show() still opens it', async () => {
    const pw = buildPw({}, [{ ...CAMPAIGN, frequency: 'ONCE' }]);
    (<jest.Mock>pw.data.getShownWebPopups).mockResolvedValue(['CAMPAIGN-1']);
    const widget = new WebPopupsWidget(pw);
    await widget.run();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(pw.api.getPopupFormContent).not.toHaveBeenCalled();
    expect(renderWebPopup).not.toHaveBeenCalled();

    await expect(widget.show('CAMPAIGN-1')).resolves.toBe(true);
    expect(pw.api.getPopupFormContent).toHaveBeenCalledTimes(1);
  });

  // show() refused for an expired countdown leaves the entry idle with content: only frequency keeps it off.
  it('keeps a frequency-capped popup with loaded content out of automatic display', async () => {
    const navigation = new EventTarget();
    Object.defineProperty(window, 'navigation', { value: navigation, configurable: true });

    const pw = buildPw({}, [{ ...CAMPAIGN, frequency: 'ONCE' }]);
    (<jest.Mock>pw.data.getShownWebPopups).mockResolvedValue(['CAMPAIGN-1']);
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    (<jest.Mock>webPopupExpired).mockReturnValueOnce(true);
    await expect(widget.show('CAMPAIGN-1')).resolves.toBe(false);

    navigation.dispatchEvent(new Event('currententrychange'));
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(renderWebPopup).not.toHaveBeenCalled();
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

  it('submits the form values of a popup under its campaign code', async () => {
    const pw = buildPw({}, [{ ...CAMPAIGN, trigger_type: 'API' }]);
    const widget = new WebPopupsWidget(pw);
    await widget.run();
    await widget.show('CAMPAIGN-1');

    const handlers = <WebPopupSubmitHandlers>(<jest.Mock>renderWebPopup).mock.calls[0][3];

    await expect(handlers.onSubmitFormValues(VALUES)).resolves.toBe('ok');
    expect(pw.api.submitPopupForm).toHaveBeenCalledWith('CAMPAIGN-1', VALUES);
  });

  it('does not show a content with a form opened without a campaign, but shows its campaign', async () => {
    (<jest.Mock>webPopupHasForm).mockReturnValue(true);
    const pw = buildPw({}, [{ ...CAMPAIGN, trigger_type: 'API' }]);
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    await expect(widget.show('CONTENT-OF-CAMPAIGN')).resolves.toBe(false);
    expect(renderWebPopup).not.toHaveBeenCalled();

    await expect(widget.show('CAMPAIGN-1')).resolves.toBe(true);
    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });
});

describe('push permission status', () => {
  it.each([
    ['DEFAULT', 'not_determined', true],
    ['DEFAULT', 'granted_explicit', false],
    ['GRANTED', 'granted_explicit', true],
    ['GRANTED', 'denied', false],
    ['DENIED', 'denied', true],
    ['DENIED', 'unsupported', false],
    ['UNSUPPORTED', 'unsupported', true],
    ['UNSUPPORTED', 'denied', false],
    ['granted', 'granted_explicit', true],
    ['ALL', 'denied', true],
    ['', 'denied', true],
    ['SOMEDAY', 'denied', true],
    [undefined, 'denied', true],
  ] as const)('a %p campaign shows by itself to a %s visitor: %p', async (condition, status, shown) => {
    browserStatus = status;
    await new WebPopupsWidget(buildPw({}, [{ ...CAMPAIGN, push_permission_status: condition }])).run();
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(shown ? 1 : 0);
  });

  it.each([
    ['has no getPushPermissionStatus', (pw: Pushwoosh) => {
      delete (<{ getPushPermissionStatus?: unknown }><unknown>pw).getPushPermissionStatus;
    }],
    ['throws reading the status', (pw: Pushwoosh) => {
      (<jest.Mock>pw.getPushPermissionStatus).mockImplementation(() => {
        throw new Error('outside the push package');
      });
    }],
  ])('shows only ALL campaigns when the core %s', async (_name, breakCore) => {
    const pw = buildPw({}, [
      { ...CAMPAIGN, code: 'DENIED-ONLY', push_permission_status: 'DENIED' },
      { ...CAMPAIGN, code: 'EVERYONE', push_permission_status: 'ALL' },
    ]);
    breakCore(pw);
    await new WebPopupsWidget(pw).run();
    await nextMacrotask();

    expect(renderWebPopup).toHaveBeenCalledTimes(1);
    expect(pw.dispatchEvent).toHaveBeenCalledWith('show-web-popup', { code: 'EVERYONE', trigger: 'auto' });
  });

  it('releases waiting and queued popups that stop matching, and leaves the visible one', async () => {
    const pw = buildPw({}, [
      { ...CAMPAIGN, code: 'VISIBLE', push_permission_status: 'DEFAULT' },
      { ...CAMPAIGN, code: 'QUEUED', push_permission_status: 'DEFAULT' },
      { ...CAMPAIGN, code: 'WAITING', push_permission_status: 'DEFAULT', delay: 30 },
    ]);
    const widget = new WebPopupsWidget(pw);
    await widget.run();
    await nextMacrotask();
    expect(widget.getState()).toMatchObject({ visible: 'VISIBLE', queued: ['QUEUED'], waiting: ['WAITING'] });

    browserStatus = 'granted_explicit';
    changePermission(pw);

    expect(widget.getState()).toMatchObject({ visible: 'VISIBLE', queued: [], waiting: [] });
  });

  it('shows a campaign that starts to match only after navigation', async () => {
    const navigation = new EventTarget();
    Object.defineProperty(window, 'navigation', { value: navigation, configurable: true });
    const pw = buildPw({}, [{ ...CAMPAIGN, push_permission_status: 'GRANTED' }]);
    await new WebPopupsWidget(pw).run();

    browserStatus = 'granted_explicit';
    changePermission(pw);
    await nextMacrotask();
    expect(renderWebPopup).not.toHaveBeenCalled();

    navigation.dispatchEvent(new Event('currententrychange'));
    await nextMacrotask();
    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });

  it('listens through addEventHandler on a core without addSdkEventHandler', async () => {
    const pw = buildPw({}, [CAMPAIGN]);
    delete (<{ addSdkEventHandler?: unknown }><unknown>pw).addSdkEventHandler;

    await new WebPopupsWidget(pw).run();

    expect(pw.addEventHandler).toHaveBeenCalledWith('change-permission', expect.any(Function));
  });

  // Capped by frequency, so run() prefetches nothing: a fetch here would be show()'s own.
  it('show() refuses a campaign of another status without fetching it', async () => {
    const pw = buildPw({}, [{ ...CAMPAIGN, frequency: 'ONCE', push_permission_status: 'GRANTED' }]);
    (<jest.Mock>pw.data.getShownWebPopups).mockResolvedValue(['CAMPAIGN-1']);
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    await expect(widget.show('CAMPAIGN-1')).resolves.toBe(false);

    expect(pw.api.getPopupFormContent).not.toHaveBeenCalled();
    expect(renderWebPopup).not.toHaveBeenCalled();
  });

  it('show() keeps answering true for the popup on screen whatever the status', async () => {
    browserStatus = 'granted_explicit';
    const pw = buildPw({}, [{ ...CAMPAIGN, trigger_type: 'API', push_permission_status: 'GRANTED' }]);
    const widget = new WebPopupsWidget(pw);
    await widget.run();
    await expect(widget.show('CAMPAIGN-1')).resolves.toBe(true);

    browserStatus = 'denied';

    await expect(widget.show('CAMPAIGN-1')).resolves.toBe(true);
    expect(renderWebPopup).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'SOMEDAY'])('show() opens a campaign with the status %p', async (condition) => {
    browserStatus = 'denied';
    const pw = buildPw({}, [{ ...CAMPAIGN, trigger_type: 'API', push_permission_status: condition }]);
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    await expect(widget.show('CAMPAIGN-1')).resolves.toBe(true);
  });

  it('show() opens a content without a campaign even when the status cannot be read', async () => {
    const pw = buildPw({});
    (<jest.Mock>pw.getPushPermissionStatus).mockImplementation(() => {
      throw new Error('outside the push package');
    });
    const widget = new WebPopupsWidget(pw);
    await widget.run();

    await expect(widget.show('INBOX-CONTENT')).resolves.toBe(true);
  });
});
