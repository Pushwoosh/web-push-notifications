import EventEmitter from "../EventEmitter";
import {eventOnPermissionGranted, eventOnPermissionDenied} from "../Pushwoosh";
import {getPushwooshUrl} from "../functions";
type TWorkerDriverParams = {
  eventEmitter?: EventEmitter,
  applicationCode: string,
  webSitePushID: string,
  pushwooshUrl: string,
}

class SafariDriver implements IPWDriver {
  constructor(private params: TWorkerDriverParams) {

  }

  private getPermissionObject() {
    return safari.pushNotification.permission(this.params.webSitePushID);
  }

  async getPermission() {
    const {permission} = this.getPermissionObject();
    return permission === 'default' ? 'prompt' : permission;
  }

  async isSubscribed() {
    const perm = await this.getPermission();
    return perm === 'granted';
  }

  askSubscribe() {
    const {
      eventEmitter = {emit: (e:any) => e},
      applicationCode = '',
      webSitePushID = ''
    } = this.params || {};
    return new Promise((resolve, reject) => {
      // @TODO: remove second parameter when base_url bug will be fixed by backend
      getPushwooshUrl(applicationCode, true).then(pushwooshUrl => {
        safari.pushNotification.requestPermission(
          `${pushwooshUrl}safari`,
          webSitePushID,
          {application: applicationCode},
          (permission) => {
            if (permission.permission === 'granted') {
              eventEmitter.emit(eventOnPermissionGranted);
              resolve(true);
            }
            else {
              eventEmitter.emit(eventOnPermissionDenied);
              reject(false);
            }
          }
        );
      });
    });
  }

  unsubscribe() {
    return new Promise(resolve => resolve(true));
  }

  async getAPIParams() {
    const {deviceToken = ''} = this.getPermissionObject() || {};
    const hwid = deviceToken && deviceToken.toLowerCase() || '';
    const pushToken = deviceToken && deviceToken.toUpperCase() || '';
    return {hwid, pushToken};
  }
}

export default SafariDriver;
