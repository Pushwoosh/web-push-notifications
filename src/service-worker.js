import {codesKeyValue} from './utils/storage';
import {keyApplicationCode, defaultPushwooshUrl} from './constants';
import Logger from './classes/Logger';
import API from './classes/API';
import {getPushToken, generateHwid, getEncryptionKey, getBrowserType} from './utils/functions';
import createDoApiFetch from './utils/createDoApiFetch';

// console.log(self.location);

class WorkerRunner {
  constructor() {
    this.pushwooshUrl = defaultPushwooshUrl;
    this.logger = new Logger('debug');
  }

  getApplicationCode() {
    return codesKeyValue().get(keyApplicationCode).then(code => {
      if (!code) {
        throw new Error('no code');
      }
      return code;
    });
  }

  initApi() {
    if (this.api) {
      return Promise.resolve();
    }
    return Promise.all([
      self.registration.pushManager.getSubscription(),
      this.getApplicationCode()
    ])
      .then(([subscription, applicationCode]) => {
        const pushToken = getPushToken(subscription);
        const hwid = generateHwid(applicationCode, pushToken);
        const encryptionKey = getEncryptionKey(subscription);

        this.api = new API({
          doPushwooshApiMethod: createDoApiFetch(this.pushwooshUrl, this.logger),
          applicationCode: applicationCode,
          hwid: hwid,
          pushToken: pushToken,
          encryptionKey: encryptionKey
        });
      });
  }

  showMessage(result) {
    this.logger.info('showMessage', result);
    const {notification} = result;

    const title = notification.chromeTitle || 'Title';
    const message = notification.content;
    const icon = notification.chromeIcon || 'https://cp.pushwoosh.com/img/logo-medium.png';
    const messageHash = notification.messageHash;
    const url = notification.url || '/';


    const tag = {
      url: url,
      messageHash: messageHash
    };
    return self.registration.showNotification(title, {
      body: message,
      icon: icon,
      tag: JSON.stringify(tag)
    });
  }

  push(event) {
    this.logger.info('onPush', event);
    event.waitUntil(this.initApi().then(() => {
      return this.api.callAPI('getLastMessage', {device_type: getBrowserType()}).then(lastMessage => {
        return this.showMessage(lastMessage);
      });
    }));
  }

  click(event) {
    this.logger.info('onClick', event);
    let {tag} = event.notification;
    tag = JSON.parse(tag);
    event.waitUntil(Promise.resolve().then(() => {
      return this.api.pushStat(tag.messageHash);
    }));
    event.notification.close();
    return clients.openWindow(tag.url); // eslint-disable-line no-undef
  }

  activate(event) {
    return event.waitUntil(caches.keys().then(cacheNames => {
      return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }));
  }
}


const runner = new WorkerRunner();

self.addEventListener('push', (event) => runner.push(event));
self.addEventListener('notificationclick', (event) => runner.click(event));
self.addEventListener('activate', (event) => runner.activate(event));

self.Pushwoosh = runner;
