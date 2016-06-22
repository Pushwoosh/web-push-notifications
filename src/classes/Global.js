import {keyValue} from '../utils/storage';
import {isSafariBrowser, canUseServiceWorkers, getDeviceName} from '../utils/functions';

import Logger from './Logger';
import PushwooshSafari from './SafariInit';
import PushwooshWorker from './WorkerInit';
import {ctrateErrorAPI} from './API';

import {defaultPushwooshUrl, defaultWorkerUrl, defaultWorkerSecondUrl} from '../constants';

const isSafari = isSafariBrowser();
const canUseSW = canUseServiceWorkers();

export default class PushwooshGlobal {
  constructor() {
    this._commands = [];
    this._keyValue = keyValue;
  }

  _init(initPromise) {
    this._initPromise = initPromise
      .catch(err => {
        this._logger.debug('Error was caught in browser init', err);
        return ctrateErrorAPI(err);
      })
      .then(api => this.api = api) // eslint-disable-line no-return-assign
      .then(() => this._commands.forEach(cmd => this._runFn(cmd)));
  }

  init(params) {
    const {
      applicationCode,
      safariWebsitePushID,
      serviceWorkerUrl = defaultWorkerUrl,
      serviceWorkerSecondUrl = defaultWorkerSecondUrl,
      logLevel,
      pushwooshUrl = defaultPushwooshUrl,
      defaultNotificationTitle,
      defaultNotificationImage,
      defaultNotificationUrl
    } = params;
    this._initParams = params;
    this._logger = new Logger(logLevel);
    if (!((isSafari && getDeviceName() === 'PC') || canUseSW)) {
      this._logger.info('This browser does not support pushes');
      return;
    }
    if (!applicationCode) {
      throw new Error('no application code');
    }

    if (isSafari) {
      if (safariWebsitePushID) {
        this._initer = new PushwooshSafari({
          webSitePushID: safariWebsitePushID,
          pushwooshUrl: pushwooshUrl,
          applicationCode: applicationCode,
          logger: this._logger
        });
        this._init(this._initer.init());
      }
    }
    else if (canUseSW) {
      if (serviceWorkerUrl) {
        this._initer = new PushwooshWorker({
          workerUrl: serviceWorkerUrl,
          workerSecondUrl: serviceWorkerSecondUrl,
          pushwooshUrl,
          applicationCode,
          defaultNotificationTitle,
          defaultNotificationImage,
          defaultNotificationUrl,
          logger: this._logger
        });
        this._init(this._initer.init());
      }
    }
    if (!this._initPromise) {
      this._logger.info('Browser has not been configured');
    }
  }

  _runFn(func) {
    return this._initPromise.then(() => func(this.api));
  }

  push(func) {
    if (typeof func === 'function') {
      if (this._initPromise) {
        this._runFn(func);
      }
      else {
        this._commands.push(func);
      }
    }
    else if (Array.isArray(func) && func[0] === 'init') {
      if (document.readyState === 'complete') {
        this.init(func[1]);
      }
      else {
        window.addEventListener('load', () => this.init(func[1]));
      }
    }
    else {
      throw new Error('invalid command');
    }
  }

  _debug() {
    const debugFn = console.info.bind(console); // eslint-disable-line
    const initerParams = this._initer._params; // eslint-disable-line
    debugFn('initer params', initerParams);
    debugFn(`workerUrl: ${location.origin}${initerParams.workerUrl}`);
    debugFn(`workerSecondUrl: ${location.origin}${initerParams.workerSecondUrl}`);
    this._keyValue.getAll().then(res => debugFn('keyValues', res));
  }
}
