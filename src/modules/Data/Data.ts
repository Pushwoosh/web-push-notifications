import * as CONSTANTS from '../../core/constants';
import { keyValue } from '../../core/storage';
import { type TLoggerOutputLevels } from '../../helpers/pwlogger';

const getKey = (key: string): string => `params.${key}`;

export class Data {
  private readonly store: typeof keyValue;

  constructor(store: typeof keyValue = keyValue) {
    this.store = store;
  }

  public async clearAll(): Promise<void> {
    const keys = [
      'applicationCode',
      'apiToken',
      'hwid',
      'deviceType',
      'deviceModel',
      'language',
      'apiEntrypoint',
      'tokens',
      'applicationServerKey',
      'isVapidChanged',
      'webSitePushId',
      'defaultNotificationImage',
      'defaultNotificationTitle',
      'userId',
      'userIdWasChanged',
      'email',
      'emailWasChanged',
      'isLastPermissionStatus',
      'isManualUnsubscribed',
      'isCommunicationDisabled',
      'communicationEnabled',
      'isDropAllData',
      'sdkVersion',
      'serviceWorkerVersion',
      'serviceWorkerUrl',
      'serviceWorkerScope',
      'lastOpenMessage',
      'lastOpenApplicationTime',
      'features',
      'init',
      'inbox.lastRequestCode',
      'inbox.lastRequestTime',
      'inbox.newMessagesCount',
      'delayedEvent',
      'promptDisplayCount',
      'promptLastSeenTime',
      'logLevel',
    ];

    for (const key of keys) {
      await this.store.set(getKey(key), undefined);
    }
  }

  public async setApplicationCode(application: string): Promise<void> {
    await this.store.set(getKey('applicationCode'), application);
  }

  public async getApplicationCode(): Promise<string> {
    return this.store.get(getKey('applicationCode'));
  }

  public async setApiToken(token: string): Promise<string> {
    return await this.store.set(getKey('apiToken'), token);
  }

  public async getApiToken(): Promise<string> {
    return this.store.get(getKey('apiToken'));
  }

  public async setHwid(hwid: string): Promise<void> {
    await this.store.set(getKey('hwid'), hwid);
  }

  public async getHwid(): Promise<string> {
    return this.store.get(getKey('hwid'));
  }

  public async setDeviceType(type: number): Promise<void> {
    await this.store.set(getKey('deviceType'), type);
  }

  public async getDeviceType(): Promise<number> {
    return this.store.get(getKey('deviceType'));
  }

  public async setDeviceModel(model: string): Promise<void> {
    await this.store.set(getKey('deviceModel'), model);
  }

  public async getDeviceModel(): Promise<string> {
    return this.store.get(getKey('deviceModel'));
  }

  public async setLanguage(language: string): Promise<void> {
    await this.store.set(getKey('language'), language);
  }

  public async getLanguage(): Promise<string> {
    return this.store.get(getKey('language'), 'en');
  }

  public async setApiEntrypoint(url: string): Promise<void> {
    await this.store.set(getKey('apiEntrypoint'), url);
  }

  public async getApiEntrypoint(): Promise<string> {
    return this.store.get(getKey('apiEntrypoint'), CONSTANTS.DEFAULT_API_URL);
  }

  public async setTokens(tokens: any): Promise<void> {
    await this.store.set(getKey('tokens'), tokens);
  }

  public getTokens(): Promise<any> {
    return this.store.get(getKey('tokens'));
  }

  public async setApplicationServerKey(key: string): Promise<void> {
    await this.store.set(getKey('applicationServerKey'), key);
  }

  public async getApplicationServerKey(): Promise<string | undefined> {
    return this.store.get(getKey('applicationServerKey'));
  }

  public async setIsVapidChanged(status: boolean): Promise<void> {
    await this.store.set(getKey('isVapidChanged'), status);
  }

  public async getIsVapidChanged(): Promise<boolean> {
    return this.store.get(getKey('isVapidChanged'), false);
  }

  public async setWebSitePushId(senderId: string): Promise<void> {
    await this.store.set(getKey('webSitePushId'), senderId);
  }

  public async getWebSitePushId(): Promise<string> {
    return this.store.get(getKey('webSitePushId'));
  }

