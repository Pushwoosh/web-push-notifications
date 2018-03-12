import {
  getPushToken,
  getFcmKey,
  generateHwid,
  getPublicKey,
  getAuthToken,
  urlB64ToUint8Array,
  getBrowserType,
  getVersion
} from '../functions'
import {
  PERMISSION_PROMPT,
  PERMISSION_DENIED,
  PERMISSION_GRANTED,
  keyDBSenderID,
  keyApiParams,
  keyFcmSubscription
} from '../constants';
import {eventOnSWInitError, eventOnPermissionDenied, eventOnPermissionGranted} from "../Pushwoosh";
import {keyValue} from "../storage";


declare const Notification: {
  permission: typeof PERMISSION_GRANTED | typeof PERMISSION_DENIED | typeof PERMISSION_PROMPT
};

type WindowExtended = Window & {Notification: any}


class WorkerDriver implements IPWDriver {
  constructor(private params: TWorkerDriverParams) {}

  get scope() {
    let {scope = '/', serviceWorkerUrl = null} = this.params || {};
    if (typeof scope !== 'string') {
      throw new Error('invalid scope value');
    }
    if (scope.length > 1 && serviceWorkerUrl === null) {
      if (scope.substr(0, 1) !== '/')
        scope = `/${scope}`;
      if (scope.substr(scope.length - 1) !== '/')
        scope = `${scope}/`;
    }
    return scope;
  }

  async initWorker() {
    const scope = this.scope;
    const {serviceWorkerUrl, serviceWorkerUrlDeprecated} = this.params;
    const scriptUrl = serviceWorkerUrl === null
        ? `${scope}${serviceWorkerUrlDeprecated}?version=${getVersion()}`
        : `${serviceWorkerUrl}?version=${getVersion()}`;
    await navigator.serviceWorker.register(scriptUrl, {scope});
  }

  async getPermission() {
    return Notification.permission;
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

  async askSubscribe(registerLess?:boolean) {
    const serviceWorkerRegistration = await navigator.serviceWorker.ready;
    let subscription = await serviceWorkerRegistration.pushManager.getSubscription();

    if (subscription && subscription.unsubscribe && registerLess) {
      await subscription.unsubscribe();
    }

    const permission = await (window as WindowExtended).Notification.requestPermission();
    if (permission === PERMISSION_GRANTED) {
      return await this.subscribe(serviceWorkerRegistration);
    }
    else if (permission === PERMISSION_DENIED) {
      this.emit(eventOnPermissionDenied);
    }
    return subscription;
  }

  private async subscribe(registration: ServiceWorkerRegistration) {
    const options: any = {userVisibleOnly: true};
    if (getBrowserType() == 11 && this.params.applicationServerPublicKey) {
      options.applicationServerKey = urlB64ToUint8Array(this.params.applicationServerPublicKey);
    }
    const subscription = await registration.pushManager.subscribe(options);
    this.emit(eventOnPermissionGranted);
    await this.getFCMToken();
    return subscription;
  }

  /**
   * Unsubscribe device
   * @returns {Promise<boolean>}
   */
  async unsubscribe(): Promise<boolean> {
    const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
    if (!serviceWorkerRegistration) {
      return false;
    }
    const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    if (subscription && subscription.unsubscribe) {
      return subscription.unsubscribe();
    } else {
      return false;
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
      fcmPushSet: await getFcmKey(subscription, 'pushSet'),
      fcmToken: await getFcmKey(subscription, 'token')
    };
  }

  /**
   * Check for native subscription, and is it, subscribe to FCM.
   * @returns {Promise<void>}
   */
  async getFCMToken() {
    const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration();
    const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    const senderID = await keyValue.get(keyDBSenderID);
    const fcmURL = 'https://fcm.googleapis.com/fcm/connect/subscribe';

    if (!senderID) {
      console.warn('SenderID can not be found');
      return;
    }

    const body = {
      endpoint: subscription.endpoint,
      encryption_key: getPublicKey(subscription), //p256
      encryption_auth: getAuthToken(subscription), //auth
      authorized_entity: senderID,
    };
    await fetch(fcmURL, {
      method: 'post',
      headers: {'Content-Type': 'text/plain;charset=UTF-8'},
      body: JSON.stringify(body)
    }).then((response: Response) => this.onFCMSubscribe(response));
  }

  /**
   * Set FCM pushset and tokens in indexDB.
   * @returns {Promise<void>}
   */
  async onFCMSubscribe(response: Response) {
    if (response.status === 200) {
      try {
        const subscription = await response.json();
        await keyValue.set(keyFcmSubscription, {
          token: subscription.token || '',
          pushSet: subscription.pushSet || ''
        });
      }
      catch (error) {
        console.warn('Can\'t parse FCM response', error);
      }
    }
    else {
      console.warn('Error while FCM Subscribe', response.text());
      return;
    }
  }

  /**
   * Check is need to re-register device
   * @returns {Promise<boolean>}
   */
  async isNeedUnsubscribe() {
    const isValidSenderID = await this.checkSenderId();
    const isFCMSubscribed = await this.checkFCMKeys();

    return !isValidSenderID || !isFCMSubscribed;
  }

  /**
   * Check for FCM keys in indexDB
   * @returns {Promise<boolean>}
   */
  async checkFCMKeys() {
    const {pushSet = '', token = ''} = await keyValue.get(keyFcmSubscription) || {};
    return !!(pushSet && token);
  }

  /**
   * Check sender id in manifest
   * @returns {Promise<boolean>}
   */
  async checkSenderId() {
    const manifest = document.querySelector('link[rel="manifest"]');

    if (manifest === null) {
      throw new Error('Link to manifest can not find');
    }
    const manifestUrl = manifest.getAttribute('href') || '';

    return await fetch(manifestUrl, {
      method: 'get',
      headers: {'Content-Type': 'application/json;charset=UTF-8'}
    }).then((response: Response) => this.isSameManifest(response));
  }

  /**
   * On load manifest callback
   * @param response: any
   * @returns {Promise<boolean>}
   */
  async isSameManifest(response: Response) {
    if (response.status === 200) {
      const manifest = await response.text();

      const regexpSenderId = /("|')?gcm_sender_id("|')?:\s*("|')?(\d+)("|')?/;
      const match = manifest.match(regexpSenderId);
      let manifestSenderID = '';

      if (match) {
        manifestSenderID = match[4];
      }

      const senderId = await keyValue.get(keyDBSenderID);

      if (manifestSenderID && senderId !== manifestSenderID) {
        await keyValue.set(keyDBSenderID, manifestSenderID);
        return false;
      }

      return true;
    }
    else {
      throw new Error('Cant load manifest.json')
    }
  }
}

export default WorkerDriver;
