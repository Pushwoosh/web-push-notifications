import { getGlobal } from './core/functions';
import { Logger } from './core/logger';
import { Pushwoosh } from './core/Pushwoosh';

declare const __OUTPUT__: string;
declare const __SDK_PATH__: string;

function createAddWidget(sdkPath: string) {
  return (widgetName: string) => {
    const src = `${sdkPath}pushwoosh-widget-${widgetName}${process.env.NODE_ENV === 'development' ? '.uncompress' : ''}.js`;
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  };
}

// `popup_forms.enabled` tells whether the application has any active popup
// form; an absent feature (older backend) keeps the previous behaviour.
async function hasActivePopupForms(PW: Pushwoosh): Promise<boolean> {
  const features = await PW.data.getFeatures();

  if (features?.['popup_forms']?.['enabled'] === false) {
    // Logged here on purpose: the widget's own line lives in a bundle that is
    // never loaded in this case, so the popups would go missing in silence.
    Logger.info('Pushwoosh: the application has no active popup forms, skipping the web popups widget');

    return false;
  }

  return true;
}

function main() {
  if (__OUTPUT__ === 'cdn') {
    if ((window as { PushwooshDisableCdnStartup?: boolean }).PushwooshDisableCdnStartup) {
      return;
    }
  }
  const global: any = getGlobal();
  const PW = new Pushwoosh();
  const commands = Array.isArray(global.Pushwoosh) ? global.Pushwoosh as any[] : [];

  global.Pushwoosh = PW;
  commands.forEach((command) => PW.push(command));

  PW.push(async () => {
    const { initParams } = PW;
    const addWidget = createAddWidget(__OUTPUT__ === 'cdn' ? __SDK_PATH__ : initParams.webSDKPath!);

    // Subscription widgets only ask for the push permission: don't even fetch
    // their bundles when push is unavailable.
    const isPushAvailable = PW.isPushAvailable();

    if (isPushAvailable && PW.driver!.checkIsPermissionDefault()) {
      addWidget('subscription-prompt');
    }

    if (isPushAvailable && initParams.subscribeWidget?.enable) {
      addWidget('subscription-button');
    }

    if (isPushAvailable && initParams.subscribePopup?.enable) {
      addWidget('subscribe-popup');
    }

    if (initParams.inboxWidget?.enable) {
      addWidget('inbox');
    }

    // Without active popup forms the widget would only register a device and
    // fetch an empty list, so don't fetch its bundle either.
    if (initParams.webPopups?.enable !== false && await hasActivePopupForms(PW)) {
      addWidget('web-popups');
    }
  });
}

if (document.readyState === 'complete') {
  main();
} else {
  window.addEventListener('load', main);
}
