export function getGlobal() {
  return typeof globalThis !== 'undefined' ? globalThis : Function('return this')();
}

export function getVersion() {
  return __VERSION__;
}

// API bad behavior with demo app notification payload fix
export function parseSerializedNotificationParams(param: any, defaultValue?: any) {
  if (typeof param === 'string') {
    try {
      return JSON.parse(param);
    }
    catch (e) {
      console.log(e);
    }
  }
  return param === undefined && defaultValue !== undefined ? defaultValue : param;
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

export function clearLocationHash() {
  const global = getGlobal();
  if ('history' in global && history.pushState) {
    history.pushState(null, '', '#');
  }
  else {
    location.hash = '#';
  }
}

export function generateUUID(): string {
  let d = new Date().getTime();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
    d += performance.now();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c: string) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
