import {keyValue} from '../utils/storage';
import BaseInit from './BaseInit';
import createDoApiXHR from '../utils/createDoApiXHR';
import API from './API';
import PushwooshError from './PushwooshError';

import {getVersion} from '../utils/functions';

import {
  keyWasRegistered, keyApplicationCode,
  keyDefaultNotificationTitle, keyDefaultNotificationImage, keyDefaultNotificationUrl,
  keyWorkerSDKVersion, keyLanguage
} from '../constants';

export default class PushwooshWorker extends BaseInit {

  getWorkerUrl(second) {
    return `${second ? this.workerSecondUrl : this.workerUrl}?applicationCode=${this.applicationCode}`;
  }

  trySubscribe() {
    navigator.serviceWorker.getRegistration()
      .then(serviceWorkerRegistration => {
        this.logger.debug('sw', serviceWorkerRegistration);
        if (!serviceWorkerRegistration) {
          return this.registerSW();
        }
        if (serviceWorkerRegistration.active) {
          return keyValue.get(keyWorkerSDKVersion).then(workerSDKVersion => {
            const curVersion = getVersion();
            this.logger.debug('workerSDKVersion===curVersion', workerSDKVersion, curVersion);
            if (workerSDKVersion !== curVersion) {
              this.logger.debug('re-register for new version');
              return this.registerSW(`${serviceWorkerRegistration.active.scriptURL}`.indexOf(this.workerUrl) > -1);
            }
            return serviceWorkerRegistration;
          });
        }
        else if (serviceWorkerRegistration.installing == null) {
          return this.registerSW();
        }
        return serviceWorkerRegistration;
      })
      .then(serviceWorkerRegistration => this.subscribeForPushes(serviceWorkerRegistration))
      .then(() => this.ee.emit('success'))
      .catch(err => this.ee.emit('failure', err));
  }

  registerSW(second) {
    this.logger.debug('register worker', second);
    return navigator.serviceWorker.register(this.getWorkerUrl(second));
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

  subscribeForPushes(serviceWorkerRegistration) {
    if (!('showNotification' in ServiceWorkerRegistration.prototype) || !('PushManager' in window)) {
      const err = 'Notifications aren\'t supported.';
      this.logger.error(err);
      throw err;
    }

    if (Notification.permission === 'denied') {
      const err = new PushwooshError('The user has blocked notifications.', PushwooshError.codes.userDenied);
      this.logger.error(err);
      throw err;
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
        this.api = API.create(
          subscription,
          this.applicationCode,
          createDoApiXHR(this.pushwooshUrl, this.logger),
          navigator.language
        );
        return this.register();
      })
      .catch(e => {
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
    }).then(() => Promise.all([
      keyValue.set(keyApplicationCode, this.applicationCode),
      keyValue.set(keyDefaultNotificationTitle, this.defaultNotificationTitle),
      keyValue.set(keyDefaultNotificationImage, this.defaultNotificationImage),
      keyValue.set(keyDefaultNotificationUrl, this.defaultNotificationUrl),
      keyValue.set(keyLanguage, navigator.language)
    ]));
  }
}
