import {isSafariBrowser, canUseServiceWorkers, getDeviceName} from '../utils/functions';

import Logger from './Logger';
import PushwooshSafari from './SafariInit';
import PushwooshWorker from './WorkerInit';
import {ctrateErrorAPI} from './API';

import {defaultPushwooshUrl} from '../constants';

const isSafari = isSafariBrowser();
const canUseSW = canUseServiceWorkers();

export default class PushwooshGlobal {
  constructor() {
    this._commands = [];
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
      serviceWorkerUrl,
      logLevel,
      pushwooshUrl = defaultPushwooshUrl
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
        const safari = new PushwooshSafari({
          webSitePushID: safariWebsitePushID,
          pushwooshUrl: pushwooshUrl,
          applicationCode: applicationCode,
          logger: this._logger
        });
        this._init(safari.init());
      }
    }
    else if (canUseSW) {
      if (serviceWorkerUrl) {
        const worker = new PushwooshWorker({
          workerUrl: serviceWorkerUrl,
          pushwooshUrl: pushwooshUrl,
          applicationCode: applicationCode,
          logger: this._logger
        });
        this._init(worker.init());
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
      this.init(func[1]);
    }
    else {
      throw new Error('invalid command');
    }
  }

}
