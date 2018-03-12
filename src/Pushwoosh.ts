import EventEmitter from './EventEmitter';
import API from './API';
import {
  isSafariBrowser,
  getDeviceName,
  getBrowserVersion,
  getBrowserType,
  canUseServiceWorkers,
  getPushwooshUrl,
  getVersion,
  patchPromise,
  clearLocationHash,
  validateParams
} from './functions';
import {
  defaultServiceWorkerUrl,
  keyApiParams,
  keyInitParams,
  keySDKVersion,
  keyLastOpenMessage,
  keyLastSentAppOpen,
  periodSendAppOpen,
  KEY_DEVICE_REGISTRATION_STATUS,
  keySafariPreviousPermission,
  manualSetLoggerLevel,

  PERMISSION_DENIED,
  PERMISSION_GRANTED,
  PERMISSION_PROMPT,

  KEY_DELAYED_EVENT,

  DEVICE_REGISTRATION_STATUS_REGISTERED,
  DEVICE_REGISTRATION_STATUS_UNREGISTERED
} from './constants';
import Logger from './logger'
import WorkerDriver from './drivers/worker';
import SafariDriver from './drivers/safari';
import createDoApiXHR from './createDoApiXHR';
import {keyValue, log as logStorage, message as messageStorage} from './storage';


export const eventOnReady = 'onReady';
export const eventOnSubscribe = 'onSubscribe';
export const eventOnUnsubscribe = 'onUnsubscribe';
export const eventOnRegister = 'onRegister';
export const eventOnPermissionPrompt = 'onPermissionPrompt';
export const eventOnPermissionDenied = 'onPermissionDenied';
export const eventOnPermissionGranted = 'onPermissionGranted';
export const eventOnSWInitError = 'onSWInitError';
export const eventOnPushDelivery = 'onPushDelivery';
export const eventOnNotificationClick = 'onNotificationClick';
export const eventOnNotificationClose = 'onNotificationClose';

type ChainFunction = (param: any) => Promise<any> | any;

patchPromise();

class Pushwoosh {
  private params: IInitParamsWithDefaults;
  private _initParams: IInitParams;
  private _ee: EventEmitter = new EventEmitter();
  private _onPromises: {[key: string]: Promise<ChainFunction>};

  public api: API;
  public driver: IPWDriver;
  public isSafari: boolean = isSafariBrowser();
  public permissionOnInit: string;
  public ready: boolean = false;
  public subscribeWidgetConfig: ISubscribeWidget;

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

  constructor() {
    this._onPromises = {
      [eventOnPermissionDenied]: new Promise(resolve => this._ee.once(eventOnPermissionDenied, resolve)),
      [eventOnPermissionPrompt]: new Promise(resolve => this._ee.once(eventOnPermissionPrompt, resolve)),
      [eventOnPermissionGranted]: new Promise(resolve => this._ee.once(eventOnPermissionGranted, resolve)),
    };

    // Bindings
    this.onServiceWorkerMessage = this.onServiceWorkerMessage.bind(this);
  }

  /**
   * Method invoking the transmitted callback when the API is ready
   * @param cmd
   */
  onReadyHandler(cmd: HandlerFn) {
    if (this.ready) {
      cmd(this.api);
    }
    else {
      this._ee.on(eventOnReady, (params) => cmd(this.api, params));
    }
  }

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
   * @param cmd
   */
  public push(cmd: PWInput) {
    if (typeof cmd === 'function') {
      this.onReadyHandler(cmd);
    }
    else if (Array.isArray(cmd)) {
      const [cmdName, cmdFunc] = cmd;
      switch (cmdName) {
        case 'init':
          if (this.shouldInit()) {
            if (typeof cmdFunc !== 'object') {
              break;
            }
            this.init(cmdFunc)
                .catch(e => Logger.info('Pushwoosh init failed', e));
          }
          break;
        case eventOnReady:
          if (typeof cmdFunc !== 'function') {
            break;
          }
          this.onReadyHandler(cmdFunc);
          break;
        case eventOnRegister:
        case eventOnSubscribe:
        case eventOnUnsubscribe:
        case eventOnSWInitError:
        case eventOnPushDelivery:
        case eventOnNotificationClick:
        case eventOnNotificationClose:
          if (typeof cmdFunc !== 'function') {
            break;
          }
          this._ee.on(cmdName, (params: any) => cmdFunc(this.api, params));
          break;
        case eventOnPermissionDenied:
        case eventOnPermissionPrompt:
        case eventOnPermissionGranted:
          if (typeof cmdFunc !== 'function') {
            break;
          }
          this._onPromises[cmdName].then(() => cmdFunc(this.api));
          break;
        default:
          throw new Error('unknown command');
      }
    }
    else {
      throw new Error('invalid command');
    }
  }

