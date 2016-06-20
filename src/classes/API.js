import {getBrowserVersion, getDeviceName, getBrowserType} from '../utils/functions';

const methods = ['doPushwooshApiMethod', 'registerDevice', 'unregisterDevice', 'setTags', 'pushStat'];

export function ctrateErrorAPI(error) {
  return methods.reduce((api, methodName) => {
    api[methodName] = () => Promise.reject(error); // eslint-disable-line no-param-reassign
    return api;
  }, {});
}

export default class PushwooshAPI {
  constructor(params) {
    this.doPushwooshApiMethod = params.doPushwooshApiMethod;
    this.applicationCode = params.applicationCode;
    this.hwid = params.hwid;
    this.pushToken = params.pushToken;
    this.publicKey = params.publicKey;
    this.authToken = params.authToken;
  }

  callAPI(methodName, methodParams) {
    return this.doPushwooshApiMethod(methodName, {
      ...methodParams,
      application: this.applicationCode,
      hwid: this.hwid
    });
  }

  registerDevice() {
    return this.callAPI('registerDevice', {
      push_token: this.pushToken,
      public_key: this.publicKey,
      auth_token: this.authToken,
      language: window.navigator.language || 'en',  // Language locale of the device, must be a lowercase two-letter code according to the ISO-639-1 standard
      timezone: -(new Date).getTimezoneOffset() * 60, // offset in seconds
      device_model: getBrowserVersion(),
      device_name: getDeviceName(),
      device_type: getBrowserType()
    });
  }

  unregisterDevice() {
    return this.callAPI('unregisterDevice');
  }

  setTags(tags) {
    return this.callAPI('setTags', {tags});
  }

  getTags() {
    return this.callAPI('getTags');
  }

  pushStat(hash) {
    return this.callAPI('pushStat', {hash});
  }
}
