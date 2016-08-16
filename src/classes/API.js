import {
  getBrowserVersion,
  getDeviceName,
  getBrowserType,
  getPushToken,
  generateHwid,
  getPublicKey,
  getAuthToken
} from '../utils/functions';

const methods = [
  'doPushwooshApiMethod',
  'registerDevice',
  'unregisterDevice',
  'applicationOpen',
  'setTags',
  'getTags',
  'pushStat'
];

export function createErrorAPI(error) {
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
    this.language = params.language;
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
      language: this.language || 'en',
      timezone: -(new Date).getTimezoneOffset() * 60,
      device_model: getBrowserVersion(),
      device_name: getDeviceName(),
      device_type: getBrowserType()
    });
  }

  unregisterDevice() {
    return this.callAPI('unregisterDevice');
  }

  applicationOpen() {
    return this.callAPI('registerDevice', {
      push_token: this.pushToken,
      timezone: -(new Date).getTimezoneOffset() * 60,
      device_type: getBrowserType()
    });
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

  static create(subscription, applicationCode, doPushwooshApiMethod, language) {
    const pushToken = getPushToken(subscription);

    return new PushwooshAPI({
      doPushwooshApiMethod: doPushwooshApiMethod,
      applicationCode: applicationCode,
      hwid: generateHwid(applicationCode, pushToken),
      pushToken: pushToken,
      publicKey: getPublicKey(subscription),
      authToken: getAuthToken(subscription),
      language: language
    });
  }
}
