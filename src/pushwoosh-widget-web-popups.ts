import { type Pushwoosh } from './core/Pushwoosh';
import { WebPopupsWidget } from './widgets/WebPopups/WebPopupsWidget';

const globalPW: Pushwoosh = (globalThis as any).Pushwoosh;

globalPW.push(async () => {
  try {
    const widget = new WebPopupsWidget(globalPW);
    await widget.run();
  } catch (error) {
    console.error('Error during Pushwoosh Web Popups widget initialization:', error);
  }
});
