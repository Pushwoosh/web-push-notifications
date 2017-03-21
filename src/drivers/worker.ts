import {
  getPushToken,
  generateHwid,
  getPublicKey,
  getAuthToken,
  urlB64ToUint8Array,
  getBrowserType,
  getVersion
} from '../functions'
import {eventOnPermissionDenied, eventOnPermissionGranted} from "../Pushwoosh";
import EventEmitter from "../EventEmitter";

declare const Notification: {
  permission: 'granted' | 'denied' | 'default'
};

type TWorkerDriverParams = {
  eventEmitter?: EventEmitter,
  applicationCode: string,
  serviceWorkerUrl: string,
  applicationServerPublicKey?: string,
}

class WorkerDriver implements IPWDriver {
  constructor(private params: TWorkerDriverParams) {}

  async initWorker() {
    let serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
    if (!serviceWorkerRegistration || serviceWorkerRegistration.installing == null) {
      await navigator.serviceWorker.register(`${this.params.serviceWorkerUrl}?version=${getVersion()}`);
    }
  }

  async getPermission() {
    return Notification.permission === 'default' ? 'prompt' : Notification.permission;
  }

  async isSubscribed() {
    let serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
    if (!serviceWorkerRegistration) {
      return false;
    }
    let subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    return !!subscription;
  }

  async askSubscribe() {
    const eventEmitter = this.params.eventEmitter || {emit: e => e};
    let serviceWorkerRegistration = await navigator.serviceWorker.ready;
    let subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    if (!subscription) {
      const options: any = {userVisibleOnly: true};
      if (getBrowserType() == 11 && this.params.applicationServerPublicKey) {
        options.applicationServerKey = urlB64ToUint8Array(this.params.applicationServerPublicKey);
      }
      try {
        subscription = await serviceWorkerRegistration.pushManager.subscribe(options);
        eventEmitter.emit(eventOnPermissionGranted);
      } catch (e) {
        eventEmitter.emit(eventOnPermissionDenied);
      }
    } else {
      eventEmitter.emit(eventOnPermissionGranted);
    }
    return subscription;
  }

  async unsubscribe() {
    const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
    const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    if (subscription && subscription.unsubscribe) {
      return subscription.unsubscribe();
    } else {
      return Promise.resolve(false);
    }
  }

  async getAPIParams() {
    let serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
    if (!serviceWorkerRegistration) {
      throw new Error('No service worker registration');
    }
    serviceWorkerRegistration = await navigator.serviceWorker.ready;

    const subscription = await serviceWorkerRegistration.pushManager.getSubscription();

    const pushToken = getPushToken(subscription);
    return {
      hwid: generateHwid(this.params.applicationCode, pushToken),
      pushToken: pushToken,
      publicKey: getPublicKey(subscription),
      authToken: getAuthToken(subscription),
    };
  }
}

export default WorkerDriver;
