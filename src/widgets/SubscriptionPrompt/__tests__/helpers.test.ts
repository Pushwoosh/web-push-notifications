import { type Pushwoosh } from '../../../core/Pushwoosh';
import { getSubscriptionPromptSkipReason } from '../helpers';

function pw(): Pushwoosh {
  return <Pushwoosh><unknown>{
    initParams: { autoSubscribe: false },
    data: {
      getPromptDisplayCount: jest.fn().mockResolvedValue(0),
      getPromptLastSeenTime: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('getSubscriptionPromptSkipReason', () => {
  it('skips the prompt for a panel-managed application', async () => {
    const reason = await getSubscriptionPromptSkipReason({ web_sdk: {}, subscription_prompt: { use_case: 'default' } }, pw());

    expect(reason).toMatch(/managed in the Control Panel/);
  });

  it('shows it for an application still on its snippet', async () => {
    expect(await getSubscriptionPromptSkipReason({ subscription_prompt: { use_case: 'default' } }, pw())).toBeNull();
  });

  it('keeps skipping it when the site uses its own prompt', async () => {
    expect(await getSubscriptionPromptSkipReason({ subscription_prompt: { use_case: 'not-used' } }, pw()))
      .toBe('the application uses its own subscription prompt');
  });
});
