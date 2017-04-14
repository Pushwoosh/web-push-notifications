import {keyDeviceRegistrationStatus} from "./constants";
import {isSafariBrowser} from "./functions";

export default class PushwooshAPI {
  private timezone: number = -(new Date).getTimezoneOffset() * 60;

  constructor(private doPushwooshApiMethod: TDoPushwooshMethod, public params: TPWAPIParams) {}

  get isSafari() {
    return isSafariBrowser();
  }

  callAPI(methodName: string, methodParams?: any) {
    const {params} = this;
    if (this.isSafari && !params.hwid) {
      return Promise.resolve();
    }
    const mustBeParams: any = {
      application: params.applicationCode,
      hwid: params.hwid
    };
    const customUserId = methodParams && methodParams.userId;
    const userId = customUserId || params.userId;
    if (userId) {
      mustBeParams.userId = userId;
    }
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

  registerUser(userId?: string) {
    const params: any = {
      timezone: this.timezone,
      device_type: this.params.deviceType,
      userId: this.params.userId,
    };
    if (userId) {
      params.userId = userId;
    }
    if (!params.userId) {
      return Promise.resolve();
    }
    return this.callAPI('registerUser', params);
  }

  applicationOpen() {
    return this.callAPI('applicationOpen', {
      push_token: this.params.pushToken,
      device_type: this.params.deviceType,
      timezone: this.timezone,
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
}
