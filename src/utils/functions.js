export function getGlobal() {
  return Function('return this')();  // eslint-disable-line no-new-func
}

export function getVersion() {
  return __VERSION__;
}

export function isSafariBrowser() {
  return window && window.safari && navigator.userAgent.indexOf('Safari') > -1;
}

export function canUseServiceWorkers() {
  return navigator && navigator.serviceWorker;
}

export function getBrowserType() {
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
  let pushToken = '';
  if (pushSubscription.subscriptionId) {
    pushToken = pushSubscription.subscriptionId;
  }
  else if (getBrowserType() === 12) {
    pushToken = pushSubscription.endpoint;
  }
  else {
    pushToken = pushSubscription.endpoint.split('/').pop();
  }

  return pushToken;
}

export function generateHwid(applicationCode, pushToken) {
  return `${applicationCode}_${createUUID(pushToken)}`;
}

export function getEncryptionKey(pushSubscription) {
  const rawKey = pushSubscription.getKey ? pushSubscription.getKey('p256dh') : '';
  return rawKey ? btoa(String.fromCharCode(...new Uint8Array(rawKey))) : '';
}
