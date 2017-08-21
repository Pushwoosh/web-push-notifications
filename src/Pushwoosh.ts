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
  clearLocationHash
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
  keySafariPreviousPermission
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
      }
    };

    Logger.setLevel(logLevel);

    if (canUseServiceWorkers()) {
      const {worker} = params.driversSettings;
      this.driver = new WorkerDriver({
        eventEmitter: this._ee,
        scope,
        applicationCode,
        serviceWorkerUrl: worker.serviceWorkerUrl,
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
        navigator.serviceWorker.onmessage = this.onServiceWorkerMessage.bind(this);
      }
    }
    catch (err) {
      Logger.write('error', err, 'defaultProcess fail');
    }
  }

  onServiceWorkerMessage(e: MessageEvent) {
    const {data = {}} = e || {};
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
      if (!subscribed) {
        await this.driver.askSubscribe();
      }
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

  async unsubscribe() {
    try {
      await this.driver.unsubscribe();
      await this.api.unregisterDevice();
      this._ee.emit(eventOnUnsubscribe);
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
        keyValue.set(keyInitParams, params),
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
    const compare = (prev:any, curr:any) => prev !== 'granted' && curr === 'granted';
    await keyValue.set(keySafariPreviousPermission, currentPermission);
    const result = compare(this.permissionOnInit, currentPermission) || compare(previousPermission, currentPermission);
    return Promise.resolve(result);
  }

  async defaultProcess() {
    const {autoSubscribe = true} = this.params || {};
    this.permissionOnInit = await this.driver.getPermission();
    await this.initApi();
    switch (this.permissionOnInit) {
      case 'denied':
        this._ee.emit(eventOnPermissionDenied);
        // if permission === 'denied' and device is registered do unsubscribe (unregister device)
        if (!this.isSafari && this.isDeviceRegistered()) {
          await this.unsubscribe();
        }
        break;
      case 'prompt':
        // if permission === 'prompt' and device is registered do unsubscribe (unregister device)
        if (!this.isSafari && this.isDeviceRegistered()) {
          await this.unsubscribe();
        }
        if (autoSubscribe) {
          await this.subscribe({registerLess: true});
        } else {
          this._ee.emit(eventOnPermissionPrompt);
        }
        break;
      case 'granted':
        this._ee.emit(eventOnPermissionGranted);
        // if permission === 'granted' and device is not registered do subscribe
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
    const params: IInitParams = this.params || {};
    return Promise.resolve(params.userId);
  }

  async getParams() {
    const {params = {}} = this.api || {};
    return Promise.resolve(params);
  }
}

export default Pushwoosh;
