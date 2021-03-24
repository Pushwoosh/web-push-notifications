import { v4 } from 'uuid';

import { EventBus } from './core/modules/EventBus';

import { Api } from './modules/Api/Api';
import { Data } from './modules/Data/Data';
import { ApiClient } from './modules/ApiClient/ApiClient';
import { PushServiceDefault, PushServiceSafari } from './services/PushService/PushService';
import { Popup } from './features/Popup/Popup';
import { SubscriptionSegmentsWidget } from './features/SubscriptionSegmentsWidget/SubscriptionSegmentsWidget';
import { SubscriptionPromptWidget } from './features/SubscriptionPromptWidget/SubscriptionPromptWidget';
import { ISubscriptionPromptWidgetParams } from './features/SubscriptionPromptWidget/SubscriptionPromptWidget.types';

import * as CONSTANTS from './constants';

import { IMapResponse } from './modules/ApiClient/ApiClient.types';

import {clearLocationHash} from './functions';
import {PlatformChecker} from './modules/PlatformChecker';

import { Logger } from './logger'
import FacebookModule from './modules/FacebookModule';
import {InApps} from './modules/InApps/InApps';
import {keyValue, log as logStorage, message as messageStorage} from './storage';

import InboxMessagesModel from './models/InboxMessages';
import InboxMessagesPublic from './modules/InboxMessagesPublic';

import { IPushService } from './services/PushService/PushService.types';

export default class Pushwoosh {
  public ready: boolean = false;

  private readonly eventBus: EventBus;

  private readonly data: Data;
  private readonly apiClient: ApiClient;
  private isCommunicationDisabled?: boolean;
  public readonly api: Api;
  public readonly subscriptionSegmentWidget: SubscriptionSegmentsWidget;
  public readonly subscriptionPromptWidget: SubscriptionPromptWidget;
  public driver: IPushService;
  private platformChecker: PlatformChecker;
  public subscribeWidgetConfig: ISubscribeWidget;
  public inboxWidgetConfig: IInboxWidget;
  public subscribePopupConfig: any;
  public InApps: InApps;

  // Inbox messages public interface
  public pwinbox: InboxMessagesPublic;
  private inboxModel: InboxMessagesModel;

  constructor() {
    this.eventBus = new EventBus();

    this.data = new Data();
    this.apiClient = new ApiClient(this.data);

    this.api = new Api(this.eventBus, this.data, this.apiClient);

    this.platformChecker = new PlatformChecker()
    this.inboxModel = new InboxMessagesModel(this.eventBus, this.data, this.api);
    this.pwinbox = new InboxMessagesPublic(this.data, this.api, this.inboxModel);

    // Bindings
    this.onServiceWorkerMessage = this.onServiceWorkerMessage.bind(this);

    const popup = new Popup(
      'subscription-segments',
      () => this.eventBus.dispatchEvent('hide-subscription-widget', {}),
      { position: 'top' }
    );
    // need inject this because need call subscribe method
    // can't use command bus, because need call synchronically
    this.subscriptionSegmentWidget = new SubscriptionSegmentsWidget(
      this.eventBus,
      this.data,
      this.apiClient,
      this.api,
      popup,
      this
    );

    // create subscription prompt widget
    this.subscriptionPromptWidget = new SubscriptionPromptWidget(this.eventBus, this);
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
    }
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
    if (typeof command === 'function') {
      this.subscribeToLegacyEvents('onReady', command);
      return;
    }

    if (!Array.isArray(command)) {
      throw new Error('Invalid command!');
    }

