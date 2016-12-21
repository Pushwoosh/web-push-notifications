export function getGlobal() {
  return Function('return this')();
}

declare const __VERSION__: string;
export function getVersion() {
  return __VERSION__ + '7';
}

export function isSafariBrowser() {
  return window.safari && navigator.userAgent.indexOf('Safari') > -1;
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
  return `${applicationCode}_${createUUID(pushToken)}`;
}

export function getPushToken(pushSubscription: PushSubscription) {
  if (pushSubscription.subscriptionId) {
    return pushSubscription.subscriptionId;
  }

  if (getBrowserType() === 12) {
    return pushSubscription.endpoint;
  }

  return pushSubscription.endpoint.split('/').pop();
}

function getSubsKey(pushSubscription: any, key: any): string {
  const rawKey = pushSubscription.getKey && pushSubscription.getKey(key);
  return rawKey ? btoa(String.fromCharCode.apply(String, new Uint8Array(rawKey))) : '';
}

export function getAuthToken(pushSubscription: PushSubscription) {
  return getSubsKey(pushSubscription, 'auth');
}

export function getPublicKey(pushSubscription: PushSubscription) {
  return getSubsKey(pushSubscription, 'p256dh');
}

export function getPushwooshUrl(applicationCode: string) {
  let subDomain = 'cp';
  if (!isSafariBrowser() && applicationCode && !~applicationCode.indexOf('.')) {
    subDomain = `${applicationCode}.api`;
  }
  return `https://${subDomain}.pushwoosh.com/json/1.3/`;
}
