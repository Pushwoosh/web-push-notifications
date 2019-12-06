import {
  EVENT_ON_HIDE_NOTIFICATION_PERMISSION_DIALOG,
  EVENT_ON_PERMISSION_DENIED,
  EVENT_ON_PERMISSION_GRANTED,
  EVENT_ON_SHOW_NOTIFICATION_PERMISSION_DIALOG,
  PERMISSION_GRANTED
} from '../constants';
import Params from '../modules/data/Params';
import {EventBus, TEvents} from '../modules/EventBus/EventBus';
import { generateHwid } from '../functions'

class SafariDriver implements IPWDriver {
  private readonly paramsModule: Params;
  private readonly eventBus: EventBus;

  constructor(
    private params: TWorkerSafariDriverParams,
    paramsModule: Params = new Params(),
    eventBus?: EventBus
  ) {
    this.paramsModule = paramsModule;
    this.eventBus = eventBus || EventBus.getInstance()
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
    } = this.params || {};
    return new Promise((resolve, reject) => {

      // emit event when permission dialog show
      this.params.eventEmitter.emit(EVENT_ON_SHOW_NOTIFICATION_PERMISSION_DIALOG);
      this.eventBus.emit(TEvents.SHOW_NOTIFICATION_PERMISSION_DIALOG);

      safari.pushNotification.requestPermission(
        'https://cp.pushwoosh.com/json/1.3/safari',  // get push package url
        webSitePushID,
        {application: applicationCode},
        ({ permission }) => {
          // emit event when permission dialog hide with permission state
          this.params.eventEmitter.emit(EVENT_ON_HIDE_NOTIFICATION_PERMISSION_DIALOG, permission);
          this.eventBus.emit(TEvents.HIDE_NOTIFICATION_PERMISSION_DIALOG);


          if (permission === PERMISSION_GRANTED) {
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
  }

  unsubscribe() {
    return new Promise(resolve => resolve(true));
  }

  async getAPIParams() {
    const {
      applicationCode = '',
    } = this.params || {};

    const {deviceToken = ''} = this.getPermissionObject() || {};
    const pushToken = deviceToken && deviceToken.toLowerCase() || '';
    const hwid = pushToken || generateHwid(applicationCode, '');

    await this.paramsModule.setHwid(hwid);

    return {hwid, pushToken};
  }
}

export default SafariDriver;
