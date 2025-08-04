import * as CONSTANTS from '../../core/constants';
import { keyValue } from '../../core/storage';

export class Data {
  private readonly store: typeof keyValue;

  constructor(store: typeof keyValue = keyValue) {
    this.store = store;
  }

  public async clearAll(): Promise<void> {
    const keys = [
      'params.applicationCode',
      'params.hwid',
      'params.deviceType',
      'params.deviceModel',
      'params.language',
      'params.apiEntrypoint',
      'params.tokens',
      'params.applicationServerKey',
      'params.senderId',
      'params.webSitePushId',
      'params.defaultNotificationImage',
      'params.defaultNotificationTitle',
      'params.userId',
      'params.email',
      'params.userIdWasChanged',

      'params.isLastPermissionStatus',
      'params.isManualUnsubscribed',
      'params.isCommunicationDisabled',
      'params.isDropAllData',

      'params.sdkVersion',
      'params.serviceWorkerVersion',
      'params.serviceWorkerUrl',
      'params.serviceWorkerScope',

      'params.lastOpenMessage',
      'params.lastOpenApplicationTime',

      'params.features',

      'params.init',
    ];

    for (const key of keys) {
      await this.store.set(key, undefined);
    }
  }

  public async setApplicationCode(application: string): Promise<void> {
    await this.store.set('params.applicationCode', application);
  }

  public async getApplicationCode(): Promise<string> {
    return this.store.get('params.applicationCode');
  }

  public async setApiToken(token: string): Promise<string> {
    return await this.store.set('params.apiToken', token);
  }

  public async getApiToken(): Promise<string> {
    return this.store.get('params.apiToken');
  }

  public async setHwid(hwid: string): Promise<void> {
    await this.store.set('params.hwid', hwid);
  }

  public async getHwid(): Promise<string> {
    return this.store.get('params.hwid');
  }

  public async setDeviceType(type: number): Promise<void> {
    await this.store.set('params.deviceType', type);
  }

  public async getDeviceType(): Promise<number> {
    return this.store.get('params.deviceType');
  }

  public async setDeviceModel(model: string): Promise<void> {
    await this.store.set('params.deviceModel', model);
  }

  public async getDeviceModel(): Promise<string> {
    return this.store.get('params.deviceModel');
  }

  public async setLanguage(language: string): Promise<void> {
    await this.store.set('params.language', language);
  }

  public async getLanguage(): Promise<string> {
    return this.store.get('params.language', 'en');
  }

  public async setApiEntrypoint(url: string): Promise<void> {
    await this.store.set('params.apiEntrypoint', url);
  }

  public async getApiEntrypoint(): Promise<string> {
    return this.store.get('params.apiEntrypoint', CONSTANTS.DEFAULT_API_URL);
  }

  public async setTokens(tokens: any): Promise<void> {
    await this.store.set('params.tokens', tokens);
  }

  public getTokens(): Promise<any> {
    return this.store.get('params.tokens');
  }

  public async setApplicationServerKey(key: string): Promise<void> {
    await this.store.set('params.applicationServerKey', key);
  }

  public async getApplicationServerKey(): Promise<string | undefined> {
    return this.store.get('params.applicationServerKey');
  }

  public async setIsVapidChanged(status: boolean): Promise<void> {
    await this.store.set('params.isVapidChanged', status);
  }

  public async getIsVapidChanged(): Promise<boolean> {
    return this.store.get('params.isVapidChanged', false);
  }

  public async setWebSitePushId(senderId: string): Promise<void> {
    await this.store.set('params.webSitePushId', senderId);
  }

  public async getWebSitePushId(): Promise<string> {
    return this.store.get('params.webSitePushId');
  }

  public async setDefaultNotificationImage(url?: string): Promise<void> {
    await this.store.set('params.defaultNotificationImage', url);
  }

  public async getDefaultNotificationImage(): Promise<string> {
    return this.store.get('params.defaultNotificationImage', CONSTANTS.DEFAULT_NOTIFICATION_IMAGE);
  }

  public async setDefaultNotificationTitle(text?: string): Promise<void> {
    await this.store.set('params.defaultNotificationTitle', text);
  }

  public async getDefaultNotificationTitle(): Promise<string> {
    return this.store.get('params.defaultNotificationTitle', CONSTANTS.DEFAULT_NOTIFICATION_TITLE);
  }

  public async setUserId(userId?: string | number): Promise<void> {
    await this.store.set('params.userId', userId ? `${userId}` : undefined);
  }

  public async getUserId(): Promise<string | undefined> {
    return this.store.get('params.userId');
  }

  public async setStatusUserIdWasChanged(status: boolean): Promise<void> {
    await this.store.set('params.userIdWasChanged', status);
  }

  public async getStatusUserIdWasChanged(): Promise<boolean> {
    return this.store.get('params.userIdWasChanged', false);
  }

  public async setEmail(email?: string): Promise<void> {
    await this.store.set('params.email', email ? `${email}` : undefined);
  }

  public async getEmail(): Promise<string | undefined> {
    return this.store.get('params.email');
  }

  public async setStatusEmailWasChanged(status: boolean): Promise<void> {
    await this.store.set('params.emailWasChanged', status);
  }

