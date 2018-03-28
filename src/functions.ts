import {keyValue} from './storage';
import {
  KEY_API_BASE_URL,
  KEY_FAKE_PUSH_TOKEN,
  KEY_FCM_SUBSCRIPTION,
  BROWSER_TYPE_CHROME,
  BROWSER_TYPE_FF,
  BROWSER_TYPE_SAFARI
} from './constants';

export function getGlobal() {
  return Function('return this')();
}

export function getVersion() {
  return __VERSION__;
}

export function isSafariBrowser(): boolean {
  const global = getGlobal();
  return !!global.safari && navigator.userAgent.indexOf('Safari') > -1;
}

export function isOperaBrowser(): boolean {
  return navigator.userAgent.indexOf('Opera') !== -1 || navigator.userAgent.indexOf('OPR') !== -1;
}

export function canUseServiceWorkers() {
  return navigator.serviceWorker && 'PushManager' in window && 'Notification' in window;
}

export function isSupportSDK() {
  return (isSafariBrowser() && getDeviceName() === 'PC') || canUseServiceWorkers();
}

type TBrowserType = typeof BROWSER_TYPE_SAFARI | typeof BROWSER_TYPE_CHROME | typeof BROWSER_TYPE_FF;
export function getBrowserType(): TBrowserType {
  if (isSafariBrowser()) {
    return BROWSER_TYPE_SAFARI;
  }
  return ~navigator.userAgent.toLowerCase().indexOf('firefox')
    ? BROWSER_TYPE_FF
    : BROWSER_TYPE_CHROME;
}

export function getBrowserVersion() {
  const userAgent = navigator.userAgent;
  let match = userAgent.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
  let version = null;

  if (/trident/i.test(match[1])) {
    version = /\brv[ :]+(\d+)/g.exec(userAgent) || [];
    return `IE ${version[1] || ''}`;
  }

  if (match[1] === 'Chrome') {
    version = userAgent.match(/\bOPR\/(\d+)/);
    if (version !== null) {
      return `Opera ${version[1]}`;
    }
  }

  match = match[2] ? [match[1], match[2]] : [navigator.appName, navigator.appVersion, '-?'];
  version = userAgent.match(/version\/([.\d]+)/i);
  if (version !== null) {
    match.splice(1, 1, version[1]);
  }

  return match.join(' ');
}

export function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getDeviceName() {
  const userAgent = navigator.userAgent;
  if (userAgent.match(/Android/i)
    || userAgent.match(/webOS/i)
    || userAgent.match(/iPhone/i)
    || userAgent.match(/iPad/i)
    || userAgent.match(/iPod/i)
    || userAgent.match(/BlackBerry/i)
    || userAgent.match(/Windows Phone/i)
  ) {
    return 'Phone';
  }
  return 'PC';
}

export function createUUID(pushToken: string) {
  const hexDigits = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) {
    const l = pushToken.length - i - 1;
    let charCode = 0;
    if (l >= 0) {
      charCode = pushToken.charCodeAt(l);
    }

    s += hexDigits.substr(charCode % hexDigits.length, 1);
  }
  return s;
}

export function generateHwid(applicationCode: string, pushToken: string) {
  pushToken = getFakePushToken() || pushToken || generateFakePushToken();
  return `${applicationCode}_${createUUID(pushToken)}`;
}

export function getFakePushToken() {
  return localStorage.getItem(KEY_FAKE_PUSH_TOKEN);
}

export function generateFakePushToken() {
  const token = generateToken();
  localStorage.setItem(KEY_FAKE_PUSH_TOKEN, token);
  return token;
}

function generateToken(len?: number) {
  len = len || 32;
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < len; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getPushToken(pushSubscription: PushSubscription) {
  if (!pushSubscription) {
    return '';
  }

  if (pushSubscription.subscriptionId) {
    return pushSubscription.subscriptionId;
  }

  if (getBrowserType() === 12) {
    return pushSubscription.endpoint;
  }

  return pushSubscription.endpoint.split('/').pop();
}

export function getFcmKey(pushSubscription: PushSubscription, key: string): Promise<string> {
  if (!pushSubscription) {
    return Promise.resolve('');
  }

  return new Promise((resolve => {
    keyValue.get(KEY_FCM_SUBSCRIPTION)
      .then((fcmSubscription: any) => {
        resolve(fcmSubscription && fcmSubscription[key] || '')
      })
      .catch(() => {
        resolve('');
      });
  }))
}

function getSubsKey(pushSubscription: any, key: any): string {
  const rawKey = pushSubscription && pushSubscription.getKey && pushSubscription.getKey(key);
  return rawKey ? btoa(String.fromCharCode.apply(String, new Uint8Array(rawKey))) : '';
}

export function getAuthToken(pushSubscription: PushSubscription) {
  return getSubsKey(pushSubscription, 'auth');
}

export function getPublicKey(pushSubscription: PushSubscription) {
  return getSubsKey(pushSubscription, 'p256dh');
}

export function getPushwooshUrl(applicationCode: string, pushwooshApiUrl?: string) {
  let subDomain = 'cp';
  if (!isSafariBrowser() && applicationCode && !~applicationCode.indexOf('.')) {
    subDomain = `${applicationCode}.api`;
  }
  const url = `https://${pushwooshApiUrl || __API_URL__ || subDomain + '.pushwoosh.com'}/json/1.3/`;

  return new Promise<any>(resolve => {
    keyValue.get(KEY_API_BASE_URL)
      .then((base_url = null) => {
        resolve(base_url || url);
      })
      .catch(() => {
        resolve(url);
      });
  });
}

export function patchConsole() {
  let method;
  const noop = function() {};
  const methods = [
    'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
    'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
    'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
    'timeStamp', 'trace', 'warn'
  ];
  let len = methods.length;
  const global = getGlobal();
  const console = (global.console = global.console || {});

  while (len--) {
    method = methods[len];
    if (!console[method]) {
      console[method] = noop;
    }
  }
}

export function patchPromise() {
  const global = getGlobal();
  if (!canUsePromise() && isSupportSDK()) {
    global.Promise = () => ({
      then: () => {},
      catch: () => {}
    });
  }
}

export function canUsePromise() {
  const global = getGlobal();
  return 'Promise' in global;
}

export function clearLocationHash() {
  const global = getGlobal();
  if ('history' in global && history.pushState) {
    history.pushState(null, '', '#');
  }
  else {
    location.hash = '#';
  }
}

export function prepareDuration(duration: any) {
  if (isNaN(duration)) {
    return 20;
  }
  duration = Math.round(duration);
  return Math.min(60, duration < 0 ? 20 : duration);
}

export function validateParams(params: any) {
  const {...result} = params;
  if (result.userId && (result.userId === 'user_id' || !!result.userId === false)) {
    delete result.userId;
  }
  return result;
}