  /**
   * Method returns false if device does not support pushes.
   * @returns {boolean}
   */
  public shouldInit() {
    if (!((this.isSafari && getDeviceName() === 'PC') || canUseServiceWorkers())) {
      Logger.info('This browser does not support pushes');
      return false;
    }

    return true;
  }

  /**
   * Method initiates PW services.
   * @param {IInitParams} initParams
   * @returns {Promise<void>}
   */
  private async init(initParams: IInitParams) {
    this._initParams = initParams;
    const {
      scope,
      applicationCode,
      logLevel = 'error',
      pushwooshApiUrl
    } = initParams;

    if (!applicationCode) {
      throw new Error('no application code');
    }

    // Build initial params
    const pushwooshUrl = await getPushwooshUrl(applicationCode, false, pushwooshApiUrl);
    const params = this.params = {
      autoSubscribe: true,
      serviceWorkerUrl: null,
      pushwooshUrl,
      ...initParams,
      deviceType: getBrowserType(),
      tags: {
        Language: navigator.language || 'en',
        ...initParams.tags,
        'Device Model': getBrowserVersion(),
      },
      driversSettings: {
        worker: {
          serviceWorkerUrl: defaultServiceWorkerUrl,
          ...(initParams.driversSettings && initParams.driversSettings.worker),
        }
      },
      subscribeWidget: {
        enable: false,
        ...initParams.subscribeWidget,
      }
    };
    this.subscribeWidgetConfig = this.params.subscribeWidget;

    // Set log level
    const manualDebug = localStorage.getItem(manualSetLoggerLevel);
    Logger.setLevel(manualDebug || logLevel);

    // Init worker driver
    if (canUseServiceWorkers()) {
      const {worker} = params.driversSettings;
      this.driver = new WorkerDriver({
        eventEmitter: this._ee,
        scope,
        applicationCode,
        serviceWorkerUrlDeprecated: worker.serviceWorkerUrl,
        serviceWorkerUrl: params.serviceWorkerUrl,
        applicationServerPublicKey: worker.applicationServerPublicKey,
      });
      try {
        if (this.driver && this.driver.initWorker) {
          await this.driver.initWorker();
        }
      }
      catch (error) {
        Logger.write('error', error, 'driver initialization failed');
      }
    }

    // Init safari driver
    else if (this.isSafari && params.safariWebsitePushID) {
      this.driver = new SafariDriver({
        eventEmitter: this._ee,
        applicationCode,
        pushwooshUrl: params.pushwooshUrl,
        pushwooshApiUrl: params.pushwooshApiUrl,
        webSitePushID: params.safariWebsitePushID,
      });
      this._ee.on(eventOnReady, () => {
        const hashReg: any = /#P(.*)/;
        const hash = decodeURIComponent(document.location.hash);

        if (hashReg.test(hash)) {
          this.api
            .pushStat(hashReg.exec(hash)[1])
            .then(clearLocationHash);
        }
      });
    }
    else {
      throw new Error('can\'t initialize safari')
    }

    // Default actioons on init
    try {
      await this.defaultProcess();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.onmessage = this.onServiceWorkerMessage;
      }
    }
    catch (err) {
      Logger.write('error', err, 'defaultProcess fail');
    }

