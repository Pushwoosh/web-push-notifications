import { type Pushwoosh } from './core/Pushwoosh';
import { PWSubscriptionButtonWidget } from './widgets/SubscriptionButton';

const globalPW: Pushwoosh = (globalThis as any).Pushwoosh;

globalPW.push(async () => {
  try {
    const widget = new PWSubscriptionButtonWidget(globalPW);
    await widget.run();
  } catch (error) {
    console.error('Error during Pushwoosh Subscription Button initialization:', error);
  }
});
