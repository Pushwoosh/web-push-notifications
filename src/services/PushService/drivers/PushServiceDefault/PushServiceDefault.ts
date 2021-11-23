import { v4 } from 'uuid';

import { Data } from '../../../../modules/Data/Data';
import { Api } from '../../../../modules/Api/Api';
import { Logger } from '../../../../logger';

import * as CONSTANTS  from '../../../../constants';

import {
  IPushService,
  IPushServiceSubscriptionKeys,
} from '../../PushService.types';

import {
  IPushServiceDefaultConfig,
  IPushServiceFcmRequest,
  IPushServiceFcmResponse,
} from './PushServiceDefault.types';


export class PushServiceDefault implements IPushService {
  private readonly api: Api;
  private readonly data: Data;
  private readonly config: IPushServiceDefaultConfig;
  private registration?: ServiceWorkerRegistration;

  constructor(api: Api, data: Data, config: IPushServiceDefaultConfig) {
    this.api = api;
    this.data = data;
    this.config = config;
  }


  public getPermission(): NotificationPermission {
    return Notification.permission;
  }

  public checkIsPermissionGranted(): boolean {
    return this.getPermission() === CONSTANTS.PERMISSION_GRANTED;
  }

  public checkIsPermissionDefault(): boolean {
    return this.getPermission() === CONSTANTS.PERMISSION_PROMPT;
  }

  public async checkIsManualUnsubscribed(): Promise<boolean> {
    return this.data.getStatusManualUnsubscribed();
  }

  public async askPermission(): Promise<void> {
    await Notification.requestPermission();
  }

  public async getTokens(): Promise<IPushServiceSubscriptionKeys> {
    return this.data.getTokens();
  }

  public async subscribe(subscription?: PushSubscription): Promise<void> {
    let currentSubscription = subscription;
    const isPermissionGranted = this.checkIsPermissionGranted();

    if (!isPermissionGranted) {
      Logger.error('You must have permission granted before subscribe!');

      return;
    }

    if (!currentSubscription) {
      currentSubscription = await this.trySubscribe();
      // get sender id
      const senderId = await this.getSenderIdFromManifest();
      // check new sender id
      const isChangeSenderId = await this.checkIsChangeSenderId(senderId);
      // if sender id is change need unsubscribe device and resubscribe
      if(isChangeSenderId) {
        // unregister device
        await this.unsubscribe();
        // and set new sender id
        await this.data.setSenderId(senderId);
      }
    }

    const applicationServerKey = await this.getApplicationServerKey();
    const senderId = await this.data.getSenderId();
    const pushToken = await this.getPushToken(currentSubscription);

    const _p256dn = currentSubscription.getKey('p256dh');
    const _auth = currentSubscription.getKey('auth');

    if(!_p256dn || !_auth) {
      throw new Error('Can\'t get subscription keys!');
    }

    const p256dh = btoa(String.fromCharCode.apply(String, new Uint8Array(_p256dn)));
    const auth = btoa(String.fromCharCode.apply(String, new Uint8Array(_auth)));

    // register device in fcm
    const { token, pushSet } = await this.getFcmKeys({
      endpoint: currentSubscription.endpoint,
      application_pub_key: applicationServerKey,
      encryption_key: p256dh,
      encryption_auth: auth,
      authorized_entity: senderId,
    });

    await this.data.setTokens({
      publicKey: p256dh,
      pushToken: pushToken,
      authToken: auth,
      fcmPushSet: pushSet,
      fcmToken: token,
      endpoint: currentSubscription.endpoint,
    });

    // register device into pushwoosh
    await this.api.registerDevice();
  }

  public async unsubscribe(): Promise<void> {
    // get service worker registration
    const registration = await this.getServiceWorkerRegistration();

    // get current subscription
    const subscription = await registration.pushManager.getSubscription();

    // remove tokens
    await this.data.setTokens({});

    // set info to database, that the device IS manual unsubscribed
    await this.data.setStatusManualUnsubscribed(true);

    // unregister device in pushwoosh
    await this.api.unregisterDevice();

    if(!subscription) {
      return;
    }

    // remove subscription
    await subscription.unsubscribe();
  }

  public async checkIsRegister(): Promise<boolean> {
    return this.api.checkDeviceSubscribeForPushNotifications();
  }

