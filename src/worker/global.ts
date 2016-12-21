import {keyValue} from '../storage';
import {
  keyApiParams,
  keyInitParams
} from '../constants';
import API from '../API';
import createDoApiFetch from '../createDoApiFetch';

export default class WorkerPushwooshGlobal {
  _listeners: {[key: string]: TPWCanWaitCallback[]} = {};
  push(f: ['onPush', TPWCanWaitCallback]) {
    console.log('fff', f);
    if (Array.isArray(f) && f[0] === 'onPush' && typeof f[1] === 'function') {
      if (!this._listeners[f[0]]) {
        this._listeners[f[0]] = []
      }
      this._listeners[f[0]].push(f[1]);
    }
  }
  getListeners(eventName: string) {
    console.log('eeeee', eventName);
    return this._listeners[eventName] || [];
  }

  api: API;
  async initApi() {
    const values = await keyValue.getAll();
    const initParams: IInitParamsWithDefaults = values[keyInitParams];
    const driverApiParams: TPWAPIParams = values[keyApiParams];
    let apiParams: TPWAPIParams = {
      ...driverApiParams,
      deviceType: initParams.deviceType,
      deviceModel: initParams.tags['Device Model'],
      applicationCode: initParams.applicationCode,
      language: initParams.tags.Language,
    };
    if (initParams.userId) {
      apiParams.userId = initParams.userId
    }
    const func = createDoApiFetch(initParams.pushwooshUrl);
    this.api = new API(func, apiParams);
  }
}
