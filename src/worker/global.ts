import { isFunction } from '../core/functions';
import { type EventBus } from '../core/modules/EventBus';
import { type TPWCanWaitCallback } from '../core/Pushwoosh.types';
import { type Api } from '../modules/Api/Api';
import { type Data } from '../modules/Data/Data';

export default class WorkerPushwooshGlobal {
  public readonly eventBus: EventBus;
  public readonly api: Api;
  public readonly data: Data;

  constructor(eventBus: EventBus, data: Data, api: Api) {
    this.eventBus = eventBus;
    this.data = data;
    this.api = api;
  }

  _listeners: { [key: string]: TPWCanWaitCallback[] } = {};

  push(f: ['onPush', TPWCanWaitCallback]) {
    if (Array.isArray(f) && f[0] === 'onPush' && isFunction(f[1])) {
      if (!this._listeners[f[0]]) {
        this._listeners[f[0]] = [];
      }
      this._listeners[f[0]].push(f[1]);
    }
  }

  getListeners(eventName: string) {
    return this._listeners[eventName] || [];
  }

  public async initApi() {
    return Promise.resolve();
  }
}
