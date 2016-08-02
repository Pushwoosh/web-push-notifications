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

  initSubscribe() {
    return navigator.serviceWorker.getRegistration()
      .then(serviceWorkerRegistration => {
        this.logger.debug('sw', serviceWorkerRegistration);
        if (!serviceWorkerRegistration || serviceWorkerRegistration.installing == null) {
          return this.registerSW();
        }
        return serviceWorkerRegistration;
      })
      .then(serviceWorkerRegistration => this.subscribeForPushes(serviceWorkerRegistration))
      .then(() => this.api);
  }

  unsubscribe() {
    return Promise.all([
      this.initApi(),
      navigator.serviceWorker.getRegistration().then(reg => reg.pushManager.getSubscription())
    ]).then(([api, subs]) => {
      return api.unregisterDevice().then(() => {
        return subs.unsubscribe();
      });
    });
  }

  initApi() {
    return Promise.all([
      keyValue.set(keyApplicationCode, this.applicationCode),
      keyValue.set(keyDefaultNotificationTitle, this.defaultNotificationTitle),
      keyValue.set(keyDefaultNotificationImage, this.defaultNotificationImage),
      keyValue.set(keyDefaultNotificationUrl, this.defaultNotificationUrl),
      keyValue.set(keyLanguage, navigator.language)
    ])
      .then(() => {
        if (Notification.permission === 'denied') {
          const err = new PushwooshError('The user has blocked notifications.', PushwooshError.codes.userDenied);
          this.logger.error(err);
          throw err;
        }
        return navigator.serviceWorker.getRegistration();
      })
      .then(serviceWorkerRegistration => {
        if (!serviceWorkerRegistration) {
          const err = new PushwooshError('No serviceWorkerRegistration');
          this.logger.error(err);
          throw err;
        }
        if (this.workerSecondUrl && serviceWorkerRegistration.active) {
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
        return serviceWorkerRegistration;
      })
      .then(serviceWorkerRegistration => {
        this.logger.debug('sw', serviceWorkerRegistration);
        return serviceWorkerRegistration.pushManager.getSubscription();
      })
      .then(subscription => {
        if (!subscription) {
          const err = new PushwooshError('No subscription');
          this.logger.error(err);
          throw err;
        }
        this.api = API.create(
          subscription,
          this.applicationCode,
          createDoApiXHR(this.pushwooshUrl, this.logger),
          navigator.language
        );
        return this.api;
      });
  }

  getWorkerUrl(second) {
    return `${second ? this.workerSecondUrl : this.workerUrl}?applicationCode=${this.applicationCode}`;
  }


  registerSW(second) {
    this.logger.debug('register worker', second);
    return navigator.serviceWorker.register(this.getWorkerUrl(second));
  }

  subscribeForPushes(serviceWorkerRegistration) {
    return serviceWorkerRegistration.pushManager.getSubscription()
      .then(subscription => {
        if (!subscription) {
          return serviceWorkerRegistration.pushManager.subscribe({
            userVisibleOnly: true
          });
        }
        return subscription;
      })
      .then(() => this.register())
      .catch(e => {
        let err;
        if (Notification.permission === 'denied') {
          err = new PushwooshError('Permission for Notifications was denied.', PushwooshError.codes.userDenied);
        }
        else {
          err = `Unable to subscribe to push: ${e}`;
        }
        this.logger.error(err);
        throw err;
      });
  }

  register() {
    return this.initApi().then(() => { // eslint-disable-line consistent-return
      const {api} = this;
      const keyWasRegisteredValue = `${api.hwid}_${getVersion()}`;
      if (localStorage.getItem(keyWasRegistered) !== keyWasRegisteredValue) {
        localStorage.setItem(keyWasRegistered, keyWasRegisteredValue);
        return api.registerDevice();
      }
    });
  }
}