  public async getStatusEmailWasChanged(): Promise<boolean> {
    return this.store.get('params.emailWasChanged', false);
  }

  public async setLastPermissionStatus(status: NotificationPermission): Promise<void> {
    await this.store.set('params.isLastPermissionStatus', status);
  }

  public async getLastPermissionStatus(): Promise<NotificationPermission | undefined> {
    return this.store.get('params.isLastPermissionStatus');
  }

  public async setStatusManualUnsubscribed(status: boolean): Promise<void> {
    await this.store.set('params.isManualUnsubscribed', status);
  }

  public getStatusManualUnsubscribed(): Promise<boolean> {
    return this.store.get('params.isManualUnsubscribed', false);
  }

  public async setStatusCommunicationDisabled(status: boolean): Promise<void> {
    await this.store.set('params.isCommunicationDisabled', status);
  }

  public getStatusCommunicationDisabled(): Promise<boolean> {
    return this.store.get('params.isCommunicationDisabled', false);
  }

  public async setCommunicationEnabled(status?: boolean): Promise<void> {
    await this.store.set('params.communicationEnabled', status);
  }

  public getCommunicationEnabled(): Promise<boolean | undefined> {
    return this.store.get('params.communicationEnabled');
  }

  public async setStatusDropAllData(status: boolean): Promise<void> {
    await this.store.set('params.isDropAllData', status);
  }

  public getStatusDropAllData(): Promise<boolean> {
    return this.store.get('params.isDropAllData', false);
  }

  public async setSdkVersion(version: string): Promise<void> {
    await this.store.set('params.sdkVersion', version);
  }

  public async getSdkVersion(): Promise<string> {
    return this.store.get('params.sdkVersion');
  }

  public async setServiceWorkerVersion(version: string): Promise<void> {
    await this.store.set('params.serviceWorkerVersion', version);
  }

  public getServiceWorkerVersion(): Promise<string> {
    return this.store.get('params.serviceWorkerVersion');
  }

  public async setServiceWorkerUrl(url?: string | null): Promise<void> {
    if (!url) {
      return;
    }

    await this.store.set('params.serviceWorkerUrl', url);
  }

  public async getServiceWorkerUrl(): Promise<string> {
    return this.store.get('params.serviceWorkerUrl', CONSTANTS.DEFAULT_SERVICE_WORKER_URL);
  }

  public async setServiceWorkerScope(scope?: string): Promise<void> {
    if (!scope) {
      return;
    }

    await this.store.set('params.serviceWorkerScope', scope);
  }

  public async getServiceWorkerScope(): Promise<string> {
    return this.store.get('params.serviceWorkerScope');
  }

  public async setLastOpenMessage(message: any): Promise<void> {
    await this.store.set('params.lastOpenMessage', message);
  }

  public getLastOpenMessage(): Promise<any> {
    return this.store.get('params.lastOpenMessage');
  }

  public async setLastOpenApplicationTime(time: number): Promise<void> {
    await this.store.set('params.lastOpenApplicationTime', time);
  }

  public async getLastOpenApplicationTime(): Promise<number> {
    return this.store.get('params.lastOpenApplicationTime');
  }

  public async setFeatures(features: any): Promise<void> {
    await this.store.set('params.features', features);
  }

  public async getFeatures(): Promise<any> {
    return this.store.get('params.features');
  }

  public async setInitParams(params: any): Promise<any> {
    await this.store.set('params.init', params);
  }

  public async getInitParams(): Promise<any> {
    return this.store.get('params.init');
  }

  public async setInboxLastRequestCode(lastCode: string): Promise<void> {
    await this.store.set('params.inbox.lastRequestCode', lastCode);
  }

  public async getInboxLastRequestCode(): Promise<string> {
    return this.store.get('params.inbox.lastRequestCode', '');
  }

  public async setInboxLastRequestTime(lastRequestTime: number): Promise<void> {
    await this.store.set('params.inbox.lastRequestTime', lastRequestTime);
  }

  public async getInboxLastRequestTime(): Promise<number> {
    return this.store.get('params.inbox.lastRequestTime', 0);
  }

  public async setInboxNewMessagesCount(count: number): Promise<void> {
    await this.store.set('params.inbox.newMessagesCount', count);
  }

  public async getInboxNewMessagesCount(): Promise<number> {
    return this.store.get('params.inbox.newMessagesCount', 0);
  }

  public async setDelayedEvent(event: any): Promise<void> {
    await this.store.set('params.delayedEvent', event);
  }

  public getDelayedEvent(): Promise<any> {
    return this.store.get('params.delayedEvent');
  }

  public async setPromptDisplayCount(count: number): Promise<void> {
    await this.store.set('params.promptDisplayCount', count);
  }

  public async getPromptDisplayCount(): Promise<number> {
    return this.store.get('params.promptDisplayCount', 0);
  }

  public async setPromptLastSeenTime(time: number): Promise<void> {
    await this.store.set('params.promptLastSeenTime', time);
  }

  public async getPromptLastSeenTime(): Promise<number> {
    return this.store.get('params.promptLastSeenTime', 0);
  }
}
