import { type Pushwoosh } from './core/Pushwoosh';
import { PWSubscriptionPromptWidget } from './widgets/SubscriptionPrompt/SubscriptionPromptWidget';

const globalPW: Pushwoosh = (globalThis as any).Pushwoosh;

globalPW.push(async () => {
  try {
    const widget = new PWSubscriptionPromptWidget(globalPW);
    await widget.run();
  } catch (error) {
    console.error('Error during Pushwoosh Subscription Prompt initialization:', error);
  }
});
