import * as CONSTANTS from './constants';
import { defaultInitParams } from './defaultInitParams';
import { type EventHandlerMap, type EventName } from './events.types';
import { createStuckAwareWait, getGlobal, getVersion, isFunction, v4 } from './functions';
import { legacyEventsMap } from './legacyEventsMap';
import { Logger } from './logger';
import { EventBus } from './modules/EventBus';
import { type IInitParams, type IModuleRegistry, type PWInput } from './Pushwoosh.types';
import type { IServerInitParams } from './resolveInitParams';
import { resolveInitParams, serverInitParams } from './resolveInitParams';
import { keyValue, log as logStorage, message as messageStorage } from './storage';
import { getPagePath } from '../helpers/pagePath';
import { type TLoggerOutputLevels } from '../helpers/pwlogger';
import InboxMessagesModel from '../models/InboxMessages';
import { Api } from '../modules/Api/Api';
import { ApiClient } from '../modules/ApiClient/ApiClient';
import { getApiStatusCode } from '../modules/ApiClient/ApiClient.errors';
import { Data } from '../modules/Data/Data';
import { FeatureFlags } from '../modules/FeatureFlags/FeatureFlags';
import InboxMessagesPublic from '../modules/InboxMessagesPublic';
import { PlatformChecker } from '../modules/PlatformChecker';
import { UNIFIED_PLATFORM } from '../modules/PlatformChecker/PlatformChecker.constants';
import { type TPlatform } from '../modules/PlatformChecker/PlatformChecker.types';
import { Recommendations } from '../modules/Recommendations/Recommendations';
import { type IProductView } from '../modules/Recommendations/Recommendations.types';
import { SdkUsage } from '../modules/SdkUsage/SdkUsage';
import { hasLegacySafariSubscription, mapPushPermission, readPushPermissionStatus, type TPushPermissionStatus } from '../services/PushService/pushPermissionStatus';
import { PushServiceDefault, PushServiceSafari } from '../services/PushService/PushService';
import { type IPushService } from '../services/PushService/PushService.types';
import { type IWebPopupsPublicApi } from '../widgets/WebPopups/types';

export class Pushwoosh {
  public ready: boolean = false;

  public initParams: IInitParams;

  /** Exactly what init was called with: the resolver needs it to tell a default from a choice. */
  private rawInitParams: IInitParams = {} as IInitParams;

  private readonly eventBus: EventBus;

  public readonly data: Data;
  private readonly apiClient: ApiClient;
  private isCommunicationDisabled?: boolean;
  public readonly api: Api;
  // Unset when push is unavailable: unsupported browser, no vapid key, no
  // safariWebsitePushID. Guard every use — the rest of the SDK works without it.
  public driver?: IPushService;
  public platformChecker: PlatformChecker;

  // `pushNotifications: false`: the driver is still created so unsubscribe()
  // keeps working, but nothing push-related happens on its own.
  private isPushDisabled: boolean = false;

  // Set when the API rejects the application code: every later request would
  // be rejected the same way, so init stops instead of repeating it per module.
  private isInitAborted: boolean = false;

  // What the last applicationOpen of this page carried: a permission change event
  // or a closed dialog that changed nothing must not cost an extra request.
  private isPushPermissionWatched: boolean = false;
  private subscriptionInFlight: Promise<void> | null = null;

  // From getConfig: vapid_key alone can be the FCM fallback, which can't reach Safari's push service.
  private isWebVapidConfigured: boolean = false;

  // Decided once per platform resolution, so every reader of init sees one answer.
  private isLegacySafari: boolean = false;

  // The last permission the site heard of; the baseline is the one at init.
  private knownPermission?: NotificationPermission;
  private readonly waitForPermissionWork = createStuckAwareWait(CONSTANTS.SUBSCRIPTION_WAIT_TIMEOUT_MS);

  // Inbox messages public interface
  public pwinbox: InboxMessagesPublic;
  private inboxModel: InboxMessagesModel;

  public moduleRegistry: IModuleRegistry = {};

