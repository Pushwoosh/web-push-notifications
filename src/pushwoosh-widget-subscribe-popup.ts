import { type Pushwoosh } from './core/Pushwoosh';
import { PWSubscribePopupWidget } from './widgets/SubscribePopup';

const globalPW: Pushwoosh = (globalThis as any).Pushwoosh;

globalPW.push(async () => {
  try {
    const widget = new PWSubscribePopupWidget(globalPW);
    await widget.run();
  } catch (error) {
    console.error('Error during Pushwoosh Subscribe Popup initialization:', error);
  }
});
