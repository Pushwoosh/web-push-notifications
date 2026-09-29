import { type SubscriptionWidgetHistory } from '@pushwoosh/websdk-common/subscription-widget';

import { type Pushwoosh } from '../../../core/Pushwoosh';
import { PWSubscriptionWidget } from '../SubscriptionWidget';
import { type ISubscriptionWidgetParams } from '../types';

type Handlers = Record<string, () => Promise<void>>;

function buildWidget(config: ISubscriptionWidgetParams, options: {
  permission?: NotificationPermission;
  subscribed?: boolean;
  history?: SubscriptionWidgetHistory;
  pushAvailable?: boolean;
} = {}) {
  const state = { permission: options.permission ?? 'default', subscribed: options.subscribed ?? false };
  const handlers: Handlers = {};
  const pw = <Pushwoosh><unknown>{
    initParams: { subscriptionWidget: config },
    isPushAvailable: () => options.pushAvailable ?? true,
    driver: { getPermission: () => state.permission },
    isSubscribed: jest.fn(async () => state.subscribed),
    subscribe: jest.fn(async () => {
      state.permission = 'granted';
      state.subscribed = true;
    }),
    data: {
      getSubscriptionWidgetHistory: jest.fn().mockResolvedValue(options.history ?? { shownCount: 0, lastShownAt: null }),
      setSubscriptionWidgetHistory: jest.fn().mockResolvedValue(undefined),
    },
    moduleRegistry: {},
    dispatchEvent: jest.fn(),
    addEventHandler: jest.fn((name: string, handler: () => Promise<void>) => {
      handlers[name] = handler;
    }),
  };

  document.body.innerHTML = '';

  return { widget: new PWSubscriptionWidget(pw), pw, state, handlers };
}

function shadow(): ShadowRoot | null {
  return document.getElementById('pushwoosh-subscription-widget')?.shadowRoot ?? null;
}

function dialog(): HTMLElement | null {
  return shadow()?.querySelector('[role="dialog"]') ?? null;
}

function launcher(): HTMLButtonElement | null {
  return shadow()?.querySelector('button[aria-label="Subscribe to notifications"]') ?? null;
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [...shadow()!.querySelectorAll('button')].find((b) => b.textContent === text);
  if (!button) throw new Error(`no button "${text}"`);
  return button;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PWSubscriptionWidget', () => {
  it('registers its public api before run', () => {
    const { widget, pw } = buildWidget({ enable: true });

    expect(pw.moduleRegistry.subscriptionWidget).toBe(widget);
  });

  it('mounts nothing when disabled or push is unavailable', async () => {
    await buildWidget({ enable: false }).widget.run();
    expect(document.getElementById('pushwoosh-subscription-widget')).toBeNull();

    await buildWidget({ enable: true }, { pushAvailable: false }).widget.run();
    expect(document.getElementById('pushwoosh-subscription-widget')).toBeNull();
  });

  it('opens by itself after the delay and records the show', async () => {
    const { widget, pw } = buildWidget({ enable: true, display: { delay: 3 } });
    await widget.run();

    expect(dialog()).toBeNull();
    await jest.advanceTimersByTimeAsync(3000);

    expect(dialog()).not.toBeNull();
    expect(pw.dispatchEvent).toHaveBeenCalledWith('show-subscription-widget', {});
    expect(pw.data.setSubscriptionWidgetHistory).toHaveBeenCalledWith({ shownCount: 1, lastShownAt: expect.any(Number) });
  });

  it('stays closed when the capping is spent', async () => {
    const { widget } = buildWidget(
      { enable: true, display: { delay: 0, cappingCount: 1 } },
      { history: { shownCount: 1, lastShownAt: 0 } },
    );
    await widget.run();
    await jest.advanceTimersByTimeAsync(1000);

    expect(dialog()).toBeNull();
  });

  it('shows the launcher and opens the prompt from it on a launcher trigger', async () => {
    const { widget } = buildWidget({ enable: true, display: { trigger: 'launcher' } });
    await widget.run();
    await jest.advanceTimersByTimeAsync(10000);

    expect(dialog()).toBeNull();
    launcher()!.click();
    await jest.advanceTimersByTimeAsync(0);

    expect(dialog()).not.toBeNull();
    expect(launcher()).toBeNull();
  });

  it('brings the bell back once the prompt is declined', async () => {
    const { widget } = buildWidget({ enable: true, display: { trigger: 'launcher' } });
    await widget.run();
    launcher()!.click();
    await jest.advanceTimersByTimeAsync(0);

    buttonByText('Not now').click();
    await jest.advanceTimersByTimeAsync(0);

    expect(dialog()).toBeNull();
    expect(launcher()).not.toBeNull();
  });

  it('subscribes on accept, then closes and drops the launcher', async () => {
    const { widget, pw } = buildWidget({ enable: true, launcher: { enabled: true }, display: { trigger: 'manual' } });
    await widget.run();
    widget.show();
    await jest.advanceTimersByTimeAsync(0);

    buttonByText('Allow').click();
    await jest.advanceTimersByTimeAsync(0);

    expect(pw.subscribe).toHaveBeenCalled();
    expect(widget.isVisible()).toBe(false);
    expect(dialog()).toBeNull();
    expect(launcher()).toBeNull();
  });

  it('turns the prompt into the blocked explanation when the visitor denies', async () => {
    const { widget, pw, state } = buildWidget({ enable: true, display: { trigger: 'manual' } });
    (pw.subscribe as jest.Mock).mockImplementation(async () => {
      state.permission = 'denied';
    });
    await widget.run();
    widget.show();
    buttonByText('Allow').click();
    await jest.advanceTimersByTimeAsync(0);

    expect(widget.isVisible()).toBe(true);
    expect(dialog()!.getAttribute('aria-label')).toBe('Notifications are blocked');
  });

  it('hides on decline and dispatches the hide event', async () => {
    const { widget, pw } = buildWidget({ enable: true, display: { trigger: 'manual' } });
    await widget.run();
    widget.show();
    await jest.advanceTimersByTimeAsync(0);

    buttonByText('Not now').click();
    await jest.advanceTimersByTimeAsync(0);

    expect(widget.isVisible()).toBe(false);
    expect(pw.dispatchEvent).toHaveBeenCalledWith('hide-subscription-widget', {});
  });

  it('never opens for a subscribed visitor', async () => {
    const { widget } = buildWidget({ enable: true, launcher: { enabled: true }, display: { delay: 0 } }, {
      permission: 'granted',
      subscribed: true,
    });
    await widget.run();
    await jest.advanceTimersByTimeAsync(1000);
    widget.show();

    expect(dialog()).toBeNull();
    expect(launcher()).toBeNull();
  });

  it('cancels a pending auto show once the visitor subscribes elsewhere', async () => {
    const { widget, state, handlers } = buildWidget({ enable: true, display: { delay: 5 } });
    await widget.run();

    state.permission = 'granted';
    state.subscribed = true;
    await handlers.subscribe();
    await jest.advanceTimersByTimeAsync(5000);

    expect(dialog()).toBeNull();
  });
});