  public readonly featureFlags: FeatureFlags;

  private readonly sdkUsage = new SdkUsage();

  /** Onsite product recommendations: headless `fetch` and `trackClick`, the widget renders through them. */
  public readonly recommendations: Recommendations;

  // Set by the CDN loader, which knows where the widget bundles live; absent on npm.
  public widgetLoader?: (widgetName: string) => Promise<boolean>;

  constructor() {
    this.eventBus = new EventBus();

    this.data = new Data();
    this.apiClient = new ApiClient(this.data);

    this.api = new Api(
      this.eventBus,
      this.data,
      this.apiClient,
      () => this.isCommunicationDisabled,
      () => this.getInitUserId(),
      () => this.getPushPermissionStatus(),
    );

    this.featureFlags = new FeatureFlags({
      eventBus: this.eventBus,
      data: this.data,
      postEvent: (event, attributes) => this.api.postEvent(event, attributes),
      isCommunicationDisabled: () => !!this.isCommunicationDisabled,
      isDeviceRegistered: () => this.isDeviceRegistered(),
    });

    this.recommendations = new Recommendations({
      postEvent: (event, attributes, init) => this.api.postEvent(event, attributes, init),
      isCommunicationDisabled: () => !!this.isCommunicationDisabled,
      getApplicationCode: () => this.data.getApplicationCode(),
      getHwid: () => this.data.getHwid(),
      getEndpoint: () => this.initParams?.recommendations?.endpoint,
    });

    this.platformChecker = new PlatformChecker(getGlobal());
    this.inboxModel = new InboxMessagesModel(this.eventBus, this.data, this.api);
    this.pwinbox = new InboxMessagesPublic(
      this.data,
      this.api,
      this.inboxModel,
      this.moduleRegistry,
      () => this.loadWebPopupsWidget(),
    );
  }

  // The CDN loader skips the web popups bundle for an application without
  // active campaigns, yet an inbox message can still open a popup content.
  private async loadWebPopupsWidget(): Promise<IWebPopupsPublicApi | undefined> {
    if (this.moduleRegistry.webPopups || !this.widgetLoader || this.initParams?.webPopups?.enable === false) {
      return this.moduleRegistry.webPopups;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timeoutId = setTimeout(() => resolve(false), CONSTANTS.WIDGET_LOAD_TIMEOUT_MS);
    });

    await Promise.race([this.widgetLoader('web-popups'), timeout]);
    clearTimeout(timeoutId);

