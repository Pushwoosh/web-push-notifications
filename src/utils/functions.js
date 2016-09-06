export function getGlobal() {
  return Function('return this')();  // eslint-disable-line no-new-func
}

export function getVersion() {
  return __VERSION__;
}

export function isSafariBrowser() {
  return typeof safari !== 'undefined' && navigator.userAgent.indexOf('Safari') > -1;
}

export function canUseServiceWorkers() {
  return navigator && navigator.serviceWorker && ('showNotification' in ServiceWorkerRegistration.prototype) && ('PushManager' in window);
}

export function getBrowserType() {
  if (isSafariBrowser()) {
    return 10;
  }
  return navigator.userAgent.toLowerCase().indexOf('firefox') > -1 ? 12 : 11;
}

export function getBrowserVersion() {
  const ua = navigator.userAgent;
  let tem,
    M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];

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

export function createUUID(pushToken) {
  const hexDigits = '0123456789abcdef';
  const s = [];
  for (let i = 0; i < 32; i++) {
    let charCode = '0';
    if (pushToken.length - i - 1 >= 0) {
      charCode = pushToken.charCodeAt(pushToken.length - i - 1);
    }

    s[i] = hexDigits.substr(charCode % hexDigits.length, 1);
  }
  return s.join('');
}

export function getPushToken(pushSubscription) {
  if (pushSubscription.subscriptionId) {
    return pushSubscription.subscriptionId;
  }

  if (getBrowserType() === 12) {
    return pushSubscription.endpoint;
  }

  return pushSubscription.endpoint.split('/').pop();
}

export function generateHwid(applicationCode, pushToken) {
  return `${applicationCode}_${createUUID(pushToken)}`;
}

function getSubsKey(pushSubscription, key) {
  const rawKey = pushSubscription.getKey && pushSubscription.getKey(key);
  return rawKey ? btoa(String.fromCharCode(...new Uint8Array(rawKey))) : '';
}

export function getAuthToken(pushSubscription) {
  return getSubsKey(pushSubscription, 'auth');
}

export function getPublicKey(pushSubscription) {
  return getSubsKey(pushSubscription, 'p256dh');
}

export function getPushwooshUrl(applicationCode) {
  let subDomain = 'cp';
  if (applicationCode && !~applicationCode.indexOf('.')) {
    subDomain = `${applicationCode}.api`;
  }
  return `https://${subDomain}.pushwoosh.com/json/1.3/`;
}
