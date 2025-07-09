import { type Pushwoosh } from './core/Pushwoosh';
import { PWInboxWidget } from './widgets/Inbox';

const globalPW: Pushwoosh = (globalThis as any).Pushwoosh;

globalPW.push(async () => {
  try {
    const widget = new PWInboxWidget(globalPW);
    await widget.run();
  } catch (error) {
    console.error('Error during Pushwoosh initialization:', error);
  }
});
