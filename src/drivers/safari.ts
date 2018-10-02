import {getPushwooshUrl} from '../functions';
import {PERMISSION_GRANTED, EVENT_ON_PERMISSION_GRANTED, EVENT_ON_PERMISSION_DENIED} from '../constants';


class SafariDriver implements IPWDriver {
  constructor(private params: TWorkerSafariDriverParams) {

  }

  private getPermissionObject() {
    return safari.pushNotification.permission(this.params.webSitePushID);
  }

  async getPermission() {
    const {permission} = this.getPermissionObject();
    return permission;
  }

  async isSubscribed() {
    const perm = await this.getPermission();
    return perm === PERMISSION_GRANTED;
  }

  askSubscribe() {
    const {
      eventEmitter = {emit: (e: any) => e},
      applicationCode = '',
      webSitePushID = '',
      pushwooshApiUrl = ''
    } = this.params || {};
    return new Promise((resolve, reject) => {
      getPushwooshUrl(applicationCode, pushwooshApiUrl).then(pushwooshUrl => {
        safari.pushNotification.requestPermission(
          `${pushwooshUrl}safari`,
          webSitePushID,
          {application: applicationCode},
          (permission) => {
            if (permission.permission === PERMISSION_GRANTED) {
              eventEmitter.emit(EVENT_ON_PERMISSION_GRANTED);
              resolve(true);
            }
            else {
              eventEmitter.emit(EVENT_ON_PERMISSION_DENIED);
              reject('Safari permission denied');
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
    const pushToken = deviceToken && deviceToken.toLowerCase() || '';
    return {hwid, pushToken};
  }
}

export default SafariDriver;
