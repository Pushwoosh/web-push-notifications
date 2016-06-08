import localForage from 'localforage';
import EventEmitter from 'eventemitter3';
import createDoApiXHR from '../utils/createDoApiXHR';
import API from './API';
import PushwooshError from './PushwooshError';

import {getPushToken, generateHwid, getEncryptionKey} from '../utils/functions';

import {keyWasRegistered, keyApplicationCode} from '../constants';

export default class PushwooshWorker {
  constructor(params) {
    this.workerUrl = params.workerUrl;
    this.pushwooshUrl = params.pushwooshUrl;
    this.applicationCode = params.applicationCode;
    this.logger = params.logger;

    this.ee = new EventEmitter();
  }

  getWorkerUrl() {
    return `${this.workerUrl}?applicationCode=${this.applicationCode}`;
  }

  trySubscribe() {
    navigator.serviceWorker.register(this.getWorkerUrl())
      .then(serviceWorkerRegistration => this.registerServiceWorker(serviceWorkerRegistration))
      .catch(err => this.ee.emit('failure', err));
  }

  init() {
    setTimeout(() => this.trySubscribe(), 0);
    return new Promise((resolve, reject) => {
      this.ee.once('success', () => {
        resolve(this.api);
      });
      this.ee.once('failure', reject);
    });
  }


  registerServiceWorker(serviceWorkerRegistration) {
    if (!('showNotification' in ServiceWorkerRegistration.prototype) || !('PushManager' in window)) {
      const err = 'Notifications aren\'t supported.';
      this.logger.error(err);
      return this.ee.emit('failure', err);
    }

    if (Notification.permission === 'denied') {
      const err = new PushwooshError('The user has blocked notifications.', PushwooshError.codes.userDenied);
      this.logger.error(err);
      return this.ee.emit('failure', err);
    }

    return serviceWorkerRegistration.pushManager.getSubscription()
      .then(subscription => {
        if (!subscription) {
          return serviceWorkerRegistration.pushManager.subscribe({
            name: 'push',
            userVisibleOnly: true
          });
        }
        return subscription;
      })
      .then(subscription => {
        // The subscription was successful
        const pushToken = getPushToken(subscription);
        const hwid = generateHwid(this.applicationCode, pushToken);
        const encryptionKey = getEncryptionKey(subscription);

        this.api = new API({
          doPushwooshApiMethod: createDoApiXHR(this.pushwooshUrl, this.logger),
          applicationCode: this.applicationCode,
          hwid: hwid,
          pushToken: pushToken,
          encryptionKey: encryptionKey
        });
        return this.register().then(() => this.ee.emit('success'));
      })
      .catch((e) => {
        let err;
        if (Notification.permission === 'denied') {
          err = new PushwooshError('Permission for Notifications was denied.', PushwooshError.codes.userDenied);
        }
        else {
          err = `Unable to subscribe to push: ${e}`;
        }
        this.logger.error(err);
        this.ee.emit('failure', err);
      });
  }

  register() {
    return Promise.resolve().then(() => { // eslint-disable-line consistent-return
      if (localStorage.getItem(keyWasRegistered) !== 'true') {
        localStorage.setItem(keyWasRegistered, 'true');
        return this.api.registerDevice();
      }
    }).then(() => localForage.setItem(keyApplicationCode, this.applicationCode));
  }
}
