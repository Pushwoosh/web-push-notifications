import * as CONSTANTS from './constants';
import { defaultInitParams } from './defaultInitParams';
import { type EventHandlerMap, type EventName } from './events.types';
import { getGlobal, getVersion, isFunction, v4 } from './functions';
import { legacyEventsMap } from './legacyEventsMap';
import { Logger } from './logger';
import { EventBus } from './modules/EventBus';
import { type IInitParams, type PWInput } from './Pushwoosh.types';
import { keyValue, log as logStorage, message as messageStorage } from './storage';
import InboxMessagesModel from '../models/InboxMessages';
import { Api } from '../modules/Api/Api';
import { ApiClient } from '../modules/ApiClient/ApiClient';
import { type IMapResponse } from '../modules/ApiClient/ApiClient.types';
import { Data } from '../modules/Data/Data';
import InboxMessagesPublic from '../modules/InboxMessagesPublic';
import { PlatformChecker } from '../modules/PlatformChecker';
import { PushServiceDefault, PushServiceSafari } from '../services/PushService/PushService';
import { type IPushService } from '../services/PushService/PushService.types';

export class Pushwoosh {
  public ready: boolean = false;

  public initParams: IInitParams;

  private readonly eventBus: EventBus;

  public readonly data: Data;
  private readonly apiClient: ApiClient;
  private isCommunicationDisabled?: boolean;
  public readonly api: Api;
  public driver: IPushService;
  public platformChecker: PlatformChecker;

  // Inbox messages public interface
  public pwinbox: InboxMessagesPublic;
  private inboxModel: InboxMessagesModel;

  public moduleRegistry: Record<string, any> = {};

  constructor() {
    this.eventBus = new EventBus();

    this.data = new Data();
    this.apiClient = new ApiClient(this.data);

    this.api = new Api(this.eventBus, this.data, this.apiClient, () => this.isCommunicationDisabled);

    this.platformChecker = new PlatformChecker(getGlobal());
    this.inboxModel = new InboxMessagesModel(this.eventBus, this.data, this.api);
    this.pwinbox = new InboxMessagesPublic(this.data, this.api, this.inboxModel);
  }

  /**
   * Add Web SDK Event Handler.
   * Alias to addEventHandler method of EventBus module.
   *
   * @public
   * @readonly
   *
   * @param {string} name - name of Web SDK event.
   * @param {function} handler - handler of Web SDK event.
   *
   * @returns {void}
   */
  public addEventHandler = <Name extends EventName>(
    name: Name,
    handler: EventHandlerMap[Name],
  ): void => this.eventBus.addEventHandler(name, handler);

  /**
   * Remove Web SDK Event Handler.
   * Alias to removeEventHandler method of EventBus module.
   *
   * @public
   * @readonly
   *
   * @param {string} name - name of Web SDK event.
   * @param {function} handler - handler of Web SDK event.
   *
   * @returns {void}
   */
  public removeEventHandler = <Name extends EventName>(
    name: Name,
    handler: EventHandlerMap[Name],
  ): void => this.eventBus.removeEventHandler(name, handler);

  /**
   * Dispatch Web SDK Event.
   * Alias to dispatchEvent method of EventBus module.
   *
   * @public
   * @readonly
   *
   * @param {string} name - name of Web SDK event.
   * @param {object} payload - event payload.
   *
   * @returns {string} - event id.
   */
  public dispatchEvent = <Name extends EventName>(
    name: Name,
    payload: Omit<Parameters<EventHandlerMap[Name]>[0], 'eventId'> & { eventId?: string },
  ): string => this.eventBus.dispatchEvent(name, payload);

  /**
   * Method that puts the stored error/info messages to browser console.
   * @type {{showLog: (() => Promise<any>); showKeyValues: (() => Promise<any>); showMessages: (() => Promise<any>)}}
   */
  public debug = {
    async showLog() {
      const items = await logStorage.getAll();
      console.log(items);
    },
    async showKeyValues() {
      const items = await keyValue.getAll();
      console.log(items);
    },
    async showMessages() {
      const items = await messageStorage.getAll();
      items.forEach((i: any) => console.log(i));
    },
  };

