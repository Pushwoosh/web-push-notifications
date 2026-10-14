export function getGlobal() {
  return globalThis;
}

declare const __VERSION__: string;
export function getVersion() {
  return __VERSION__;
}

// API bad behavior with demo app notification payload fix
export function parseSerializedNotificationParams(param: any, defaultValue?: any) {
  if (typeof param === 'string') {
    try {
      return JSON.parse(param);
    } catch (e) {
      console.log(e);
    }
  }
  return param === undefined && defaultValue !== undefined ? defaultValue : param;
}

// Generates a UUID v4 string.
// This function first tries to use crypto.randomUUID, which is supported in browsers since 2022.
// If unavailable, it falls back to a manual UUID generation method.
// In 2027, consider simplifying this function by removing the fallback.
export function v4() {
  return crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const isFunction = (value: any): value is ((...args: any[]) => any) => typeof value === 'function';

// Resolves true once the promise settles either way, false when it is still pending after timeoutMs.
export function settlesWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const settled = promise.then(() => true, () => true);

  return Promise.race([settled, timeout]).finally(() => clearTimeout(timer));
}

// Like settlesWithin, but a promise that timed out once is not waited for again.
export function createStuckAwareWait(timeoutMs: number): (promise: Promise<unknown>) => Promise<boolean> {
  const stuck = new WeakSet<Promise<unknown>>();

  return async (promise) => {
    if (stuck.has(promise)) {
      return false;
    }

    const isSettled = await settlesWithin(promise, timeoutMs);
    if (!isSettled) {
      stuck.add(promise);
    }

    return isSettled;
  };
}
