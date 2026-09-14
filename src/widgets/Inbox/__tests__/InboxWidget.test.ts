import * as fs from 'fs';
import * as path from 'path';

import { type Pushwoosh } from '../../../core/Pushwoosh';
import { readCssVariableUsages } from '../../../helpers/__tests__/cssVariableUsage';
import { formatStyleVariable } from '../../../helpers/cssVariables';
import { type IInboxMessagePublic } from '../../../models/InboxMessages.types';
import { CONFIG_STYLES, DEFAULT_CONFIG, STYLE_PREFIX, SYNC_INTERVAL } from '../constants';
import { PWInboxWidget } from '../InboxWidget';

function buildCarouselMessage(): IInboxMessagePublic {
  return {
    code: 'abc123',
    title: 'Order shipped',
    message: 'Your order is on its way',
    imageUrl: 'https://cdn/icon.png',
    iconUrl: 'https://cdn/icon.png',
    heroUrl: '',
    layout: 'carousel',
    carousel: [
      { imageUrl: 'https://cdn/1.jpg', caption: 'One', link: '' },
      { imageUrl: 'https://cdn/2.jpg', caption: 'Two', link: '' },
    ],
    customData: {},
    sendDate: new Date().toISOString(),
    type: 0,
    link: '/',
    isRead: false,
    isActionPerformed: false,
  };
}

function buildWidget(messages: Array<IInboxMessagePublic>, config: object = {}) {
  const pwinbox = {
    loadMessages: jest.fn().mockResolvedValue(messages),
    unreadMessagesCount: jest.fn().mockResolvedValue(messages.length),
    readMessagesWithCodes: jest.fn().mockResolvedValue(undefined),
    deleteMessagesWithCodes: jest.fn().mockResolvedValue(undefined),
    performActionForMessageWithCode: jest.fn().mockResolvedValue(undefined),
    syncMessages: jest.fn().mockResolvedValue(undefined),
  };

  const pw = <Pushwoosh><unknown>{
    pwinbox,
    initParams: { inboxWidget: { enable: true, triggerId: 'pwInbox', ...config } },
    push: jest.fn(),
  };

  document.body.innerHTML = '<button id="pwInbox"></button>';

  return { widget: new PWInboxWidget(pw), pwinbox };
}