  /**
   * Polymorph PW method.
   * Can get array in format [string, params | callback] or function.
   *
   *  // with callback:
   *  Pushwoosh.push(['onNotificationClick', function(api, payload) {
   *    // click on the notificationn
   *  }]);
   *
   *  // with function:
   *  Pushwoosh.push(function(api) {
   *    // this is a bit easier way to subscribe to onReady
   *  });
   *
   *  // with params:
   *  // initiates Pushwoosh service and notification subscription
   *  Pushwoosh.push(['init', {
   *    applicationCode: 'XXXXX-XXXXX',
   *    // see more about params in documentation
   *    // https://docs.pushwoosh.com/docs/web-push-sdk-30#section-integration
   *  }]);
   *
   * @param command
   */
  public push(command: PWInput) {
    if (isFunction(command)) {
      this.subscribeToLegacyEvents(CONSTANTS.LEGACY_EVENT_ON_READY, command);
      return;
    }

    if (!Array.isArray(command)) {
      throw new Error('Invalid command!');
    }

    if (command[0] === 'init') {
      this.initialize(command[1]).catch((err) => {
        console.error('Pushwoosh: Error during initialization', err);
      });
    } else if (!this.subscribeToLegacyEvents(command[0], command[1])) {
      console.log('Pushwoosh: Unknown command', command);
      throw new Error('Unknown command!');
    }
  }

  /**
   * Method initializes the permission dialog on the device
   * and registers through the API in case the device hasn't been registered before.
   * @returns {Promise<void>}
   */
  public async subscribe(isForceSubscribe = true): Promise<void> {
    if (this.isCommunicationDisabled) {
      Logger.error('Communication is disabled!');
    }

    const isPermissionDefault = this.driver.checkIsPermissionDefault();

    // if permission granted need ask permission for send notifications
    if (isPermissionDefault) {
      // emit event when permission dialog show
      this.eventBus.dispatchEvent('show-notification-permission-dialog', {});
      // all action before this MUST be a synchrony because
      // in new release in ff 72 we must call this event by user
      // ask permission
      // ask permissions only show prompt window, not register device for send push notifications
      await this.driver.askPermission();

      const permission = this.driver.getPermission();

      // emit event when permission dialog hide with permission state
      this.eventBus.dispatchEvent('hide-notification-permission-dialog', { permission });
    }

    const permission = this.driver.getPermission();
    const isManualUnsubscribed = await this.data.getStatusManualUnsubscribed();
    const isDeviceRegister = await this.api.checkDeviceSubscribeForPushNotifications(false);

    // if permission granted emit event and register device into pushwoosh
    if (permission === CONSTANTS.PERMISSION_GRANTED) {
      this.eventBus.dispatchEvent('permission-granted', {});
      const needSubscribe = !isDeviceRegister && !isManualUnsubscribed;

      if (needSubscribe || isForceSubscribe) {
        await this.driver.subscribe();
      }

      this.eventBus.dispatchEvent('subscribe', {});

      return;
    }

    // if permission denied emit event
    if (permission === CONSTANTS.PERMISSION_DENIED) {
      this.eventBus.dispatchEvent('permission-denied', {});

      if (isDeviceRegister) {
        await this.driver.unsubscribe();
      }

      return;
    }
  }

  /**
   * Unsubscribe device.
   * @returns {Promise<void>}
   */
  public async unsubscribe(): Promise<void> {
    try {
      await this.driver.unsubscribe();
    } catch (error) {
      Logger.error(error, 'Error occurred during the unsubscribe');
      throw error;
    }
  }

  /**
   * force subscribe if there was a manual unsubscribe
   * @returns {Promise<void>}
   */
  public async forceSubscribe(): Promise<void> {
    await this.subscribe(true);
  }

