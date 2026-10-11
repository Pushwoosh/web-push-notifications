import { type Pushwoosh } from './core/Pushwoosh';
import { PWSubscriptionWidget } from './widgets/SubscriptionWidget/SubscriptionWidget';

const globalPW: Pushwoosh = (globalThis as any).Pushwoosh;

globalPW.push(async () => {
  try {
    const widget = new PWSubscriptionWidget(globalPW);
    await widget.run();
  } catch (error) {
    console.error('Error during Pushwoosh Subscription Widget initialization:', error);
  }
});