    // Dispatch "pushwoosh.initialized" event
    const event = new CustomEvent('pushwoosh.initialized', {detail: {pw: this}});
    document.dispatchEvent(event);
  }

  /**
   *
   * @param {MessageEvent} event
   */
  private onServiceWorkerMessage(event: MessageEvent) {
    const {data = {}} = event || {};
    const {type = '', payload = {}} = data || {};
    this._ee.emit(type, payload);
  }

  /**
   *
   * @returns {Promise<void>}
   */
  private async initApi() {
    const driverApiParams = await this.driver.getAPIParams();
    const lastOpenMessage = await keyValue.get(keyLastOpenMessage) || {};
    const {params} = this;
    const apiParams: TPWAPIParams = {
      ...driverApiParams,
      deviceType: params.deviceType,
      deviceModel: params.tags['Device Model'],
      applicationCode: params.applicationCode,
      language: params.tags.Language,
      pushwooshApiUrl: params.pushwooshApiUrl
    };
    if (params.userId) {
      apiParams.userId = params.userId
    }
    const func = createDoApiXHR(params.applicationCode, params.pushwooshApiUrl);
    this.api = new API(func, apiParams, lastOpenMessage);
  }

  /**
   * Method initializes the permission dialog on the device
   * and registers through the API in case the device hasn't been registered before.
   * @param {{registerLess?: boolean}} params
   * @returns {Promise<void>}
   */
  public async subscribe(params?: {registerLess?: boolean}) {
    const {registerLess = false} = params || {};
    try {
      const subscribed = await this.driver.isSubscribed();

      await this.driver.askSubscribe(registerLess);

      if (!registerLess) {
        await this.registerDuringSubscribe();
      }
      if (!subscribed) {
        await this.onSubscribeEmitter();
      }
    }
    catch (error) {
      Logger.write('error', error, 'subscribe fail');
    }
  }

  /**
   * Registers and initializes the API.
   * @returns {Promise<void>}
   */
  private async registerDuringSubscribe() {
    const subscribed = await this.driver.isSubscribed();
    await this.initApi();
    if (this.isSafari) {
      await this.open();
    }
    await this.register(subscribed);
  }

  /**
   * Emit events
   * @returns {Promise<void>}
   */
  private async onSubscribeEmitter() {
    const subscribed = await this.driver.isSubscribed();
    if (subscribed) {
      this._ee.emit(eventOnSubscribe);
    }
  }

  /**
   * Unsubscribe device.
   * @returns {Promise<void>}
   */
  public async unsubscribe(notify: boolean = true) {
    try {
      await this.driver.unsubscribe();
      await this.api.unregisterDevice();
      if (notify) {
        this._ee.emit(eventOnUnsubscribe);
      }
    }
    catch(e) {
      Logger.write('error', e, 'Error occurred during the unsubscribe');
    }
  }

  /**
   * Check device's registration status
   * @returns {boolean}
   */
  public isDeviceRegistered(): boolean {
    return localStorage.getItem(KEY_DEVICE_REGISTRATION_STATUS) === DEVICE_REGISTRATION_STATUS_REGISTERED;
  }

  public isDeviceUnregistered(): boolean {
    return localStorage.getItem(KEY_DEVICE_REGISTRATION_STATUS) === DEVICE_REGISTRATION_STATUS_UNREGISTERED;
  }

  /**
   * Check device's subscription status
   * @returns {boolean | Promise<boolean>}
   */
  public async isSubscribed(): Promise<boolean> {
    const deviceRegistration = this.isSafari || this.isDeviceRegistered();
    return deviceRegistration && this.driver.isSubscribed() || false;
  }

  /**
   * Registers the device and stores the information in the IndexedDB.
   * @param {boolean} forceRequests
   * @returns {Promise<void>}
   */
  private async register(forceRequests?: boolean) {
    if (!this.api) {
      throw new Error('API is not inited');
    }

    const {
      [keySDKVersion]: savedSDKVersion,
      [keyApiParams]: savedApiParams,
      [keyInitParams]: savedInitParams
    } = await keyValue.getAll();

    const apiParams = await this.driver.getAPIParams();
    const {params} = this;

    const shouldRegister = !(
      getVersion() === savedSDKVersion &&
      JSON.stringify(savedApiParams) === JSON.stringify(apiParams) &&
      JSON.stringify(savedInitParams) === JSON.stringify(params)
    );

    if (shouldRegister || forceRequests) {
      await Promise.all([
        keyValue.set(keyApiParams, apiParams),
        keyValue.extend(keyInitParams, validateParams(params)),
        keyValue.set(keySDKVersion, getVersion()),
        this.api.registerDevice(),
        this.api.setTags({...params.tags}),
        this.api.registerUser()
      ]);
      this._ee.emit(eventOnRegister);
    }
  }

  /**
   * Check device's session and call the appOpen method,
   * no more than once an hour
   * @returns {Promise<void>}
   */
  private async open() {
    const apiParams = await this.driver.getAPIParams();
    const curTime = Date.now();
    const val = await keyValue.get(keyLastSentAppOpen);
    const lastSentTime = isNaN(val) ? 0 : Number(val);
    const force = await this.needForcedOpen();
    if (this.isSafari && !apiParams.hwid) {
      return Promise.resolve();
    }
    if (force || (curTime - lastSentTime) > periodSendAppOpen) {
      await Promise.all([
        keyValue.set(keyLastSentAppOpen, curTime || Date.now()),
        this.api.applicationOpen()
      ]);
    }
  }

  /**
   * Check if device's permission status is changed and the appOpen method should be called
   * @returns {Promise<any>}
   */
  private async needForcedOpen() {
    if (!this.isSafari) {
      return Promise.resolve(false);
    }
    const previousPermission = await keyValue.get(keySafariPreviousPermission);
    const currentPermission = await this.driver.getPermission();
    const compare = (prev: string, curr: string) => prev !== PERMISSION_GRANTED && curr === PERMISSION_GRANTED;
    await keyValue.set(keySafariPreviousPermission, currentPermission);
    const result = compare(this.permissionOnInit, currentPermission) || compare(previousPermission, currentPermission);
    return Promise.resolve(result);
  }

  /**
   * Default process during PW initialization.
   * Init API. Subscription to notifications.
   * Emit delayed events.
   * @returns {Promise<void>}
   */
  private async defaultProcess() {
    const {autoSubscribe = true} = this.params || {};
    this.permissionOnInit = await this.driver.getPermission();
    await this.initApi();
    if (this.driver.isNeedUnsubscribe) {
      await this.driver.isNeedUnsubscribe() && this.isDeviceRegistered() && await this.unsubscribe(false);
    }

    // Actions depending of the permissions
    switch (this.permissionOnInit) {
      case PERMISSION_DENIED:
        this._ee.emit(eventOnPermissionDenied);
        // if permission === PERMISSION_DENIED and device is registered do unsubscribe (unregister device)
        if (!this.isSafari && this.isDeviceRegistered()) {
          await this.unsubscribe();
        }
        break;
      case PERMISSION_PROMPT:
        // if permission === PERMISSION_PROMPT and device is registered do unsubscribe (unregister device)
        if (!this.isSafari && this.isDeviceRegistered()) {
          await this.unsubscribe();
        }
        if (autoSubscribe) {
          await this.subscribe({registerLess: true});
        } else {
          this._ee.emit(eventOnPermissionPrompt);
        }
        break;
      case PERMISSION_GRANTED:
        this._ee.emit(eventOnPermissionGranted);
        // if permission === PERMISSION_GRANTED and device is not registered do subscribe
        if (!this.isSafari && !this.isDeviceRegistered() && !this.isDeviceUnregistered()) {
          await this.subscribe({registerLess: true});
        }
        break;
      default:
        Logger.write('error', this.permissionOnInit, 'unknown permission value');
    }
    await this.initApi();
    await this.open();
    await this.register();
    this._ee.emit(eventOnReady);
    this.ready = true;

    const delayedEvent = await keyValue.get(KEY_DELAYED_EVENT);
    if (delayedEvent) {
      const {type, payload} = delayedEvent;
      await this._ee.emit(type, payload);
      await keyValue.set(KEY_DELAYED_EVENT, null);
    }
  }

  /**
   * Method returns hardware id.
   * @returns {Promise<string>}
   */
  public async getHWID() {
    const {hwid} = await this.driver.getAPIParams();
    return Promise.resolve(hwid);
  }

  /**
   * Method returns push token.
   * @returns {Promise<string>}
   */
  async getPushToken() {
    const {pushToken} = await this.driver.getAPIParams();
    return Promise.resolve(pushToken);
  }

  /**
   * Method returns userId
   * @returns {Promise<string | null>}
   */
  async getUserId() {
    const initParams = await keyValue.get(keyInitParams);
    return initParams.userId || this.params.userId || null;
  }

  /**
   * Method returns an object with init params.
   * @returns {Promise<TPWAPIParams>}
   */
  async getParams() {
    const {params = {}} = this.api || {};
    return Promise.resolve(params);
  }
}

export default Pushwoosh;