  /**
   * Check device's registration status
   * @returns {boolean}
   */
  public isDeviceRegistered(): boolean {
    return localStorage.getItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS) === CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED;
  }

  public isDeviceUnregistered(): boolean {
    return localStorage.getItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS) === CONSTANTS.DEVICE_REGISTRATION_STATUS_UNREGISTERED;
  }

  /**
   * Check device's subscription status
   * @returns {Promise<boolean>}
   */
  public async isSubscribed(): Promise<boolean> {
    return this.api.checkDeviceSubscribeForPushNotifications();
  }

  /**
   * Check current communication state
   * @returns {Promise<boolean>}
   */
  public async isCommunicationEnabled(): Promise<boolean> {
    const isCommunicationDisabled = await this.data.getStatusCommunicationDisabled();

    return !isCommunicationDisabled;
  }

  /**
   * Send "GDPRConsent" postEvent and depends on param "isEnabled"
   * device will be registered/unregistered from all communication channels.
   * @param {boolean} isEnabled
   * @returns {Promise<void>}
   */
  public async setCommunicationEnabled(isEnabled: boolean = true): Promise<void> {
    const deviceType = await this.data.getDeviceType();
    const isPermissionGranted = this.driver.checkIsPermissionGranted();

    await this.data.setStatusCommunicationDisabled(!isEnabled);

    if (isEnabled) {
      await this.data.setStatusDropAllData(false);
      if (isPermissionGranted) {
        await this.api.registerDevice();
      }
    } else {
      await this.api.unregisterDevice();
    }

    this.eventBus.dispatchEvent('change-enabled-communication', { isEnabled });

    await this.api.postEvent(CONSTANTS.EVENT_GDPR_CONSENT, {
      channel: isEnabled,
      device_type: deviceType,
    });
  }

  /**
   * Send "GDPRDelete" postEvent and remove all device device data from Pushwoosh.
   * @returns {Promise<void>}
   */
  public async removeAllDeviceData(): Promise<void> {
    const deviceType = await this.data.getDeviceType();

    await this.api.postEvent(CONSTANTS.EVENT_GDPR_DELETE, {
      status: true,
      device_type: deviceType,
    });

    await this.api.deleteDevice();
    await this.data.clearAll();

    await this.data.setStatusDropAllData(true);
  }

  /**
   * Method returns hardware id.
   * @returns {Promise<string>}
   */
  public async getHWID(): Promise<string> {
    return await this.data.getHwid();
  }

  /**
   * Method returns push token.
   * @returns {Promise<string>}
   */
  public async getPushToken(): Promise<string | undefined> {
    const { pushToken } = await this.data.getTokens();

    return pushToken;
  }

  /**
   * Method returns userId
   * @returns {Promise<string | null>}
   */
  public async getUserId(): Promise<string | undefined> {
    return await this.data.getUserId();
  }

  /**
   * Method returns an object with all params.
   */
  public async getParams(): Promise<IInitParams> {
    return await this.api.getParams();
  }

  /**
   * Method returns  true if notifications available.
   * @returns {boolean}
   */
  public isAvailableNotifications(): boolean {
    return this.platformChecker.isAvailableNotifications;
  }

  public async sendStatisticsVisitedPage() {
    const {
      document: { title },
      location: { origin, pathname, href },
    } = window;

    await this.api.pageVisit({
      title,
      url_path: `${origin}${pathname}`,
      url: href,
    });
  }

  private async initialize(params: IInitParams) {
    this.initParams = {
      ...defaultInitParams,
      ...params,
    };
    // base logger configuration
    const manualDebug = localStorage.getItem(CONSTANTS.MANUAL_SET_LOGGER_LEVEL);
    Logger.setLevel(manualDebug || params.logLevel || 'error');

    // if not available push notifications -> exit
    if (!this.isAvailableNotifications()) {
      return;
    }

    if (!params.applicationCode) {
      throw new Error('Can\'t find application code!');
    }

    // check communication disabled
    const initDisabled = params.communicationEnabled === false;
    const storedCommunicationEnabled = await this.data.getCommunicationEnabled();
    const storedOldCommunicationDisabled = await this.data.getStatusCommunicationDisabled();

    if ((initDisabled && storedCommunicationEnabled !== true) || storedCommunicationEnabled === false || storedOldCommunicationDisabled) {
      this.isCommunicationDisabled = true;
    }

    // get current application code
    const currentApplicationCode = await this.data.getApplicationCode();

    // if there is no previous application code or the application code has changed => remove all info about init params and subscription
    if (!currentApplicationCode || currentApplicationCode !== params.applicationCode) {
      await this.data.clearAll();
      await this.data.setApplicationCode(params.applicationCode);
    }

    // check hwid
    const hwid = await this.data.getHwid();

    if (!hwid) {
      await this.data.setHwid(params.applicationCode + '_' + v4());
    }

    // add info about platform
    await this.data.setDeviceType(this.platformChecker.getPlatformType());
    await this.data.setDeviceModel(this.platformChecker.getBrowserVersion());
    await this.data.setLanguage(params.tags?.Language || navigator.language);

    // set configuration info
    await this.data.setApiEntrypoint(params.pushwooshUrl || '');
    await this.data.setApiToken(params.apiToken || '');
    await this.data.setSdkVersion(getVersion());

    // get remote config
    const config = await this.api.getConfig([
      'page_visit',
      'vapid_key',
      'web_in_apps',
      'events',
      'subscription_prompt',
    ]);

    await this.onGetConfig(config && config.features);

    await this.open();

    // check user id
    const storedUserId = await this.data.getUserId();

    if (params.userId && params.userId !== 'user_id' && params.userId !== storedUserId) {
      await this.api.registerUser(params.userId);
    }

    // check email
    const storedEmail = await this.data.getEmail();

    if (params.email && params.email !== '' && params.email !== storedEmail) {
      // validate email
      if (/^\S+@\S+\.\S+$/.test(params.email)) {
        await this.api.registerEmail(params.email);
      } else {
        Logger.write('error', `can't register invalid email: ${params.email}`);
      }
    }

    // set tags
    if (params.tags) {
      this.api.setTags(params.tags);
    }

    //  init push notification
    const applicationServerKey = await this.data.getApplicationServerKey();
    if (applicationServerKey) {
      await this.initPushNotifications(params);
    }

    //  init submodules (inbox)
    try {
      await this.inboxModel.updateMessages();
    } catch (error) {
      Logger.write('error', error);
    }

    //  ready
    this.ready = true;
    this.eventBus.dispatchEvent('ready', {});

    const delayedEvent = await this.data.getDelayedEvent();

    if (delayedEvent) {
      const { type, payload } = delayedEvent;
      this.emitLegacyEventsFromServiceWorker(type, payload);
      await this.data.setDelayedEvent(null);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.onmessage = (event: MessageEvent) => this.onServiceWorkerMessage(event);
    }

    localStorage.setItem('pushwoosh-websdk-status', 'init');

    // Dispatch 'pushwoosh.initialized' event
    document.dispatchEvent(new CustomEvent('pushwoosh.initialized', {
      detail: {
        pw: this,
      },
    }));

    // send push stat only in safari, because safari haven't service worker
    // in other browsers stat will be send in service worker
    if (this.platformChecker.isSafari) {
      const hashReg = /#P(.*)/;
      const hash = decodeURIComponent(document.location.hash);

      if (hashReg.test(hash)) {
        this.api
          .pushStat(hashReg.exec(hash)![1])
          .then(() => history.pushState(null, '', '#'));
      }
    }
  }

  /**
   * Default process during PW initialization.
   * Init API. Subscription to notifications.
   * Emit delayed events.
   */
  private async defaultProcess(): Promise<void> {
    const permission = this.driver.getPermission();

    if (permission === 'granted') {
      await this.data.setLastPermissionStatus(permission);
    }

    const isCommunicationDisabled = await this.data.getStatusCommunicationDisabled();
    const isDropAllData = await this.data.getStatusDropAllData();
    const isNeedResubscribe = await this.driver.checkIsNeedResubscribe();

    if (isCommunicationDisabled || isDropAllData) {
      await this.unsubscribe();

      return;
    }

    if (isNeedResubscribe) {
      await this.unsubscribe();
      await this.data.setStatusManualUnsubscribed(false);
      await this.data.setIsVapidChanged(false);
    }

    const isManualUnsubscribed = await this.data.getStatusManualUnsubscribed();

    // update status is register
    const isRegister = await this.api.checkDeviceSubscribeForPushNotifications(false);

    // Actions depending of the permissions
    switch (permission) {
      case CONSTANTS.PERMISSION_PROMPT:
      {
        // emit event permission default
        this.eventBus.dispatchEvent('permission-default', {});

        // device can't be register if permission default
        if (isRegister) {
          await this.unsubscribe();
        }

        break;
      }

      case CONSTANTS.PERMISSION_DENIED:
        // emit event permission denied
        this.eventBus.dispatchEvent('permission-denied', {});

        // device can't be register if permission default
        if (isRegister) {
          await this.unsubscribe();
        }

        break;
      case CONSTANTS.PERMISSION_GRANTED:
        // emit event permission granted
        this.eventBus.dispatchEvent('permission-granted', {});

        // device can't be register if manual unsubscribed
        if (isManualUnsubscribed && isRegister) {
          await this.unsubscribe();
        }

        // device must be register if not manual unsubscribed
        // or if change configuration -> resubscribe device for get new push token
        if (!isRegister && !isManualUnsubscribed || isNeedResubscribe) {
          await this.subscribe(true);
        }

        break;
    }
  }

  /**
   *
   * @param {MessageEvent} event
   */
  private onServiceWorkerMessage(event: MessageEvent) {
    const { data = {} } = event || {};
    const { type = '', payload = {} } = data || {};
    this.emitLegacyEventsFromServiceWorker(type, payload);
  }

  /**
   * Check device's session and call the appOpen method,
   * no more than once an hour.
   * Force need to Safari await subscribe status
   * @param {boolean} isForce
   * @returns {Promise<void>}
   */
  private async open(isForce?: boolean) {
    let lastApplicationOpenTime = await this.data.getLastOpenApplicationTime();
    const currentTime = Date.now();

    if (!lastApplicationOpenTime) {
      lastApplicationOpenTime = 0;
    }

    const isSendingPeriodExceeded = currentTime - lastApplicationOpenTime < CONSTANTS.PERIOD_SEND_APP_OPEN;
    const needSendOpenStatistics = isForce || !isSendingPeriodExceeded;

    if (!needSendOpenStatistics) {
      return;
    }

    await this.data.setLastOpenApplicationTime(currentTime);
    await this.api.applicationOpen();
  }

  private async onGetConfig(features: IMapResponse['getConfig']['features']) {
    await this.data.setFeatures(features);

    if (features) {
      // page visited feature
      if (features.page_visit && features.page_visit.enabled) {
        await keyValue.set(CONSTANTS.PAGE_VISITED_URL, features.page_visit.entrypoint);
        this.sendStatisticsVisitedPage();
      }

      // send default event, page visited
      if (features.events && features.events.length) {
        const isPageVisitedEvent = features.events.some(
          (event: string): boolean => event === CONSTANTS.EVENT_PW_SITE_OPENED,
        );
        if (isPageVisitedEvent) {
          this.sendPostEventVisitedPage();
        }
      }

      // vapid key
      if (features.vapid_key) {
        const previousServerKey = await this.data.getApplicationServerKey();

        await this.data.setApplicationServerKey(features.vapid_key);
        if (previousServerKey !== features.vapid_key) {
          await this.data.setIsVapidChanged(true);
        }
      }
    }
  }

  private async initPushNotifications(params: IInitParams): Promise<void> {
    await this.data.setDefaultNotificationImage(params.defaultNotificationImage);
    await this.data.setDefaultNotificationTitle(params.defaultNotificationTitle);
    await this.data.setServiceWorkerUrl(params.serviceWorkerUrl);
    await this.data.setServiceWorkerScope(params.scope);

    await this.data.setInitParams(params);

    await this.initDriver();

    // Default actions on init
    try {
      await this.defaultProcess();
    } catch (error) {
      Logger.error(error, 'Internal error: defaultProcess fail');
    }
  }

  private async initDriver(): Promise<void> {
    if (this.platformChecker.isSafari) {
      const { safariWebsitePushID: webSitePushId } = await this.data.getInitParams();

      if (!webSitePushId) {
        Logger.info('For work with Safari Push Notification add safariWebsitePushID to initParams!');
        return;
      }

      this.driver = new PushServiceSafari(this.api, this.data, { webSitePushId });

      return;
    }

    if (this.platformChecker.isAvailableServiceWorker) {
      this.driver = new PushServiceDefault(this.api, this.data, {});
    }
  }

  public sendPostEventVisitedPage() {
    const {
      document: { title },
      location: { href },
    } = window;

    this.api.postEvent(CONSTANTS.EVENT_PW_SITE_OPENED, {
      url: href,
      title: title,
      device_type: this.platformChecker.platform,
    });
  }

  /**
   * @private
   *
   * @param {string} type - legacy event type
   * @param {function} handler - legacy handler
   */
  private subscribeToLegacyEvents(type: string, handler: (api?: Api, payload?: any) => void): boolean {
    let isHandled = true;

    switch (true) {
      case type === CONSTANTS.LEGACY_EVENT_ON_LOAD:
        handler();
        break;

      case type === CONSTANTS.LEGACY_EVENT_ON_READY:
        if (this.ready) {
          handler(this.api);
          break;
        }

        this.eventBus.addEventHandler(
          'ready',
          () => handler(this.api),
        );
        break;

      case type in legacyEventsMap:
        this.eventBus.addEventHandler(
          legacyEventsMap[type].name as keyof EventHandlerMap,
          (payload: any) => {
            const { prop } = legacyEventsMap[type];
            handler(this.api, prop ? payload[prop] : undefined);
          },
        );
        break;

      default:
        isHandled = false;
    }

    return isHandled;
  }

  private emitLegacyEventsFromServiceWorker(type: string, payload?: any): void {
    switch (type) {
      case CONSTANTS.LEGACY_EVENT_ON_PUSH_DELIVERY:
        this.eventBus.dispatchEvent('receive-push', { notification: payload });
        break;

      case CONSTANTS.LEGACY_EVENT_ON_NOTIFICATION_CLICK:
        this.eventBus.dispatchEvent('open-notification', { notification: payload });
        break;

      case CONSTANTS.LEGACY_EVENT_ON_NOTIFICATION_CLOSE:
        this.eventBus.dispatchEvent('hide-notification', { notification: payload });
        break;

      case CONSTANTS.LEGACY_EVENT_ON_PUT_NEW_MESSAGE_TO_INBOX_STORE:
        this.eventBus.dispatchEvent('receive-inbox-message', { message: payload });
        break;
    }
  }
}
