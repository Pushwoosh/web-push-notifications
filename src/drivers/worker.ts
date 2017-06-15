import {
  getPushToken,
  generateHwid,
  getPublicKey,
  getAuthToken,
  urlB64ToUint8Array,
  getBrowserType,
  getVersion
} from '../functions'
import {eventOnSWInitError, eventOnPermissionDenied, eventOnPermissionGranted} from "../Pushwoosh";
import {keyApiParams} from "../constants";
import {keyValue} from "../storage";

declare const Notification: {
  permission: 'granted' | 'denied' | 'default'
};

class WorkerDriver implements IPWDriver {
  constructor(private params: TWorkerDriverParams) {}

  get scope() {
    let {scope = '/'} = this.params || {};
    if (typeof scope !== 'string') {
      throw new Error('invalid scope value');
    }
    if (scope.length > 1) {
      if (scope.substr(0, 1) !== '/')
        scope = `/${scope}`;
      if (scope.substr(scope.length - 1) !== '/')
        scope = `${scope}/`;
    }
    return scope;
  }

  async initWorker() {
    const scope = this.scope;
    let serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
    if (!serviceWorkerRegistration || serviceWorkerRegistration.installing == null) {
      await navigator.serviceWorker.register(`${scope}${this.params.serviceWorkerUrl}?version=${getVersion()}`, {scope});
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

  emit(event: string) {
    const {eventEmitter = {emit: (e: any) => e}} = this.params || {};
    eventEmitter.emit(event);
  }

  async askSubscribe() {
    let serviceWorkerRegistration = await navigator.serviceWorker.ready;
    let subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    if (!subscription) {
      const options: any = {userVisibleOnly: true};
      if (getBrowserType() == 11 && this.params.applicationServerPublicKey) {
        options.applicationServerKey = urlB64ToUint8Array(this.params.applicationServerPublicKey);
      }
      try {
        subscription = await serviceWorkerRegistration.pushManager.subscribe(options);
        this.emit(eventOnPermissionGranted);
      } catch (e) {
        this.emit(eventOnPermissionDenied);
      }
    } else {
      this.emit(eventOnPermissionGranted);
    }
    return subscription;
  }

  async unsubscribe() {
    const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
    if (!serviceWorkerRegistration) {
      return Promise.resolve();
    }
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
      const {
        [keyApiParams]: savedApiParams
      } = await keyValue.getAll();
      if (savedApiParams && this.scope !== '/') {
        return savedApiParams;
      }
      else {
        this.emit(eventOnSWInitError);
        throw new Error('No service worker registration');
      }
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
