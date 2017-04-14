import {keyValue} from "./storage";
import {keyApiBaseUrl, keyFakePushToken} from "./constants";

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

export function canUseServiceWorkers() {
  return navigator.serviceWorker && ('PushManager' in window);
}

export function getBrowserType(): 10 | 11 | 12 {
  if (isSafariBrowser()) {
    return 10;
  }
  return ~navigator.userAgent.toLowerCase().indexOf('firefox') ? 12 : 11;
}

export function getBrowserVersion() {
  const ua = navigator.userAgent;
  let M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
  let tem;

  if (/trident/i.test(M[1])) {
    tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
    return `IE ${tem[1] || ''}`;
  }

  if (M[1] === 'Chrome') {
    tem = ua.match(/\bOPR\/(\d+)/);
    if (tem != null) {
      return `Opera ${tem[1]}`;
    }
  }

  M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
  tem = ua.match(/version\/([.\d]+)/i);
  if (tem != null) {
    M.splice(1, 1, tem[1]);
  }

  return M.join(' ');
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
  return localStorage.getItem(keyFakePushToken);
}

export function generateFakePushToken() {
  const token = generateToken();
  localStorage.setItem(keyFakePushToken, token);
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

export function getPushwooshUrl(applicationCode: string, ignoreBaseUrl?: boolean) {
  let subDomain = 'cp';
  if (!isSafariBrowser() && applicationCode && !~applicationCode.indexOf('.')) {
    subDomain = `${applicationCode}.api`;
  }
  const url = __API_URL__ ? `https://${__API_URL__}/json/1.3/` : `https://${subDomain}.pushwoosh.com/json/1.3/`;

  return new Promise<any>(resolve => {
    if (ignoreBaseUrl) {
      resolve(url);
    }
    keyValue.get(keyApiBaseUrl)
      .then((base_url = null) => {
        resolve(base_url || url);
      })
      .catch(() => {
        resolve(url);
      });
  })
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
  if (!('Promise' in global)) {
    global.Promise = () => ({
      then: () => {},
      catch: () => {}
    });
  }
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