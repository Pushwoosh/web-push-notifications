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