  public async setDefaultNotificationImage(url?: string): Promise<void> {
    await this.store.set(getKey('defaultNotificationImage'), url);
  }

  public async getDefaultNotificationImage(): Promise<string> {
    return this.store.get(getKey('defaultNotificationImage'), CONSTANTS.DEFAULT_NOTIFICATION_IMAGE);
  }

  public async setDefaultNotificationTitle(text?: string): Promise<void> {
    await this.store.set(getKey('defaultNotificationTitle'), text);
  }

  public async getDefaultNotificationTitle(): Promise<string> {
    return this.store.get(getKey('defaultNotificationTitle'), CONSTANTS.DEFAULT_NOTIFICATION_TITLE);
  }

  public async setUserId(userId?: string | number | undefined): Promise<void> {
    await this.store.set(getKey('userId'), userId ? `${userId}` : undefined);
  }

  public async getUserId(): Promise<string | undefined> {
    return this.store.get(getKey('userId'));
  }

  public async setStatusUserIdWasChanged(status: boolean): Promise<void> {
    await this.store.set(getKey('userIdWasChanged'), status);
  }

  public async getStatusUserIdWasChanged(): Promise<boolean> {
    return this.store.get(getKey('userIdWasChanged'), false);
  }

  public async setEmail(email?: string): Promise<void> {
    await this.store.set(getKey('email'), email ? `${email}` : undefined);
  }

  public async getEmail(): Promise<string | undefined> {
    return this.store.get(getKey('email'));
  }

  public async setStatusEmailWasChanged(status: boolean): Promise<void> {
    await this.store.set(getKey('emailWasChanged'), status);
  }

  public async getStatusEmailWasChanged(): Promise<boolean> {
    return this.store.get(getKey('emailWasChanged'), false);
  }

  public async setSmsNumber(number?: string): Promise<void> {
    await this.store.set(getKey('smsNumber'), number ? `${number}` : undefined);
  }

  public async getSmsNumber(): Promise<string | undefined> {
    return this.store.get(getKey('smsNumber'));
  }

  public async setStatusSmsNumberWasChanged(status: boolean): Promise<void> {
    await this.store.set(getKey('smsNumberWasChanged'), status);
  }

  public async getStatusSmsNumberWasChanged(): Promise<boolean> {
    return this.store.get(getKey('smsNumberWasChanged'), false);
  }

  public async setWhatsAppNumber(number?: string): Promise<void> {
    await this.store.set(getKey('whatsAppNumber'), number ? `${number}` : undefined);
  }

  public async getWhatsAppNumber(): Promise<string | undefined> {
    return this.store.get(getKey('whatsAppNumber'));
  }

  public async setStatusWhatsAppNumberWasChanged(status: boolean): Promise<void> {
    await this.store.set(getKey('whatsAppNumberWasChanged'), status);
  }

  public async getStatusWhatsAppNumberWasChanged(): Promise<boolean> {
    return this.store.get(getKey('whatsAppNumberWasChanged'), false);
  }

  public async setLastPermissionStatus(status: NotificationPermission): Promise<void> {
    await this.store.set(getKey('isLastPermissionStatus'), status);
  }

  public async getLastPermissionStatus(): Promise<NotificationPermission | undefined> {
    return this.store.get(getKey('isLastPermissionStatus'));
  }

  public async setStatusManualUnsubscribed(status: boolean): Promise<void> {
    await this.store.set(getKey('isManualUnsubscribed'), status);
  }

  public getStatusManualUnsubscribed(): Promise<boolean> {
    return this.store.get(getKey('isManualUnsubscribed'), false);
  }

  public async setStatusCommunicationDisabled(status: boolean): Promise<void> {
    await this.store.set(getKey('isCommunicationDisabled'), status);
  }

  public getStatusCommunicationDisabled(): Promise<boolean> {
    return this.store.get(getKey('isCommunicationDisabled'), false);
  }

  public async setCommunicationEnabled(status?: boolean): Promise<void> {
    await this.store.set(getKey('communicationEnabled'), status);
  }

  public getCommunicationEnabled(): Promise<boolean | undefined> {
    return this.store.get(getKey('communicationEnabled'));
  }

  public async setStatusDropAllData(status: boolean): Promise<void> {
    await this.store.set(getKey('isDropAllData'), status);
  }