describe('PWInboxWidget', () => {
  it('keeps the new classic cell by default', async () => {
    const { widget } = buildWidget([buildCarouselMessage()]);
    await widget.run();

    expect(document.getElementById('pwInboxWidget')!.classList.contains('pw-inbox-widget--legacy-cell')).toBe(false);
  });

  it('marks the widget legacy when legacyClassicCell is set', async () => {
    const { widget } = buildWidget([buildCarouselMessage()], { legacyClassicCell: true });
    await widget.run();

    expect(document.getElementById('pwInboxWidget')!.classList.contains('pw-inbox-widget--legacy-cell')).toBe(true);
  });

  it('does not refetch right after init, which has just pulled the inbox', async () => {
    const { widget, pwinbox } = buildWidget([buildCarouselMessage()]);
    await widget.run();
    await Promise.resolve();

    widget.toggle(true);

    expect(pwinbox.syncMessages).not.toHaveBeenCalled();
  });

  it('refreshes from the server once the throttle window has passed', async () => {
    jest.useFakeTimers();
    const { widget, pwinbox } = buildWidget([buildCarouselMessage()]);
    await widget.run();

    jest.advanceTimersByTime(SYNC_INTERVAL + 1);
    widget.toggle(true);

    expect(pwinbox.syncMessages).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('does not fire a second refresh while the throttle window is open', async () => {
    jest.useFakeTimers();
    const { widget, pwinbox } = buildWidget([buildCarouselMessage()]);
    await widget.run();

    jest.advanceTimersByTime(SYNC_INTERVAL + 1);
    widget.toggle(true);
    widget.toggle(false);
    widget.toggle(true);

    expect(pwinbox.syncMessages).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('keeps opening the widget when the refresh rejects', async () => {
    const { widget, pwinbox } = buildWidget([buildCarouselMessage()]);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    pwinbox.syncMessages.mockRejectedValue(new Error('offline'));

    await widget.run();
    jest.useFakeTimers();
    jest.advanceTimersByTime(SYNC_INTERVAL + 1);
    widget.toggle(true);
    jest.useRealTimers();
    await Promise.resolve();

    expect(widget.isOpened).toBe(true);
    (<jest.Mock>console.error).mockRestore();
  });

  it('switches the carousel slide on a pager dot, without opening the message', async () => {
    const { widget, pwinbox } = buildWidget([buildCarouselMessage()]);
    await widget.run();
    await Promise.resolve();
    await Promise.resolve();

    widget.toggle(true);

    const item = document.querySelector('.pw-inbox_item')!;
    expect(item.querySelector('.pw-inbox_hero')!.getAttribute('src')).toBe('https://cdn/1.jpg');

    const secondDot = <HTMLElement>item.querySelectorAll('.pw-inbox_dot')[1];
    secondDot.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(item.querySelector('.pw-inbox_hero')!.getAttribute('src')).toBe('https://cdn/2.jpg');
    expect(pwinbox.performActionForMessageWithCode).not.toHaveBeenCalled();
  });

  it('refuses to navigate to a script url planted in the slide attribute', async () => {
    const { widget, pwinbox } = buildWidget([buildCarouselMessage()]);
    const navigationLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await widget.run();
    await Promise.resolve();
    await Promise.resolve();

    widget.toggle(true);

    const slide = <HTMLElement>document.querySelector('.pw-inbox_slide');
    slide.setAttribute('data-pw-slide-link', 'javascript:alert(document.cookie)');
    slide.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const navigated = navigationLog.mock.calls
      .filter((call) => String(call[0]).indexOf('Not implemented: navigation') !== -1);

    expect(navigated).toHaveLength(0);
    // A dropped slide link is the same as no slide link: the tap performs the
    // message's own action, which is scheme-guarded in its turn.
    expect(pwinbox.performActionForMessageWithCode).toHaveBeenCalledWith('abc123');
    navigationLog.mockRestore();
  });

  it('remembers the chosen slide across a re-render', async () => {
    const { widget } = buildWidget([buildCarouselMessage()]);
    await widget.run();
    await Promise.resolve();
    await Promise.resolve();

    widget.toggle(true);

    const dot = <HTMLElement>document.querySelectorAll('.pw-inbox_dot')[1];
    dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // What `update-inbox-messages` triggers after a server refresh.
    (<{ updateInbox(): void }><unknown>widget).updateInbox();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('.pw-inbox_hero')!.getAttribute('src')).toBe('https://cdn/2.jpg');
  });
});

describe('PWInboxWidget style variables', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'inboxWidgetStyle.css'), 'utf8');

  function roots() {
    return {
      widget: document.getElementById('pwInboxWidget')!,
      trigger: document.getElementById('pwInbox')!,
    };
  }

  it('puts every configured style on the widget root, not on :root', async () => {
    const { widget } = buildWidget([]);
    await widget.run();

    const root = roots().widget;

    CONFIG_STYLES.forEach(({ name, type }) => {
      expect([name, root.style.getPropertyValue(`--${STYLE_PREFIX}-${name}`)])
        .toEqual([name, formatStyleVariable(type, DEFAULT_CONFIG[name])]);
    });

    expect(document.documentElement.getAttribute('style')).toBeNull();
  });

  it('sets the badge variables on the trigger, which lives outside the widget', async () => {
    const { widget } = buildWidget([], { badgeBgColor: '#010203' });
    await widget.run();

    expect(roots().trigger.style.getPropertyValue(`--${STYLE_PREFIX}-badgeBgColor`)).toBe('#010203');
  });

  it('has a setter for every variable the stylesheet reads', async () => {
    const { widget } = buildWidget([]);
    await widget.run();

    const { widget: root, trigger } = roots();
    const unset = [...new Set(readCssVariableUsages(css, STYLE_PREFIX).map((usage) => usage.name))]
      .filter((name) => !root.style.getPropertyValue(`--${STYLE_PREFIX}-${name}`)
        && !trigger.style.getPropertyValue(`--${STYLE_PREFIX}-${name}`));

    expect(unset).toEqual([]);
  });

  it('leaves an invalid colour unset, so the stylesheet fallback applies', async () => {
    const { widget } = buildWidget([], { bgColor: 'rgb(oops)' });
    await widget.run();

    expect(roots().widget.style.getPropertyValue(`--${STYLE_PREFIX}-bgColor`)).toBe('');
    expect(css).toContain(`var(--${STYLE_PREFIX}-bgColor, ${DEFAULT_CONFIG.bgColor})`);
  });

  it('leaves an invalid size unset rather than shipping a broken length', async () => {
    const { widget } = buildWidget([], { widgetWidth: '350px' });
    await widget.run();

    expect(roots().widget.style.getPropertyValue(`--${STYLE_PREFIX}-widgetWidth`)).toBe('');
  });

  it('keeps a rule-breaking string inside its own custom property', async () => {
    const { widget } = buildWidget([], { fontFamily: 'serif; position: fixed' });
    await widget.run();

    expect(roots().widget.style.position).toBe('');
  });
});
