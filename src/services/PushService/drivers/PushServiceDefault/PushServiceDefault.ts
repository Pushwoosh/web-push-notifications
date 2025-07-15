import {
  type IPushServiceDefaultConfig,
} from './PushServiceDefault.types';
import * as CONSTANTS from '../../../../core/constants';
import { v4 } from '../../../../core/functions';
import { Logger } from '../../../../core/logger';
import { type Api } from '../../../../modules/Api/Api';
import { type Data } from '../../../../modules/Data/Data';
import {
  type IPushService,
  type IPushServiceSubscriptionKeys,
} from '../../PushService.types';

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
    const currentSubscription = subscription || await this.trySubscribe();
    const isPermissionGranted = this.checkIsPermissionGranted();

    if (!isPermissionGranted) {
      Logger.error('You must have permission granted before subscribe!');

      return;
    }

    const pushToken = this.getPushToken(currentSubscription);
    const _p256dn = currentSubscription.getKey('p256dh');
    const _auth = currentSubscription.getKey('auth');

    if (!_p256dn || !_auth) {
      throw new Error('Can\'t get subscription keys!');
    }

    const p256dh = btoa(String.fromCharCode.apply(String, new Uint8Array(_p256dn))); // eslint-disable-line prefer-spread
    const auth = btoa(String.fromCharCode.apply(String, new Uint8Array(_auth))); // eslint-disable-line prefer-spread

    await this.data.setTokens({
      publicKey: p256dh,
      pushToken: pushToken,
      authToken: auth,
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

    if (!subscription) {
      return;
    }

    // remove subscription
    await subscription.unsubscribe();
  }

  public async checkIsRegister(): Promise<boolean> {
    return this.api.checkDeviceSubscribeForPushNotifications();
  }

  public async checkIsNeedResubscribe(): Promise<boolean> {
    // check change permission status
    const lastPermission = await this.data.getLastPermissionStatus();
    const permission = this.getPermission();

    if (lastPermission !== permission) {
      await this.data.setLastPermissionStatus(permission);

      return true;
    }

    // check if pushTokens not equal from pushSubscription and store
    const credentials = await this.getCredentials();
    const pushTokenFromSubscription = this.getPushToken(credentials);

    const subscriptionTokensFromStore = await this.data.getTokens();
    const pushTokenFromStore = subscriptionTokensFromStore && subscriptionTokensFromStore.pushToken || '';

    const isEqualPushTokens = pushTokenFromSubscription === pushTokenFromStore;

    const isVapidChanged = await this.data.getIsVapidChanged();

    return !isEqualPushTokens || isVapidChanged;
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
      cleanCache = `?cache_clean=${v4()}`;
    }

    await navigator
      .serviceWorker
      .register(`${url}${cleanCache}`, {
        scope,
      });
  }

  private async trySubscribe(): Promise<PushSubscription> {
    try {
      return await this.subscribePushManager();
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

  private getPushToken(subscription: PushSubscription | null): string {
    if (!subscription) {
      return '';
    }

    return subscription.endpoint;
  }

  private async getApplicationServerKey(): Promise<string | undefined> {
    return await this.data.getApplicationServerKey();
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