  public getStatusDropAllData(): Promise<boolean> {
    return this.store.get(getKey('isDropAllData'), false);
  }

  public async setSdkVersion(version: string): Promise<void> {
    await this.store.set(getKey('sdkVersion'), version);
  }

  public async getSdkVersion(): Promise<string> {
    return this.store.get(getKey('sdkVersion'));
  }

  public async setServiceWorkerVersion(version: string): Promise<void> {
    await this.store.set(getKey('serviceWorkerVersion'), version);
  }

  public getServiceWorkerVersion(): Promise<string> {
    return this.store.get(getKey('serviceWorkerVersion'));
  }

  public async setServiceWorkerUrl(url?: string | null): Promise<void> {
    if (!url) {
      return;
    }

    await this.store.set(getKey('serviceWorkerUrl'), url);
  }

  public async getServiceWorkerUrl(): Promise<string> {
    return this.store.get(getKey('serviceWorkerUrl'), CONSTANTS.DEFAULT_SERVICE_WORKER_URL);
  }

  public async setServiceWorkerScope(scope?: string): Promise<void> {
    if (!scope) {
      return;
    }

    await this.store.set(getKey('serviceWorkerScope'), scope);
  }

  public async getServiceWorkerScope(): Promise<string> {
    return this.store.get(getKey('serviceWorkerScope'));
  }

  public async setLastOpenMessage(message: any): Promise<void> {
    await this.store.set(getKey('lastOpenMessage'), message);
  }

  public getLastOpenMessage(): Promise<any> {
    return this.store.get(getKey('lastOpenMessage'));
  }

  public async setLastOpenApplicationTime(time: number): Promise<void> {
    await this.store.set(getKey('lastOpenApplicationTime'), time);
  }

  public async getLastOpenApplicationTime(): Promise<number> {
    return this.store.get(getKey('lastOpenApplicationTime'));
  }

  public async setFeatures(features: any): Promise<void> {
    await this.store.set(getKey('features'), features);
  }

  public async getFeatures(): Promise<any> {
    return this.store.get(getKey('features'));
  }

  public async setInitParams(params: any): Promise<any> {
    await this.store.set(getKey('init'), params);
  }

  public async getInitParams(): Promise<any> {
    return this.store.get(getKey('init'));
  }

  public async setInboxLastRequestCode(lastCode: string): Promise<void> {
    await this.store.set(getKey('inbox.lastRequestCode'), lastCode);
  }

  public async getInboxLastRequestCode(): Promise<string> {
    return this.store.get(getKey('inbox.lastRequestCode'), '');
  }

  public async setInboxLastRequestTime(lastRequestTime: number): Promise<void> {
    await this.store.set(getKey('inbox.lastRequestTime'), lastRequestTime);
  }

  public async getInboxLastRequestTime(): Promise<number> {
    return this.store.get(getKey('inbox.lastRequestTime'), 0);
  }

  public async setInboxNewMessagesCount(count: number): Promise<void> {
    await this.store.set(getKey('inbox.newMessagesCount'), count);
  }

  public async getInboxNewMessagesCount(): Promise<number> {
    return this.store.get(getKey('inbox.newMessagesCount'), 0);
  }

  public async setDelayedEvent(event: any): Promise<void> {
    await this.store.set(getKey('delayedEvent'), event);
  }

  public getDelayedEvent(): Promise<any> {
    return this.store.get(getKey('delayedEvent'));
  }

  public async setPromptDisplayCount(count: number): Promise<void> {
    await this.store.set(getKey('promptDisplayCount'), count);
  }

  public async getPromptDisplayCount(): Promise<number> {
    return this.store.get(getKey('promptDisplayCount'), 0);
  }

  public async setPromptLastSeenTime(time: number): Promise<void> {
    await this.store.set(getKey('promptLastSeenTime'), time);
  }

  public async getPromptLastSeenTime(): Promise<number> {
    return this.store.get(getKey('promptLastSeenTime'), 0);
  }

  public async setLogLevel(level: TLoggerOutputLevels): Promise<void> {
    await this.store.set(getKey('logLevel'), level);
  }

  public async getLogLevel(): Promise<TLoggerOutputLevels> {
    return this.store.get(getKey('logLevel'), 'error');
  }
}
