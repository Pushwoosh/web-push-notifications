import EventEmitter from 'eventemitter3';

export default class BaseInit {
  constructor(params) {
    this._params = params;
    this.ee = new EventEmitter();
    Object.keys(params).forEach(k => {
      this[k] = params[k];
    });
    this.logger.debug('inited with params', params);
  }
}
