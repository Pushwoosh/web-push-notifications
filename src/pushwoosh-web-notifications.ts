import { getGlobal } from './core/functions';
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

function main() {
  const global: any = getGlobal();
  const PW = new Pushwoosh();
  const commands = Array.isArray(global.Pushwoosh) ? global.Pushwoosh as any[] : [];

  global.Pushwoosh = PW;
  commands.forEach((command) => PW.push(command));

  PW.push(() => {
    const { initParams } = PW;
    const addWidget = createAddWidget(__OUTPUT__ === 'cdn' ? __SDK_PATH__ : initParams.webSDKPath!);

    if (PW.driver?.checkIsPermissionDefault()) {
      addWidget('subscription-prompt');
    }

    if (initParams.subscribeWidget?.enable) {
      addWidget('subscription-button');
    }

    if (initParams.subscribePopup?.enable) {
      addWidget('subscribe-popup');
    }

    if (initParams.inboxWidget?.enable) {
      addWidget('inbox');
    }
  });
}

if (document.readyState === 'complete') {
  main();
} else {
  window.addEventListener('load', main);
}
