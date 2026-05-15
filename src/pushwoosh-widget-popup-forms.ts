import { type Pushwoosh } from './core/Pushwoosh';
import { PopupFormsWidget } from './widgets/PopupForms/PopupFormsWidget';

const globalPW: Pushwoosh = (globalThis as any).Pushwoosh;

globalPW.push(async () => {
  try {
    const widget = new PopupFormsWidget(globalPW);
    await widget.run();
  } catch (error) {
    console.error('Error during Pushwoosh Popup Forms widget initialization:', error);
  }
});
