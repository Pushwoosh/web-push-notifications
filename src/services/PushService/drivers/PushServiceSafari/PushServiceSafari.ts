import { type IPushServiceSafariConfig } from './PushServiceSafari.types';
import * as CONSTANTS from '../../../../core/constants';
import { Logger } from '../../../../core/logger';
import { type Api } from '../../../../modules/Api/Api';
import { type Data } from '../../../../modules/Data/Data';
import {
  type IPushService,
  type IPushServiceSubscriptionKeys,
} from '../../PushService.types';

export class PushServiceSafari implements IPushService {
  private readonly api: Api;
  private readonly data: Data;
  private readonly config: IPushServiceSafariConfig;

  constructor(
    api: Api,
    data: Data,
    config: IPushServiceSafariConfig,
  ) {
    this.api = api;
    this.config = config;
    this.data = data;
  }

  public getPermission(): NotificationPermission {
    const { permission } = this.getPermissionInfo();

    return permission;
  }

  public checkIsPermissionGranted(): boolean {
    return this.getPermission() === CONSTANTS.PERMISSION_GRANTED;
  }

  public checkIsPermissionDefault(): boolean {
    return this.getPermission() === CONSTANTS.PERMISSION_PROMPT;
  }

  public async checkIsManualUnsubscribed(): Promise<boolean> {
    return await this.data.getStatusManualUnsubscribed();
  }

  public async askPermission(): Promise<void> {
    const application = await this.data.getApplicationCode();
    const hwid = await this.data.getHwid();
    const payload = {
      application,
      hwid,
    };

    return new Promise((resolve) => {
      // safari send payload by apns to entrypoint 'https://cp.pushwoosh.com/json/1.3/safari'
      // and then take push token to browser
      safari.pushNotification.requestPermission(
        this.config.entrypoint || 'https://cp.pushwoosh.com/json/1.3/safari',
        this.config.webSitePushId,
        payload,
        () => resolve(),
      );
    });
  }

  public getTokens(): Promise<IPushServiceSubscriptionKeys> {
    return this.data.getTokens();
  }

  public async subscribe(): Promise<void> {
    const isPermissionGranted = this.checkIsPermissionGranted();

    if (!isPermissionGranted) {
      Logger.error('You must have permission granted before subscribe!');

      return;
    }

    const { deviceToken } = this.getPermissionInfo();

    await this.data.setTokens({
      pushToken: deviceToken,
    });

    await this.api.registerDevice();
  }

  public async unsubscribe(): Promise<void> {
    // remove tokens
    await this.data.setTokens({});

    // set info to database, that the device IS manual unsubscribed
    await this.data.setStatusManualUnsubscribed(true);

    // unregister device in pushwoosh
    await this.api.unregisterDevice();
  }

  public async checkIsRegister(): Promise<boolean> {
    return this.api.checkDeviceSubscribeForPushNotifications();
  }

  public async checkIsNeedResubscribe(): Promise<boolean> {
    // check web site id
    const savedWebSitePushId = await this.data.getWebSitePushId();
    const isExistSavedWebSitePushId = typeof savedWebSitePushId !== 'undefined';
    const isChangeWebSitePushId = isExistSavedWebSitePushId && this.config.webSitePushId !== savedWebSitePushId;

    await this.data.setWebSitePushId(this.config.webSitePushId);

    // check change permission status
    const lastPermission = await this.data.getLastPermissionStatus();
    const permission = this.getPermission();

    if (lastPermission !== permission) {
      await this.data.setLastPermissionStatus(permission);

      return true;
    }

    return isChangeWebSitePushId;
  }

  private getPermissionInfo(): IPushServiceSafariInfo {
    return safari.pushNotification.permission(this.config.webSitePushId);
  }
}
