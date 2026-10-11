import { getGlobal } from './core/functions';
import { Logger } from './core/logger';
import { Pushwoosh } from './core/Pushwoosh';
import { subscriptionBundlesToLoad } from './core/subscriptionBundles';
import { getSubscriptionPromptSkipReason } from './widgets/SubscriptionPrompt/helpers';

declare const __OUTPUT__: string;
declare const __SDK_PATH__: string;

// Resolves false when the bundle fails to load; a failed one is retried on the next call.
function createAddWidget(sdkPath: string) {
  const requested = new Map<string, Promise<boolean>>();

  return (widgetName: string): Promise<boolean> => {
    const pending = requested.get(widgetName);
    if (pending) {
      return pending;
    }

    const loading = new Promise<boolean>((resolve) => {
      const src = `${sdkPath}pushwoosh-widget-${widgetName}${process.env.NODE_ENV === 'development' ? '.uncompress' : ''}.js`;
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = src;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        requested.delete(widgetName);
        script.remove();
        resolve(false);
      };
      document.head.appendChild(script);
    });

    requested.set(widgetName, loading);

    return loading;
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

// The prompt's own decision, taken before its bundle is fetched: the widget
// would otherwise be downloaded just to read two numbers and quit.
async function canShowSubscriptionPrompt(PW: Pushwoosh): Promise<boolean> {
  let skipReason: string | null = null;

  try {
    skipReason = await getSubscriptionPromptSkipReason(await PW.data.getFeatures(), PW);
  } catch (error) {
    // A storage failure must neither hide the prompt nor reject this callback:
    // the widgets queued after it would never be added.
    Logger.error(error, 'Pushwoosh: failed to check the subscription prompt widget, loading it anyway');

    return true;
  }

  if (skipReason) {
    // Logged here on purpose: the widget's own lines live in a bundle that is
    // never loaded in this case, so the prompt would go missing in silence.
    Logger.info(`Pushwoosh: ${skipReason}, skipping the subscription prompt widget`);

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
    PW.widgetLoader = addWidget;

    // Subscription widgets only ask for the push permission: don't even fetch
    // their bundles when push is unavailable.
    const isPushAvailable = PW.isPushAvailable();
    const bundles = subscriptionBundlesToLoad(initParams, isPushAvailable, isPushAvailable && PW.driver!.checkIsPermissionDefault());

    for (const bundle of bundles) {
      if (bundle !== 'subscription-prompt' || await canShowSubscriptionPrompt(PW)) {
        addWidget(bundle);
      }
    }

    if (initParams.inboxWidget?.enable) {
      addWidget('inbox');
    }

    // Without active popup forms the widget would only register a device and
    // fetch an empty list; an inbox message opening a popup loads it on tap.
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