    // The bundle registers the widget while its script runs, before onload fires.
    return this.moduleRegistry.webPopups;
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
  ): void => {
    this.sdkUsage.recordEvent(name);
    this.eventBus.addEventHandler(name, handler);
  };

  /** For SDK widgets: same as addEventHandler, but not counted as the site's own subscription. */
  public addSdkEventHandler = <Name extends EventName>(
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
    const subscription = this.runSubscribe(isForceSubscribe);
    this.subscriptionInFlight = subscription;

    try {
      await subscription;
    } finally {
      if (this.subscriptionInFlight === subscription) {
        this.subscriptionInFlight = null;
      }
    }
  }

  private async runSubscribe(isForceSubscribe: boolean): Promise<void> {
    if (this.isCommunicationDisabled) {
      throw new Error('Communication is disabled!');
    }

    if (this.isPushDisabled) {
      throw new Error('Push notifications are disabled by the "pushNotifications" init param!');
    }

    const driver = this.requireDriver();

    const isPermissionDefault = driver.checkIsPermissionDefault();

    // if permission granted need ask permission for send notifications
    if (isPermissionDefault) {
      // emit event when permission dialog show
      this.eventBus.dispatchEvent('show-notification-permission-dialog', {});
      // all action before this MUST be a synchrony because
      // in new release in ff 72 we must call this event by user
      // ask permission
      // ask permissions only show prompt window, not register device for send push notifications
      await driver.askPermission();

      const permission = driver.getPermission();

      // emit event when permission dialog hide with permission state
      this.eventBus.dispatchEvent('hide-notification-permission-dialog', { permission });

      // A dialog closed without an answer changes nothing.
      if (permission !== CONSTANTS.PERMISSION_PROMPT) {
        this.announcePermissionChange(permission);
      }
    }

    const permission = driver.getPermission();
    const isManualUnsubscribed = await this.data.getStatusManualUnsubscribed();
    const isDeviceRegister = await this.api.checkDeviceSubscribeForPushNotifications(false);

    // if permission granted emit event and register device into pushwoosh
    if (permission === CONSTANTS.PERMISSION_GRANTED) {
      this.eventBus.dispatchEvent('permission-granted', {});
      const needSubscribe = !isDeviceRegister && !isManualUnsubscribed;

      if (needSubscribe || isForceSubscribe) {
        await driver.subscribe();
      }

      this.eventBus.dispatchEvent('subscribe', {});

      return;
    }

    // if permission denied emit event
    if (permission === CONSTANTS.PERMISSION_DENIED) {
      this.eventBus.dispatchEvent('permission-denied', {});

      if (isDeviceRegister) {
        await driver.unsubscribe();
      }

      this.reportPushPermissionChangeInBackground();

      return;
    }
  }

  /**
   * Unsubscribe device.
   * @returns {Promise<void>}
   */
  public async unsubscribe(): Promise<void> {
    try {
      await this.requireDriver().unsubscribe();
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
    await this.data.setCommunicationEnabled(isEnabled);

    if (isEnabled) {
      this.isCommunicationDisabled = false;
      await this.data.setStatusDropAllData(false);
      await this.finishInit();
      const isPermissionGranted = this.driver?.checkIsPermissionGranted();
      if (isPermissionGranted) {
        await this.api.registerDevice();
        await this.sendData();
      }
    } else {
      this.featureFlags.reset();
      await this.api.unregisterDevice();
    }

    this.eventBus.dispatchEvent('change-enabled-communication', { isEnabled });

    const deviceType = await this.data.getDeviceType();
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
    this.featureFlags.reset();

    await this.data.setStatusDropAllData(true);
  }

  /** Reports a product page view (`PW_ProductView`), the input of "You viewed" and of the product pairs. */
  public trackProductView(product: IProductView): Promise<void> {
    return this.recommendations.trackProductView(product);
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

  /** True when the site can subscribe: browser supports push, driver created, `pushNotifications` not false. */
  public isPushAvailable(): boolean {
    return !!this.driver && !this.isPushDisabled;
  }

  /** Driver accessor for push-only paths: readable error instead of a TypeError. */
  private requireDriver(): IPushService {
    if (!this.driver) {
      throw new Error(
        'Push notifications are not available: '
        + 'the browser does not support them, or the application has no push configuration. '
        + 'Web popups, inbox, events and tags do not require it.',
      );
    }

    return this.driver;
  }

  private async initialize(params: IInitParams) {
    this.rawInitParams = { ...params };
    this.sdkUsage.recordInitParams(params);
    this.initParams = {
      ...defaultInitParams,
      ...params,
    };

    // A re-init with a corrected applicationCode has to run: the SDK instance
    // lives for the whole page, so a stale abort would silence it for good.
    this.isInitAborted = false;
    // base logger configuration
    const manualDebug = localStorage.getItem(CONSTANTS.MANUAL_SET_LOGGER_LEVEL);
    Logger.setLevel(manualDebug || params.logLevel || 'error');
    if (params.logLevel) {
      await this.data.setLogLevel(params.logLevel as TLoggerOutputLevels);
    }

    this.isPushDisabled = params.pushNotifications === false;

    // Push is only a part of the SDK, so an unsupported browser (insecure
    // context, private window, in-app webview, iOS < 16.4) skips just that part.
    if (!this.isAvailableNotifications()) {
      Logger.info('Pushwoosh: push notifications are not available in this browser, initializing without them');
    }

    if (!params.applicationCode) {
      throw new Error('Can\'t find application code!');
    }

    // check communication disabled
    const initDisabled = params.communicationEnabled === false;
    const storedCommunicationEnabled = await this.data.getCommunicationEnabled();
    const storedOldCommunicationDisabled = await this.data.getStatusCommunicationDisabled();

    if (
      (initDisabled && storedCommunicationEnabled !== true)
      || storedCommunicationEnabled === false
      || storedOldCommunicationDisabled
    ) {
      this.isCommunicationDisabled = true;
    }

    // get current application code
    const currentApplicationCode = await this.data.getApplicationCode();
    const isUserIdChanged = await this.isUserIdChanged();
    const isApplicationCodeChanged = !currentApplicationCode || currentApplicationCode !== params.applicationCode;

    // if there is no previous application code or the application code has changed or user is has changed => remove all info about init params and subscription
    if (isApplicationCodeChanged || isUserIdChanged) {
      await this.data.setHwid('');
      await this.data.setUserId();
      await this.data.setEmail();
      await this.data.setStatusLanguageWasChanged(false);
    }

    await this.data.setApplicationCode(params.applicationCode);

    // add info about platform
    await this.data.setDeviceType(this.resolvePlatformType());
    await this.data.setFormFactor(this.platformChecker.formFactor);
    await this.data.setDeviceModel(this.platformChecker.getBrowserVersion());

    // Priority: api.setLanguage (manual) > initParams tags.Language > navigator.language
    const wasLanguageManuallySet = await this.data.getStatusLanguageWasChanged();
    if (!wasLanguageManuallySet) {
      await this.data.setLanguage(params.tags?.Language || navigator.language);
    }

    // set configuration info
    await this.data.setApiEntrypoint(params.pushwooshUrl || '');
    await this.data.setApiToken(params.apiToken || '');
    await this.data.setSdkVersion(getVersion());

    if (!this.isCommunicationDisabled) {
      await this.finishInit();

      if (this.isInitAborted) {
        return;
      }

      //  init submodules (inbox)
      try {
        // The bell has to work for a visitor who never granted push permission,
        // and an unregistered device has no inbox to sync.
        if (this.initParams.inboxWidget?.enable) {
          await this.api.ensureDeviceRegistered();
        }

        await this.inboxModel.updateMessages();
      } catch (error) {
        Logger.write('error', error);
      }

      const delayedEvent = await this.data.getDelayedEvent();

      if (delayedEvent) {
        const { type, payload } = delayedEvent;
        this.emitLegacyEventsFromServiceWorker(type, payload);
        await this.data.setDelayedEvent(null);
      }

      // send push stat only in legacy safari, because it has no service worker
      // in other browsers stat will be sent in service worker
      if (this.isLegacySafari) {
        const hashReg = /#P(.*)/;
        const hash = decodeURIComponent(document.location.hash);

        if (hashReg.test(hash)) {
          this.api
            .pushStat(hashReg.exec(hash)![1])
            .then(() => history.pushState(null, '', '#'));
        }
      }
    } else {
      this.eventBus.dispatchEvent('communication-disabled', {});
    }
  }

  private async finishInit(): Promise<void> {
    await this.ensureHwid();

    // Stored before anything can read them: api.getParams() and the Safari
    // driver take them from the store, whether or not the push part runs.
    await this.data.setInitParams(this.initParams);

    // A failure of any single step must not cost us the 'ready' event: widgets
    // (web popups, inbox) wait for it and none of them needs push.
    await this.initStep('loadConfig', () => this.loadConfig());

    // The panel config can carry unifiedPlatform, so the platform is resolved again before
    // anything reports it: applicationOpen, registerDevice and the driver choice.
    await this.data.setDeviceType(this.resolvePlatformType());

    await this.initStep('applicationOpen', () => this.open());

    await this.initStep('sendData', () => this.sendData());

    // Nothing left to initialize: no push, no 'ready', no widgets — they have
    // nothing to show while the application code is rejected.
    if (this.isInitAborted) {
      return;
    }

    //  init push notification
    if (this.isAvailableNotifications()) {
      const applicationServerKey = await this.data.getApplicationServerKey();

      if (applicationServerKey) {
        await this.initStep('initPushNotifications', () => this.initPushNotifications(this.initParams));
      } else {
        Logger.error('Pushwoosh: No vapid key found! Please, check your application settings in Pushwoosh dashboard.');
      }

      this.knownPermission = this.readPermission();
      await this.initStep('watchPushPermission', () => this.watchPushPermission());
    }

    // the cache is read before 'ready', so flags read in onReady come from it instead of null
    await this.featureFlags.start().catch((error) => Logger.error(error, 'Pushwoosh: feature flags failed to start'));

    //  ready
    this.ready = true;
    this.eventBus.dispatchEvent('ready', {});
    this.sdkUsage.listen((report, init) => this.api.sdkUsage(report, init));

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
  }

  /** Run an init step that may fail: init must always reach 'ready', or every widget stays silent. */
  private async initStep(name: string, step: () => Promise<void>): Promise<void> {
    if (this.isInitAborted) {
      return;
    }

    try {
      await step();
    } catch (error) {
      const statusCode = getApiStatusCode(error);

      if (statusCode !== undefined && CONSTANTS.FATAL_API_STATUS_CODES.indexOf(statusCode) !== -1) {
        this.abortInit(statusCode);

        return;
      }

      Logger.error(error, `Pushwoosh: init step "${name}" failed`);
    }
  }

  /** Logged once per init and read by the integrator in the console, so it names the parameter to fix. */
  private abortInit(statusCode: number): void {
    this.isInitAborted = true;

    Logger.error(
      'Pushwoosh: initialization stopped. The Pushwoosh API rejected the application code '
      + `"${this.initParams.applicationCode}" (status_code: ${statusCode}). `
      + 'Check the applicationCode init param against the application in your Pushwoosh Control Panel.',
    );
  }

  private resolvePlatformType(): TPlatform {
    this.isLegacySafari = this.detectLegacySafari();

    // The legacy path is always 10; Safari off it is a web push device like Chrome, as the sender routes 10 to APNs.
    const isUnified = !this.isLegacySafari && (this.initParams.unifiedPlatform || this.platformChecker.isSafari);

    return isUnified ? UNIFIED_PLATFORM : this.platformChecker.getPlatformType();
  }

  // A live legacy subscription keeps its APNs path; a new Safari subscriber takes the service
  // worker only when the app has its own VAPID key, unless unifiedPlatform forces it.
  private detectLegacySafari(): boolean {
    if (!this.platformChecker.isSafari) {
      return false;
    }

    // Safari before 16 has no Web Push API, so the legacy path is the only one.
    if (!this.platformChecker.isAvailableServiceWorker) {
      return true;
    }

    const { safariWebsitePushID, unifiedPlatform } = this.initParams ?? {};

    if (hasLegacySafariSubscription(getGlobal(), safariWebsitePushID)) {
      return true;
    }

    return !unifiedPlatform && !this.isWebVapidConfigured;
  }

  private async ensureHwid(reinit: boolean = false): Promise<void> {
    const storedHwid = await this.readHwid();

    if (storedHwid && !reinit) {
      return;
    }

    const hwid = this.initParams.applicationCode + '_' + v4();

    try {
      await this.data.setHwid(hwid);

      // A store that takes the write but gives nothing back would leave every
      // request without an hwid, and init must survive that to reach 'ready'.
      if (await this.data.getHwid() !== hwid) {
        Logger.info(CONSTANTS.HWID_UNAVAILABLE_MESSAGE);
      }
    } catch (error) {
      Logger.info(error, CONSTANTS.HWID_UNAVAILABLE_MESSAGE);
    }
  }

  private async readHwid(): Promise<string> {
    try {
      return await this.data.getHwid();
    } catch {
      return '';
    }
  }

  /** `user_id` is the documented placeholder for "no userId", so it identifies nobody. */
  private getInitUserId(): string | undefined {
    const { userId } = this.initParams || {};

    return userId && userId !== 'user_id' ? userId : undefined;
  }

  private async isUserIdChanged(): Promise<boolean> {
    const { userId } = this.initParams;
    const storedUserId = await this.data.getUserId();
    const userIdWasChanged = await this.data.getStatusUserIdWasChanged();

    return !!userId && userId !== 'user_id' && userId !== storedUserId && !userIdWasChanged;
  }

  /**
   * Default process during PW initialization.
   * Init API. Subscription to notifications.
   * Emit delayed events.
   */
  private async defaultProcess(): Promise<void> {
    const driver = this.requireDriver();
    const permission = driver.getPermission();

    if (permission === 'granted') {
      await this.data.setLastPermissionStatus(permission);
    }

    const isCommunicationDisabled = await this.data.getStatusCommunicationDisabled();
    const isDropAllData = await this.data.getStatusDropAllData();
    const isNeedResubscribe = await driver.checkIsNeedResubscribe();

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

    // just unregistered above: checkDevice can still see the token while the server applies it
    const isRegister = isNeedResubscribe ? false : await this.api.checkDeviceSubscribeForPushNotifications(false);

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

    this.reportPushPermissionChangeInBackground();
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
  private async open(isForce?: boolean): Promise<void> {
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

  /**
   * The visitor's push permission as reported in the `Push Permission Status` tag. A campaign condition reads
   * not_determined as DEFAULT, granted_explicit as GRANTED, denied as DENIED and unsupported as UNSUPPORTED.
   */
  public getPushPermissionStatus(): TPushPermissionStatus {
    if (this.driver) {
      return mapPushPermission(this.driver.getPermission());
    }

    // applicationOpen of init runs before the driver exists, so mirror its choice.
    return readPushPermissionStatus(getGlobal(), this.isLegacySafari ? this.initParams?.safariWebsitePushID : undefined);
  }

  // The source getPushPermissionStatus() maps, not PermissionStatus.state, which says 'prompt' for 'default'.
  // Legacy Safari's permission() throws outside its push package.
  private readPermission(): NotificationPermission | undefined {
    try {
      if (this.driver) {
        return this.driver.getPermission();
      }

      const global = getGlobal();

      return 'Notification' in global ? global.Notification.permission : undefined;
    } catch {
      return undefined;
    }
  }

  // Chrome reports a dialog answer twice, by the change event and by subscribe(); the site hears it once.
  private announcePermissionChange(permission: NotificationPermission): void {
    if (permission === this.knownPermission) {
      return;
    }

    this.knownPermission = permission;
    this.eventBus.dispatchEvent('change-permission', { permission });
  }

  // registerDevice, not applicationOpen: the server counts every applicationOpen as an app open.
  // A revoke drops a live subscription and a grant restores one, as the next init would.
  private async reportPushPermissionChange(): Promise<void> {
    // the dialog's change event fires before the subscription starts its own registerDevice
    const isSubscriptionStuck = this.subscriptionInFlight !== null && !await this.waitForPermissionWork(this.subscriptionInFlight);
    if (this.isCommunicationDisabled || !this.driver || this.api.isPushPermissionStatusReported()) {
      return;
    }

    const permission = this.driver.getPermission();
    const isSubscribed = await this.api.checkDeviceSubscribeForPushNotifications();
    let isTokenDead = false;
    if (permission === CONSTANTS.PERMISSION_GRANTED) {
      if (!isSubscribed && !isSubscriptionStuck && !this.isPushDisabled && !await this.data.getStatusManualUnsubscribed()) {
        this.subscribe(false).catch((error) => Logger.error(error, 'Pushwoosh: re-subscribe after a permission grant failed'));
        if (this.subscriptionInFlight) {
          await this.waitForPermissionWork(this.subscriptionInFlight);
        }
      }
    } else if (isSubscribed) {
      const drop = this.dropRevokedSubscription(permission)
        .catch((error) => Logger.error(error, 'Pushwoosh: unsubscribe after a permission revoke failed'));
      // the revoked token is dead, so a tokenless report may clear it
      isTokenDead = !await this.waitForPermissionWork(drop);
    }

    await this.api.reportPushPermissionStatus(isTokenDead);
  }

  private async dropRevokedSubscription(permission: NotificationPermission): Promise<void> {
    await this.data.setLastPermissionStatus(permission);
    await this.unsubscribe();
    await this.data.setStatusManualUnsubscribed(false);
  }

  private reportPushPermissionChangeInBackground(): void {
    this.reportPushPermissionChange()
      .catch((error) => Logger.error(error, 'Pushwoosh: registerDevice after a permission change failed'));
  }

  // Catches a change made in the site settings while the page is open. Safari and
  // older browsers lack the query or the change event: they report on the next init.
  private async watchPushPermission(): Promise<void> {
    if (this.isPushPermissionWatched || typeof navigator.permissions?.query !== 'function') {
      return;
    }

    try {
      const status = await navigator.permissions.query({ name: 'notifications' });

      status.addEventListener('change', () => {
        // Before the report's own checks: the site hears the change even when nothing goes to the server.
        const permission = this.readPermission();
        if (permission) {
          this.announcePermissionChange(permission);
        }

        this.reportPushPermissionChangeInBackground();
      });
      this.isPushPermissionWatched = true;
    } catch (error) {
      Logger.info(error, 'Pushwoosh: notifications permission can not be watched');
    }
  }

  private async sendData() {
    const params = this.initParams;

    // check user id
    const storedUserId = await this.data.getUserId();

    if (params.userId && params.userId !== 'user_id' && params.userId !== storedUserId) {
      // Registering the user needs the device; email, SMS, WhatsApp and tags
      // below do not, so they must not lose their turn when it fails.
      try {
        await this.api.registerUser(params.userId, false);
      } catch (error) {
        Logger.error(error, 'Pushwoosh: registerUser failed');
      }
    }

    const tasks: { test: () => Promise<boolean>; task: () => Promise<void> }[] = [
      {
        test: async () => {
          if (await this.data.getStatusEmailWasChanged()) {
            return false;
          }
          const storedEmail = await this.data.getEmail();
          return !!params.email && params.email !== storedEmail;
        },
        task: async () => {
          await this.api.registerEmail(params.email!, false);
        },
      },
      {
        test: async () => {
          if (await this.data.getStatusSmsNumberWasChanged()) {
            return false;
          }
          const storedSmsNumber = await this.data.getSmsNumber();
          return !!params.smsNumber && params.smsNumber !== storedSmsNumber;
        },
        task: async () => {
          await this.api.registerSmsNumber(params.smsNumber!, false);
        },
      },
      {
        test: async () => {
          if (await this.data.getStatusWhatsAppNumberWasChanged()) {
            return false;
          }
          const storedWhatsAppNumber = await this.data.getWhatsAppNumber();
          return !!params.whatsAppNumber && params.whatsAppNumber !== storedWhatsAppNumber;
        },
        task: async () => {
          await this.api.registerWhatsappNumber(params.whatsAppNumber!, false);
        },
      },
      {
        test: async () => {
          // Skip the round-trip when there's nothing user-specific to send.
          // getRequestParams() already carries `language` on every API call, so
          // we only need a setTags call when the user provided init tags or
          // explicitly set the language via api.setLanguage.
          return !!params.tags || await this.data.getStatusLanguageWasChanged();
        },
        task: async () => {
          // Resolved language already respects priority (manual > initParams > navigator).
          const language = await this.data.getLanguage();
          const tagsToSend: { [key: string]: any } = {
            ...(params.tags || {}),
            Language: language,
          };

          await this.api.setTags(tagsToSend);
        },
      },
    ];
    await Promise.all(tasks.map(async (worker) => {
      try {
        if (await worker.test()) {
          await worker.task();
        }
      } catch (err) {
        console.error('Pushwoosh: Error during data registration', err);
      }
    }));
  }

  private async loadConfig() {
    this.isWebVapidConfigured = await this.data.getWebVapidConfigured();

    const config = await this.api.getConfig([
      'vapid_key',
      'web_vapid_configured',
      'events',
      'subscription_prompt',
      'popup_forms',
      'web_sdk',
      'web_sdk_modules',
    ]);
    const features = config && config.features;
    await this.data.setFeatures(features);

    if (features) {
      await this.applyServerInitParams(serverInitParams(features));

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

        // A first visit has no previous key, so there is no subscription the
        // new one could have invalidated.
        if (previousServerKey !== undefined && previousServerKey !== features.vapid_key) {
          await this.data.setIsVapidChanged(true);
        }
      }

      // An older device-api doesn't answer this one; the stored value then stands.
      const webVapidConfigured = features.web_vapid_configured ?? this.isWebVapidConfigured;

      if (webVapidConfigured !== this.isWebVapidConfigured) {
        this.isWebVapidConfigured = webVapidConfigured;
        await this.data.setWebVapidConfigured(webVapidConfigured);
      }
    }
  }

  // Runs before the push part and before any widget, so every later reader — including the
  // Safari driver, which takes the id from the store — sees the resolved values.
  private async applyServerInitParams(serverParams?: IServerInitParams): Promise<void> {
    const resolved = resolveInitParams(this.rawInitParams, serverParams);

    if (Object.keys(resolved).length === 0) {
      return;
    }

    this.initParams = { ...this.initParams, ...resolved };
    await this.data.setInitParams(this.initParams);
  }

  private async initPushNotifications(params: IInitParams): Promise<void> {
    await this.data.setDefaultNotificationImage(params.defaultNotificationImage);
    await this.data.setDefaultNotificationTitle(params.defaultNotificationTitle);
    await this.data.setServiceWorkerUrl(params.serviceWorkerUrl);
    await this.data.setServiceWorkerScope(params.scope);

    await this.initDriver();

    // initDriver leaves the driver unset when push can't be configured
    // (Safari without safariWebsitePushID, no service worker support)
    if (!this.driver) {
      Logger.info('Pushwoosh: push service driver was not created, skipping push initialization');

      return;
    }

    // Switched off in init params: no service worker registration, no prompt,
    // no (re)subscription — but the driver stays for an explicit unsubscribe().
    if (this.isPushDisabled) {
      Logger.info('Pushwoosh: push notifications are disabled by the "pushNotifications" init param');

      await this.warnAboutKeptSubscription();

      return;
    }

    // Default actions on init
    try {
      await this.defaultProcess();
    } catch (error) {
      Logger.error(error, 'Internal error: defaultProcess fail');
    }
  }

  /** Disabling push does not unregister devices, so an already subscribed one must be visible in the log. */
  private async warnAboutKeptSubscription(): Promise<void> {
    const { pushToken } = await this.data.getTokens();

    if (!pushToken) {
      return;
    }

    Logger.error(
      'Pushwoosh: push notifications are disabled by the "pushNotifications" init param, '
      + 'but this device is still subscribed and will keep receiving notifications. '
      + 'Call Pushwoosh.unsubscribe() to unsubscribe it.',
    );
  }

  private async initDriver(): Promise<void> {
    if (this.isLegacySafari) {
      const { safariWebsitePushID: webSitePushId } = await this.data.getInitParams();

      if (!webSitePushId) {
        Logger.info('Safari push needs safariWebsitePushID in initParams; Safari 16+ can use web VAPID keys of the application instead.');
        return;
      }

      this.driver = new PushServiceSafari(this.api, this.data, { webSitePushId });

      return;
    }

    Logger.info({
      isAvailableServiceWorker: this.platformChecker.isAvailableServiceWorker,
    });

    if (this.platformChecker.isAvailableServiceWorker) {
      this.driver = new PushServiceDefault(this.api, this.data, {});
    }
  }

  public async sendPostEventVisitedPage() {
    const {
      document: { title },
      location: { href },
    } = window;
    const path = getPagePath();

    const deviceType = await this.data.getDeviceType();

    this.api.postEvent(CONSTANTS.EVENT_PW_SITE_OPENED, {
      url: href,
      path,
      title: title,
      device_type: deviceType,
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

    if (isHandled) {
      this.sdkUsage.recordLegacyEvent(type);
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