    switch (command[0]) {
      case 'init':
        this.initialize(command[1]);

        break;
      case CONSTANTS.EVENT_ON_READY:
      case CONSTANTS.EVENT_ON_REGISTER:
      case CONSTANTS.EVENT_ON_SUBSCRIBE:
      case CONSTANTS.EVENT_ON_UNSUBSCRIBE:
      case CONSTANTS.EVENT_ON_SW_INIT_ERROR:
      case CONSTANTS.EVENT_ON_PUSH_DELIVERY:
      case CONSTANTS.EVENT_ON_NOTIFICATION_CLICK:
      case CONSTANTS.EVENT_ON_NOTIFICATION_CLOSE:
      case CONSTANTS.EVENT_ON_CHANGE_COMMUNICATION_ENABLED:
      case CONSTANTS.EVENT_ON_PUT_NEW_MESSAGE_TO_INBOX_STORE:
      case CONSTANTS.EVENT_ON_UPDATE_INBOX_MESSAGES:
      case CONSTANTS.EVENT_ON_SHOW_NOTIFICATION_PERMISSION_DIALOG:
      case CONSTANTS.EVENT_ON_HIDE_NOTIFICATION_PERMISSION_DIALOG:
      case CONSTANTS.EVENT_ON_SHOW_SUBSCRIPTION_WIDGET:
      case CONSTANTS.EVENT_ON_HIDE_SUBSCRIPTION_WIDGET:
      case CONSTANTS.EVENT_ON_PERMISSION_DENIED:
      case CONSTANTS.EVENT_ON_PERMISSION_PROMPT:
      case CONSTANTS.EVENT_ON_PERMISSION_GRANTED:
        this.subscribeToLegacyEvents(command[0], command[1]);
        break;

      default:
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
      const needSubscribe = isForceSubscribe || !isManualUnsubscribed;

      if (needSubscribe && !isDeviceRegister) {
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
  public async unsubscribe() {
    try {
      await this.driver.unsubscribe();
    } catch (error) {
      Logger.error(error, 'Error occurred during the unsubscribe');
    }
  }

  /**
   * force subscribe if there was a manual unsubscribe
   * @returns {Promise<void>}
   */
  public async forceSubscribe() {
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
  public async isCommunicationEnabled() {
    const isCommunicationDisabled = await this.data.getStatusCommunicationDisabled();

    return !isCommunicationDisabled;
  }

  /**
   * Send "GDPRConsent" postEvent and depends on param "isEnabled"
   * device will be registered/unregistered from all communication channels.
   * @param {boolean} isEnabled
   * @returns {Promise<void>}
   */
  public async setCommunicationEnabled(isEnabled: boolean = true) {
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
  public async removeAllDeviceData() {
    const deviceType = await this.data.getDeviceType();

    await this.api.postEvent(CONSTANTS.EVENT_GDPR_DELETE, {
      status: true,
      device_type: deviceType
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
   * @returns {Promise<IPWParams>}
   */
  public async getParams() {
    return await this.api.getParams();
  }

  /**
   * Method returns  true if notifications available.
   * @returns {boolean}
   */
  public isAvailableNotifications() {
    return this.platformChecker.isAvailableNotifications;
  }

  public async sendStatisticsVisitedPage() {
    const {
      document: { title },
      location: { origin, pathname, href }
    } = window;

    await this.api.pageVisit({
      title,
      url_path: `${origin}${pathname}`,
      url: href
    });
  }

  public async isEnableChannels(): Promise<boolean> {
    const features = await this.data.getFeatures();
    const channels = features && features['channels'];

    return Array.isArray(channels) && !!channels.length;
  }

  private async initialize(params: IInitParams) {
    // step 0: base logger configuration
    const manualDebug = localStorage.getItem(CONSTANTS.MANUAL_SET_LOGGER_LEVEL);
    Logger.setLevel(manualDebug || params.logLevel || 'error');

    // step 0: if not available push notifications -> exit
    if (!this.platformChecker.isAvailableNotifications) {
      return;
    }

    // step 1: check application code
    const applicationCode = await this.data.getApplicationCode();

    if (!params.applicationCode) {
      throw new Error('Can\'t find application code!');
    }

    const notSavedApplicationCode = !applicationCode;
    const isChangeApplicationCode = applicationCode && applicationCode !== params.applicationCode;

    // if have not old application code or application code was change => remove all info about init params and subscription
    if (notSavedApplicationCode || isChangeApplicationCode) {
      await this.data.clearAll();
      await this.data.setApplicationCode(params.applicationCode);
    }

    // step 2: check hwid
    const hwid = await this.data.getHwid();

    if (!hwid) {
      const id = params.applicationCode + '_' + v4();

      await this.data.setHwid(id);
    } else {
      await this.api.checkDevice();
    }

    // step 3: add info about platform
    await this.data.setDeviceType(this.platformChecker.getPlatformType());
    await this.data.setDeviceModel(this.platformChecker.getBrowserVersion());
    await this.data.setLanguage(params.tags && params.tags.Language || navigator.language);

    // step 4: set configuration info
    if (params.pushwooshUrl) {
      await this.data.setApiEntrypoint(params.pushwooshUrl);
    }

    await this.data.setSdkVersion(__VERSION__);

    // step 5: get remote config
    const config = await this.api.getConfig([
      'page_visit',
      'vapid_key',
      'web_in_apps',
      'events',
      'subscription_prompt'
    ]);

    this.onGetConfig(config && config.features);

    // set default configs
    this.subscribeWidgetConfig = {
      enable: false,
      ...params.subscribeWidget
    };

    this.inboxWidgetConfig = {
      enable: false,
      ...params.inboxWidget
    };

    this.subscribePopupConfig = {
      enable: false,
      ...params.subscribePopup
    };

    // step 6: check communication disabled
    this.isCommunicationDisabled = await this.data.getStatusCommunicationDisabled();

    await this.open();

    // step 7: check user id
    const userIdWasChange = await this.data.getStatusUserIdWasChanged();

    if (params.userId && params.userId !== 'user_id' && !userIdWasChange) {
      await this.api.registerUser(params.userId);
    }

    // set tags
    if (params.tags) {
      this.api.setTags(params.tags);
    }

    // step 8: init submodules module in app (need before push notification because in apps use in subscription segments widget)
    const inAppsConfig: IInitParams['inApps'] = {
      enable: config.features.web_in_apps && config.features.web_in_apps.enabled,
      ...params.inApps,
    };

    // step 9: init submodules module in app (need before push notification because in apps use in subscription segments widget)
    await this.initInApp(inAppsConfig);

    // step 10: init push notification
    if (this.platformChecker.isAvailableNotifications) {
      await this.initPushNotifications(params);
    }

    // step 11: init submodules (inbox, facebook)
    try {
      await this.inboxModel.updateMessages();
    } catch (error) {
      Logger.write('error', error);
    }

    try {
      await this.initFacebook(params);
    } catch (error) {
      Logger.write('error', error);
    }

    // step 12: ready
    this.ready = true;
    this.eventBus.dispatchEvent('ready', {});

    const delayedEvent = await this.data.getDelayedEvent();

    if (delayedEvent) {
      const { type, payload } = delayedEvent;
      await this.emitLegacyEventsFromServiceWorker(type, payload);
      await this.data.setDelayedEvent(null);
    }

    if ('serviceWorker' in navigator) {
      // @ts-ignore
      navigator.serviceWorker.onmessage = this.onServiceWorkerMessage;
    }

    localStorage.setItem('pushwoosh-websdk-status', 'init');

    // Dispatch 'pushwoosh.initialized' event
    document.dispatchEvent(new CustomEvent('pushwoosh.initialized', {
      detail: {
        pw: this
      }
    }));

    // send push stat only in safari, because safari haven't service worker
    // in other browsers stat will be send in service worker
    if (this.platformChecker.isSafari) {
      const hashReg: any = /#P(.*)/;
      const hash = decodeURIComponent(document.location.hash);

      if (hashReg.test(hash)) {
        this.api
          .pushStat(hashReg.exec(hash)[1])
          .then(clearLocationHash);
      }
    }
  }

  /**
   * Default process during PW initialization.
   * Init API. Subscription to notifications.
   * Emit delayed events.
   * @returns {Promise<void>}
   */
  private async defaultProcess(initParams: IInitParams) {
    const permission = this.driver.getPermission();

    if (permission === 'granted') {
      await this.data.setLastPermissionStatus(permission);
    }

    const isCommunicationDisabled = await this.data.getStatusCommunicationDisabled();
    const isDropAllData = await this.data.getStatusDropAllData();
    const isNeedResubscribe = await this.driver.checkIsNeedResubscribe();
    const features = await this.data.getFeatures();
    const currentPromptUseCase = features['subscription_prompt'] && features['subscription_prompt']['use_case'];

    if (isCommunicationDisabled || isDropAllData) {
      await this.unsubscribe();

      return;
    }

    if (isNeedResubscribe) {
      await this.unsubscribe();
      await this.data.setStatusManualUnsubscribed(false);
    }

    const { autoSubscribe } = initParams;
    const isManualUnsubscribed = await this.data.getStatusManualUnsubscribed();

    // update status is register
    const isRegister = await this.api.checkDeviceSubscribeForPushNotifications(false);

    // Actions depending of the permissions
    switch (permission) {
      case CONSTANTS.PERMISSION_PROMPT:
        // emit event permission default
        this.eventBus.dispatchEvent('permission-default', {});

        // device can't be register if permission default
        if (isRegister) {
          await this.unsubscribe();
        }

        // topic based widget have not capping params, get defaults
        const widgetConfig = await this.getWidgetConfig();
        const canShowByCapping = await this.checkCanShowByCapping(widgetConfig);

        if (!canShowByCapping) {
          break;
        }

        // show subscription segment widget
        const isTopicBasedUseCase = currentPromptUseCase === CONSTANTS.SUBSCRIPTION_WIDGET_USE_CASE_TOPIC_BASED;

        if (isTopicBasedUseCase) {
          await this.subscriptionSegmentWidget.init();
        }

        // show subscription prompt widget
        const isDefaultUseCase = currentPromptUseCase === CONSTANTS.SUBSCRIPTION_WIDGET_USE_CASE_DEFAULT;
        const isNotSetUseCase = currentPromptUseCase === CONSTANTS.SUBSCRIPTION_WIDGET_USE_CASE_NOT_SET && autoSubscribe;

        // show subscription prompt widget
        if (isDefaultUseCase || isNotSetUseCase) {
          this.subscriptionPromptWidget.init(widgetConfig);
          this.subscriptionPromptWidget.show();
        }

        await this.updateCappingParams();

        break;

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

          // show subscription segment widget
          const isTopicBasedUseCase = currentPromptUseCase === CONSTANTS.SUBSCRIPTION_WIDGET_USE_CASE_TOPIC_BASED;

          // if topic based widget need set default channels
          if (isTopicBasedUseCase) {
            const result = features.channels.map((channel: { code: string }) => channel.code);

            await this.api.setTags({
              'Subscription Segments': result
            })
          }
        }

        break;
    }
  }

  private async getWidgetConfig(): Promise<ISubscriptionPromptWidgetParams> {
    const features = await this.data.getFeatures();

    // get config by features from get config method
    const currentConfig = features['subscription_prompt_widget'] && features['subscription_prompt_widget'].params;

    // merge current config with capping defaults
    const configWithDefaultCapping: ISubscriptionPromptWidgetParams = {
      cappingCount: CONSTANTS.SUBSCRIPTION_PROMPT_WIDGET_DEFAULT_CONFIG.cappingCount,
      cappingDelay: CONSTANTS.SUBSCRIPTION_PROMPT_WIDGET_DEFAULT_CONFIG.cappingDelay,
      ...currentConfig
    };

    // if current config is not exist show with default values
    return currentConfig
      ? configWithDefaultCapping
      : CONSTANTS.SUBSCRIPTION_PROMPT_WIDGET_DEFAULT_CONFIG;
  }

  private async checkCanShowByCapping(widgetConfig: ISubscriptionPromptWidgetParams): Promise<boolean> {
    const currentTime = new Date().getTime();
    const displayCount = await this.data.getPromptDisplayCount();
    const lastSeenTime = await this.data.getPromptLastSeenTime();

    // can show by max display count
    const canShowByCapping = widgetConfig.cappingCount > displayCount;

    // can show last seen time
    const canShowByLastTime = currentTime - lastSeenTime > widgetConfig.cappingDelay;

    return canShowByCapping && canShowByLastTime;
  }

  private async updateCappingParams(): Promise<void> {
    const displayCount = await this.data.getPromptDisplayCount();
    const currentTime = new Date().getTime();

    await this.data.setPromptDisplayCount(displayCount + 1);
    await this.data.setPromptLastSeenTime(currentTime);
  }

  /**
   * Method initiates Facebook
   * @param {IInitParams} initParams
   * @returns {Promise<void>}
   */
  private initFacebook(initParams: IInitParams) {
    const facebook = {
      enable: false,
      pageId: '',
      containerClass: '',
      ...initParams.facebook
    };

    if (facebook && facebook.enable) {
      try {
        new FacebookModule({
          pageId: facebook.pageId,
          containerClass: facebook.containerClass,
          applicationCode: initParams.applicationCode,
          userId: initParams.userId || ''
        });
      } catch (error) {
        Logger.error(error, 'facebook module initialization failed');
      }
    }
  }

  /**
   * Method for init InApp module
   * @param {IInitParams} params
   * @return {Promise<void>}
   */
  private async initInApp(params: IInitParams['inApps']) {
    if (params && params.enable) {
      try {
        this.InApps = new InApps(params, this, this.eventBus, this.api);

        await this.InApps.init()
          .then(() => {
            Logger.info('InApps module has been initialized');

            this.eventBus.dispatchEvent('initialize-in-apps-module', {});
          })
          .catch((error) => {
            Logger.error(error, 'InApps module initialization has been failed');
          });
      } catch (error) {
        Logger.error(error, 'InApp module initialization has been failed')
      }
    }
  }

  /**
   *
   * @param {MessageEvent} event
   */
  private onServiceWorkerMessage(event: ServiceWorkerMessageEvent) {
    const {data = {}} = event || {};
    const {type = '', payload = {}} = data || {};
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
          ((event: string): boolean => event  === CONSTANTS.EVENT_PW_SITE_OPENED)
        );
        if (isPageVisitedEvent) {
          this.sendPostEventVisitedPage();
        }
      }

      // vapid key
      if (features.vapid_key) {
        await this.data.setApplicationServerKey(features.vapid_key)
      }
    }
  }

  private async initPushNotifications(params: IInitParams): Promise<void> {
    await this.data.setDefaultNotificationImage(params.defaultNotificationImage);
    await this.data.setDefaultNotificationTitle(params.defaultNotificationTitle);
    await this.data.setServiceWorkerUrl(params.serviceWorkerUrl);
    await this.data.setServiceWorkerScope(params.scope);

    await this.data.setInitParams({
      autoSubscribe: true,
      ...params,
    });

    await this.initDriver();

    // Default actions on init
    try {
      await this.defaultProcess(params);
    } catch (error) {
      Logger.error(error, 'Internal error: defaultProcess fail');
    }
  }

  private async initDriver(): Promise<void> {
    if (this.platformChecker.isSafari) {
      const { safariWebsitePushID: webSitePushId } = await this.data.getInitParams();

      if (!webSitePushId) {
        throw new Error('For work with Safari Push Notification add safariWebsitePushID to initParams!');
      }

      this.driver = new PushServiceSafari(this.api, this.data, { webSitePushId });

      return;
    }

    if (this.platformChecker.isAvailableServiceWorker) {
      this.driver = new PushServiceDefault(this.api, this.data, {});

      return;
    }
  }

  public async sendPostEventVisitedPage() {
    const {
      document: { title },
      location: { href }
    } = window;

    this.api.postEvent(CONSTANTS.EVENT_PW_SITE_OPENED, {
      url: href,
      title: title,
      device_type: this.platformChecker.platform
    });
  }

  /**
   * @private
   *
   * @param {string} type - legacy event type
   * @param {function} handler - legacy handler
   */
  private subscribeToLegacyEvents(type: string, handler: (api: Api, payload?: any) => void): void {
    switch (type) {
      case CONSTANTS.EVENT_ON_READY:
        if (this.ready) {
          handler(this.api);
          break;
        }

        this.eventBus.addEventHandler(
          'ready',
          () => handler(this.api),
        );
        break;

      case CONSTANTS.EVENT_ON_REGISTER:
        this.eventBus.addEventHandler(
          'register',
          () => handler(this.api),
        );
        break;

      case CONSTANTS.EVENT_ON_SUBSCRIBE:
        this.eventBus.addEventHandler(
          'subscribe',
          () => handler(this.api),
        );
        break;

      case CONSTANTS.EVENT_ON_UNSUBSCRIBE:
        this.eventBus.addEventHandler(
          'unsubscribe',
          () => handler(this.api),
        );
        break;

      case CONSTANTS.EVENT_ON_SW_INIT_ERROR:
        this.eventBus.addEventHandler(
          'initialize-service-worker-error',
          ({ error }) => handler(this.api, error),
        );
        break;

      case CONSTANTS.EVENT_ON_PUSH_DELIVERY:
        this.eventBus.addEventHandler(
          'receive-push',
          ({ notification }) => handler(this.api, notification),
        );
        break;

      case CONSTANTS.EVENT_ON_NOTIFICATION_CLICK:
        this.eventBus.addEventHandler(
          'open-notification',
          ({ notification }) => handler(this.api, notification),
        );
        break;

      case CONSTANTS.EVENT_ON_NOTIFICATION_CLOSE:
        this.eventBus.addEventHandler(
          'hide-notification',
          ({ notification }) => handler(this.api, notification),
        );
        break;

      case CONSTANTS.EVENT_ON_CHANGE_COMMUNICATION_ENABLED:
        this.eventBus.addEventHandler(
          'change-enabled-communication',
          ({ isEnabled }) => handler(this.api, isEnabled),
        );
        break;

      case CONSTANTS.EVENT_ON_PUT_NEW_MESSAGE_TO_INBOX_STORE:
        this.eventBus.addEventHandler(
          'receive-inbox-message',
          ({ message }) => handler(this.api, message),
        );
        break;

      case CONSTANTS.EVENT_ON_UPDATE_INBOX_MESSAGES:
        this.eventBus.addEventHandler(
          'update-inbox-messages',
          ({ messages }) => handler(this.api, messages),
        );
        break;

      case CONSTANTS.EVENT_ON_SHOW_NOTIFICATION_PERMISSION_DIALOG:
        this.eventBus.addEventHandler(
          'show-notification-permission-dialog',
          () => handler(this.api),
        );
        break;

      case CONSTANTS.EVENT_ON_HIDE_NOTIFICATION_PERMISSION_DIALOG:
        this.eventBus.addEventHandler(
          'hide-notification-permission-dialog',
          ({ permission }) => handler(this.api, permission),
        );
        break;

      case CONSTANTS.EVENT_ON_SHOW_SUBSCRIPTION_WIDGET:
        this.eventBus.addEventHandler(
          'show-subscription-widget',
          () => handler(this.api),
        );
        break;

      case CONSTANTS.EVENT_ON_HIDE_SUBSCRIPTION_WIDGET:
        this.eventBus.addEventHandler(
          'hide-subscription-widget',
          () => handler(this.api),
        );
        break;

      case CONSTANTS.EVENT_ON_PERMISSION_DENIED:
        this.eventBus.addEventHandler(
          'permission-denied',
          () => handler(this.api),
        );
        break;

      case CONSTANTS.EVENT_ON_PERMISSION_PROMPT:
        this.eventBus.addEventHandler(
          'permission-default',
          () => handler(this.api),
        );
        break;

      case CONSTANTS.EVENT_ON_PERMISSION_GRANTED:
        this.eventBus.addEventHandler(
          'permission-granted',
          () => handler(this.api),
        );
        break;
    }
  }

  private emitLegacyEventsFromServiceWorker(type: string, payload?: any): void {
    switch (type) {
      case CONSTANTS.EVENT_ON_PUSH_DELIVERY:
        this.eventBus.dispatchEvent('receive-push', { notification: payload });
        break;

      case CONSTANTS.EVENT_ON_NOTIFICATION_CLICK:
        this.eventBus.dispatchEvent('open-notification', { notification: payload });
        break;

      case CONSTANTS.EVENT_ON_NOTIFICATION_CLOSE:
        this.eventBus.dispatchEvent('hide-notification', { notification: payload });
        break;

      case CONSTANTS.EVENT_ON_PUT_NEW_MESSAGE_TO_INBOX_STORE:
        this.eventBus.dispatchEvent('receive-inbox-message', { message: payload });
        break;
    }
  }
}
