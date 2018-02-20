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
  keyDeviceRegistrationStatus,
  keySafariPreviousPermission,
  manualSetLoggerLevel,
  PERMISSION_DENIED,
  PERMISSION_GRANTED,
  PERMISSION_PROMPT,
  KEY_DELAYED_EVENT
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
    this.onLoadManifest = this.onLoadManifest.bind(this);
    this.onServiceWorkerMessage = this.onServiceWorkerMessage.bind(this);
  }

  onReadyHandler(cmd: any) {
    if (this.ready) {
      cmd(this.api);
    }
    else {
      this._ee.on(eventOnReady, (params) => cmd(this.api, params));
    }
  }

  push(cmd: any) {
    if (typeof cmd === 'function') {
      this.onReadyHandler(cmd);
    }
    else if (Array.isArray(cmd)) {
      const [cmdName, cmdFunc] = cmd;
      switch (cmdName) {
        case 'init':
          if (this.shouldInit()) {
            this.init(cmdFunc)
                .catch(e => Logger.info('Pushwoosh init failed', e));
          }
          break;
        case eventOnReady:
          this.onReadyHandler(cmdFunc);
          break;
        case eventOnRegister:
        case eventOnSubscribe:
        case eventOnUnsubscribe:
        case eventOnSWInitError:
        case eventOnPushDelivery:
        case eventOnNotificationClick:
        case eventOnNotificationClose:
          this._ee.on(cmdName, (params) => cmdFunc(this.api, params));
          break;
        case eventOnPermissionDenied:
        case eventOnPermissionPrompt:
        case eventOnPermissionGranted:
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

  shouldInit() {
    if (!((this.isSafari && getDeviceName() === 'PC') || canUseServiceWorkers())) {
      Logger.info('This browser does not support pushes');
      return false;
    }

    return true;
  }

  async init(initParams: IInitParams) {
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

    const manualDebug = localStorage.getItem(manualSetLoggerLevel);
    Logger.setLevel(manualDebug || logLevel);

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

    try {
      await this.defaultProcess();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.onmessage = this.onServiceWorkerMessage;
      }
    }
    catch (err) {
      Logger.write('error', err, 'defaultProcess fail');
    }

    const event = new CustomEvent('pushwoosh.initialized', {detail: {pw: this}});
    document.dispatchEvent(event);
  }

  /**
   * Check sender id in manifest
   * @returns {Promise<void>}
   */
  async checkSenderId() {
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest === null) {
      throw new Error('Link to manifest can not find');
    }
    const manifestUrl = manifest.getAttribute('href') || '';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', manifestUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.onload = this.onLoadManifest;
    xhr.send();
  }

  /**
   * On load manifest callback
   * @param {MessageEvent} ev
   * @returns {Promise<void>}
   */
  async onLoadManifest(ev: MessageEvent) {
    const xhr = ev.target as XMLHttpRequest;
    if (xhr.status == 200) {
      try {
        const response = JSON.parse(xhr.responseText);
        const senderId = await keyValue.get('gcm_sender_id');
        if (senderId !== response['gcm_sender_id']) {
          keyValue.set('gcm_sender_id', response['gcm_sender_id']);
          await this.unsubscribe();
          this.subscribe();
        }
      }
      catch (e) {
        Logger.info('Manifest not parsed', e)
      }
    }
    else {
      throw new Error('Manifest not loaded')
    }
  }

  onServiceWorkerMessage(event: MessageEvent) {
    const {data = {}} = event || {};
    const {type = '', payload = {}} = data || {};
    this._ee.emit(type, payload);
  }

  async initApi() {
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

  async subscribe(params?: {registerLess?: boolean}) {
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

  async registerDuringSubscribe() {
    const subscribed = await this.driver.isSubscribed();
    await this.initApi();
    if (this.isSafari) {
      await this.open();
    }
    await this.register(subscribed);
  }

  async onSubscribeEmitter() {
    const subscribed = await this.driver.isSubscribed();
    if (subscribed) {
      this._ee.emit(eventOnSubscribe);
    }
  }

  async unsubscribe(notify: boolean = true) {
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

  isDeviceRegistered() {
    return localStorage.getItem(keyDeviceRegistrationStatus) === 'registered';
  }

  isSubscribed() {
    const deviceRegistration = this.isSafari || this.isDeviceRegistered();
    return deviceRegistration && this.driver.isSubscribed() || Promise.resolve(false);
  }

  async register(forceRequests?: boolean) {
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

  async open() {
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

  async needForcedOpen() {
    if (!this.isSafari) {
      return Promise.resolve(false);
    }
    const previousPermission = await keyValue.get(keySafariPreviousPermission);
    const currentPermission = await this.driver.getPermission();
    const compare = (prev:any, curr:any) => prev !== PERMISSION_GRANTED && curr === PERMISSION_GRANTED;
    await keyValue.set(keySafariPreviousPermission, currentPermission);
    const result = compare(this.permissionOnInit, currentPermission) || compare(previousPermission, currentPermission);
    return Promise.resolve(result);
  }

  async defaultProcess() {
    const {autoSubscribe = true} = this.params || {};
    this.permissionOnInit = await this.driver.getPermission();
    await this.initApi();
    if (this.driver.isNeedUnsubscribe) {
      await this.driver.isNeedUnsubscribe() && this.isDeviceRegistered() && await this.unsubscribe(false);
    }
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
        if (!this.isSafari && !this.isDeviceRegistered()) {
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

  async getHWID() {
    const {hwid} = await this.driver.getAPIParams();
    return Promise.resolve(hwid);
  }

  async getPushToken() {
    const {pushToken} = await this.driver.getAPIParams();
    return Promise.resolve(pushToken);
  }

  async getUserId() {
    const initParams = await keyValue.get(keyInitParams);
    return initParams.userId || this.params.userId || null;
  }

  async getParams() {
    const {params = {}} = this.api || {};
    return Promise.resolve(params);
  }
}

export default Pushwoosh;