  public async checkIsNeedResubscribe(): Promise<boolean> {
    // check sender id
    const savedSenderId = await this.data.getSenderId();
    const isExistSavedSenderId = typeof savedSenderId !== 'undefined';
    const manifestSenderId = await this.getSenderIdFromManifest();
    const isChangeSenderID = isExistSavedSenderId  && manifestSenderId !== savedSenderId;

    await this.data.setSenderId(manifestSenderId);

    // check change permission status
    const lastPermission = await this.data.getLastPermissionStatus();
    const permission = this.getPermission();

    if (isExistSavedSenderId && lastPermission !== permission) {
      await this.data.setLastPermissionStatus(permission);

      return true;
    }

    // check if pushTokens not equal from pushSubscription and store
    const credentials = await this.getCredentials();
    const pushTokenFromSubscription = await this.getPushToken(credentials);
    const pushTokenFromStore = await this.data.getTokens();
    const isEqualPushTokens = pushTokenFromSubscription === (pushTokenFromStore && pushTokenFromStore.pushToken);

    return isChangeSenderID || !isEqualPushTokens;
  }

  private async getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
    if (!this.registration) {
      await this.registerServiceWorker();

      const url = await this.data.getServiceWorkerUrl();
      this.registration = await navigator.serviceWorker.getRegistration(url);

      await (this.registration as ServiceWorkerRegistration).update();
    }

    if (!this.registration) {
      throw new Error(`Internal Error: Can't register service worker!`);
    }

    return this.registration;
  }

  private async registerServiceWorker(): Promise<void> {
    const url = await this.data.getServiceWorkerUrl();
    const scope = await this.data.getServiceWorkerScope();
    const sdkVersion = await this.data.getSdkVersion();
    const serviceWorkerVersion = await this.data.getServiceWorkerVersion();

    // add clean cache get parameter only if
    // sdk version and service worker version is not equals
    let cleanCache = '';

    if (sdkVersion !== serviceWorkerVersion) {
      cleanCache = `?cache_clean=${ v4() }`;
    }

    await navigator
      .serviceWorker
      .register(`${ url }${ cleanCache }`, {
        scope
      });
  }

  private async trySubscribe(): Promise<PushSubscription> {
    try {
      return await this.subscribePushManager()
    } catch (error) {
      console.error(error);
      // if get subscription filed
      // try unsubscribe and resubscribe again
      // it may be if changed vapid or sender id
      await this.unsubscribe();
      return this.subscribePushManager();
    }
  }

  private async subscribePushManager(): Promise<PushSubscription> {
    // get service worker registration
    const registration = await this.getServiceWorkerRegistration();
    const applicationServerKey = await this.getApplicationServerKey();

    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey ? this.urlBase64ToUint8Array(applicationServerKey) : null,
    });
  }

  private async getCredentials(): Promise<PushSubscription | null> {
    const registration = await this.getServiceWorkerRegistration();
    return await registration.pushManager.getSubscription();
  }


  private async getFcmKeys(config: IPushServiceFcmRequest): Promise<IPushServiceFcmResponse> {
    const response = await fetch(this.config.entrypoint || 'https://fcm.googleapis.com/fcm/connect/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: JSON.stringify(config)
    });

    if (response.status === 200) {
      return await response.json();
    }

    throw new Error('Internal error: Can\'t register device in fcm. Status: ' + response.status + '. Message: ' + response.statusText);
  }

  private async getPushToken(subscription: PushSubscription | null): Promise<string> {
    const deviceType = await this.data.getDeviceType();

    if (!subscription) {
      return '';
    }

    // if firefox
    if (deviceType === 12) {
      return subscription.endpoint;
    }

    return subscription.endpoint.split('/').pop() || '';
  }

  private async getApplicationServerKey(): Promise<string | undefined> {
    const deviceType = await this.data.getDeviceType();

    // if not chrome
    if (deviceType !== 11) {
      return;
    }

    return await this.data.getApplicationServerKey();
  }

  private async getSenderIdFromManifest(): Promise<string> {
    const manifest = document.querySelector('link[rel="manifest"]');

    if (!manifest) {
      throw new Error('Error: manifest.json not found!');
    }

    const url = manifest.getAttribute('href');

    if (!url) {
      throw new Error('Error: manifest.json url not found!');
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
      },
    });

    if (response.status !== 200) {
      throw new Error('Error: Can\'t load manifest.json! ' + response.statusText);
    }

    const data = await response.text();
    const match = data.match(/("|')?gcm_sender_id("|')?:\s*("|')?(\d+)("|')?/);

    if (!match || typeof match[4] !== 'string') {
      throw new Error('Error: Can\'t find gcm_sender_id in manifest.json!');
    }

    return match[4];
  }

  private async checkIsChangeSenderId(currentSenderId: string) {
    const senderIdFromIndexedDB = await this.data.getSenderId();

    return currentSenderId !== senderIdFromIndexedDB;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
