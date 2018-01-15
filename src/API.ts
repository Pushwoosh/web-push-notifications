import {keyDeviceRegistrationStatus, keyInitParams} from "./constants";
import {isSafariBrowser, validateParams} from "./functions";
import {keyValue} from "./storage";

export default class PushwooshAPI {
  private timezone: number = -(new Date).getTimezoneOffset() * 60;

  constructor(private doPushwooshApiMethod: TDoPushwooshMethod, public params: TPWAPIParams, public lastOpenMessage: TPWLastOpenMessage) {}

  get isSafari() {
    return isSafariBrowser();
  }

  callAPI(methodName: string, methodParams?: any) {
    const {hwid = '', applicationCode = '', userId = ''} = this.params || {};
    if (this.isSafari && !hwid) {
      return Promise.resolve();
    }
    const customUserId = methodParams && methodParams.userId;
    const mustBeParams: any = {
      application: applicationCode,
      hwid,
      userId: customUserId || userId || hwid
    };
    return this.doPushwooshApiMethod(methodName, {
      ...methodParams,
      ...mustBeParams
    });
  }

  registerDevice() {
    const {params} = this;

    if (!params.pushToken || this.isSafari) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.callAPI('registerDevice', {
        push_token: params.pushToken,
        public_key: params.publicKey,
        auth_token: params.authToken,
        language: params.language,
        timezone: this.timezone,
        device_model: params.deviceModel,
        device_type: params.deviceType,
      })
        .then(() => {
          localStorage.setItem(keyDeviceRegistrationStatus, 'registered');
          resolve();
        })
        .catch(reject);
    });
  }

  unregisterDevice() {
    if (this.isSafari) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.callAPI('unregisterDevice')
        .then(() => {
          localStorage.setItem(keyDeviceRegistrationStatus, '');
          resolve();
        })
        .catch(reject);
    });
  }

  async registerUser(userId?: string) {
    const params: any = {
      timezone: this.timezone,
      device_type: this.params.deviceType,
      userId: this.params.userId,
    };
    if (userId) {
      params.userId = userId;
      await keyValue.extend(keyInitParams, validateParams(params));
    }
    if (!params.userId) {
      return Promise.resolve();
    }
    return this.callAPI('registerUser', params);
  }

  applicationOpen() {
    return new Promise((resolve: () => void, reject) => {
      this.callAPI('applicationOpen', {
        push_token: this.params.pushToken,
        device_type: this.params.deviceType,
        timezone: this.timezone,
      }).then(resolve).catch(reject);
    });
  }

  setTags(tags: {[k: string]: any}) {
    return this.callAPI('setTags', {tags});
  }

  getTags() {
    return this.callAPI('getTags');
  }

  pushStat(hash: string) {
    return this.callAPI('pushStat', {hash});
  }

  messageDeliveryEvent(hash: string) {
    return this.callAPI('messageDeliveryEvent', {hash});
  }

  postEvent(event: string, attributes: {[k: string]: any}) {
    const {lastOpenMessage} = this;
    const date = new Date();
    const time = date.getTime();
    const timestampUTC = Math.floor(time / 1000);
    const timestampCurrent = timestampUTC - (date.getTimezoneOffset() / 60 * 3600);

    if (lastOpenMessage.expiry > Date.now()) {
      if (attributes['msgHash']) {
        return Promise.reject('attribute msgHash already defined');
      }

      attributes = {
        ...attributes,
        msgHash: lastOpenMessage.messageHash
      };
    }

    return this.callAPI('postEvent', {
      device_type: this.params.deviceType,
      event,
      attributes,
      timestampUTC,
      timestampCurrent
    });
  }

  async triggerEvent(params: TEvent, dbKey?: string) {
      const eventFlag = dbKey ? await keyValue.get(dbKey) : null;
      if (dbKey && eventFlag) {
        return;
      }
      await this.callAPI('triggerEvent', params);
      if (dbKey) {
        keyValue.set(dbKey, 1);
      }
  }
}
