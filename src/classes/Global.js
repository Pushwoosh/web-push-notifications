import {keyValue} from '../utils/storage';
import {isSafariBrowser, canUseServiceWorkers, getDeviceName} from '../utils/functions';

import Logger from './Logger';
import PushwooshSafari from './SafariInit';
import PushwooshWorker from './WorkerInit';
import {createErrorAPI} from './API';

import {defaultPushwooshUrl, defaultWorkerUrl, defaultWorkerSecondUrl} from '../constants';

const isSafari = isSafariBrowser();
const canUseSW = canUseServiceWorkers();

export default class PushwooshGlobal {
  constructor() {
    this._commands = [];
    this._keyValue = keyValue;
  }

  _init() {
    const initPromise = this._auto
      ? this._initer.initSubscribe()
      : this._initer.initApi();
    this._initPromise = initPromise
      .catch(err => {
        this._logger.debug('Error was caught in browser init', err);
        return createErrorAPI(err);
      })
      .then(api => this.api = api) // eslint-disable-line no-return-assign
      .then(() => this._commands.forEach(cmd => this._runCmd(cmd)));
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
      defaultNotificationUrl,
      autoSubscribe = true
    } = params;
    this._initParams = params;
    this._auto = autoSubscribe;
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
      }
    }
    if (this._initer) {
      this._init();
    }
    else {
      this._logger.info('Browser has not been configured');
    }
  }

  _runCmd(func) {
    return this._initPromise.then(func);
  }

  _cmdInit(params) {
    if (document.readyState === 'complete') {
      this.init(params);
    }
    else {
      window.addEventListener('load', () => this.init(params));
    }
  }

  _runOrPush(clb) {
    if (this._initPromise) {
      this._runCmd(clb);
    }
    else {
      this._commands.push(clb);
    }
  }

  push(cmd) {
    if (typeof cmd === 'function') {
      this._runOrPush(() => cmd(this.api));
    }
    else if (Array.isArray(cmd)) {
      switch (cmd[0]) {
        case 'init':
          this._cmdInit(cmd[1]);
          break;
        case 'subscribe':
          this._runOrPush(() => {
            cmd[1](this._initer.initSubscribe());
          });
          break;
        case 'unsubscribe':
          this._runOrPush(() => {
            cmd[1](this._initer.unsubscribe());
          });
          break;
        default:
          throw new Error('unknown command');
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
