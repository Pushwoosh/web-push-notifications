import { type default as InboxMessagesModel } from '../../models/InboxMessages';
import { type IInboxMessage } from '../../models/InboxMessages.types';
import { type Api } from '../Api/Api';
import { type Data } from '../Data/Data';
import InboxMessagesPublic from '../InboxMessagesPublic';

function buildMessage(actionParams: object): IInboxMessage {
  return {
    inbox_id: 'abc123',
    order: '777',
    rt: '1790000000',
    send_date: '1789000000',
    title: 'Order shipped',
    text: 'Your order is on its way',
    image: 'https://cdn/icon.png',
    action_type: 1,
    action_params: JSON.stringify(actionParams),
    status: 1,
  };
}

function buildModule(message: IInboxMessage) {
  const inboxModel = <InboxMessagesModel><unknown>{
    getMessage: jest.fn().mockResolvedValue(message),
    putMessage: jest.fn().mockResolvedValue(undefined),
  };
  const api = <Api><unknown>{ inboxStatus: jest.fn().mockResolvedValue(undefined) };

  return new InboxMessagesPublic(<Data>{}, api, inboxModel);
}

// `location.href` is non-configurable in jsdom, so it cannot be stubbed. jsdom
// instead reports every navigation attempt through the virtual console.
let navigationLog: jest.SpyInstance;

function navigationAttempts(): number {
  return navigationLog.mock.calls
    .filter((call) => String(call[0]).indexOf('Not implemented: navigation') !== -1)
    .length;
}

beforeEach(() => {
  navigationLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  navigationLog.mockRestore();
});

describe('performActionForMessageWithCode', () => {
  it('refuses to navigate to a script url from a campaign', async () => {
    // `messageTypeFactory` calls anything not starting with "http" a deeplink,
    // so a javascript: url lands in exactly that branch.
    await buildModule(buildMessage({ l: 'javascript:alert(document.cookie)' }))
      .performActionForMessageWithCode('abc123');

    expect(navigationAttempts()).toBe(0);
  });

  it('refuses the obfuscated variants a browser would still run', async () => {
    const urls = ['  javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>alert(1)</script>'];

    for (const l of urls) {
      await buildModule(buildMessage({ l })).performActionForMessageWithCode('abc123');
    }

    expect(navigationAttempts()).toBe(0);
  });

  it('still follows an ordinary url and a deep link', async () => {
    await buildModule(buildMessage({ l: 'https://shop/orders' })).performActionForMessageWithCode('abc123');
    await buildModule(buildMessage({ l: 'myapp://orders/42' })).performActionForMessageWithCode('abc123');

    expect(navigationAttempts()).toBe(2);
  });

  it('marks the message opened even when the link is refused', async () => {
    const message = buildMessage({ l: 'javascript:alert(1)' });

    await buildModule(message).performActionForMessageWithCode('abc123');

    expect(message.status).toBe(3);
  });
});
