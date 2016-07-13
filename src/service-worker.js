import {keyValue} from './utils/storage';
import {
  keyApplicationCode, defaultPushwooshUrl,
  keyDefaultNotificationTitle, keyDefaultNotificationImage, keyDefaultNotificationUrl,
  defaultNotificationTitle, defaultNotificationImage, defaultNotificationUrl,
  keyWorkerSDKVersion, keyLanguage
} from './constants';
import Logger from './classes/Logger';
import API from './classes/API';
import {
  getBrowserType,
  getVersion
} from './utils/functions';
import createDoApiFetch from './utils/createDoApiFetch';

class WorkerRunner {
  constructor() {
    this.pushwooshUrl = defaultPushwooshUrl;
    this.logger = new Logger('debug');
  }

  getApplicationCode() {
    return keyValue.get(keyApplicationCode).then(code => {
      if (!code) {
        throw new Error('no code');
      }
      return code;
    });
  }

  initApi(reinit) {
    if (this.api && !reinit) {
      return Promise.resolve();
    }
    return Promise.all([
      self.registration.pushManager.getSubscription(),
      this.getApplicationCode(),
      keyValue.get(keyLanguage)
    ])
      .then(([subscription, applicationCode, lang]) => {
        this.api = API.create(
          subscription,
          applicationCode,
          createDoApiFetch(this.pushwooshUrl, this.logger),
          lang
        );
      });
  }

  showMessage(message, pTitle, pImage, pUrl, pHash) {
    this.logger.info('showMessage', message, pTitle, pImage, pUrl, pHash);

    return Promise.all([
      keyValue.get(keyDefaultNotificationTitle),
      keyValue.get(keyDefaultNotificationImage),
      keyValue.get(keyDefaultNotificationUrl)
    ]).then(([defaultTitle, defaultImage, defaultUrl]) => {
      const title = pTitle || defaultTitle || defaultNotificationTitle;
      const icon = pImage || defaultImage || defaultNotificationImage;
      const url = pUrl || defaultUrl || defaultNotificationUrl;

      return self.registration.showNotification(title, {
        body: message,
        icon: icon,
        tag: JSON.stringify({
          url: url,
          messageHash: pHash
        })
      });
    });
  }

  showOldMessage() {
    this.logger.info('showOldMessage');

    this.initApi().then(() => {
      return this.api.callAPI('getLastMessage', {device_type: getBrowserType()})
        .then(({notification}) => {
          this.logger.info('getLastMessage', notification);
          return this.showMessage(
            notification.content,
            notification.chromeTitle,
            notification.chromeIcon,
            notification.url,
            notification.messageHash
          );
        });
    });
  }

  showPayloadMessage(data) {
    return Promise.resolve().then(() => {
      const payload = data.json();
      this.logger.info('payload', payload);
      return this.showMessage(
        payload.body,
        payload.header,
        payload.i,
        payload.u,
        payload.p
      );
    });
  }

  push(event) {
    this.logger.info('onPush', event);
    event.waitUntil(event.data ? this.showPayloadMessage(event.data) : this.showOldMessage());
  }

  sendPushStat(hash) {
    this.logger.debug('sendPushStat', hash);
    return this.initApi().then(() => {
      return this.api.pushStat(hash).catch(err => this.logger.error('send push stat error', err));
    });
  }

  click(event) {
    this.logger.info('onClick', event);
    let {tag} = event.notification;
    tag = JSON.parse(tag);
    event.waitUntil(Promise.all([
      this.sendPushStat(tag.messageHash),
      clients.openWindow(tag.url).then(() => event.notification.close()) // eslint-disable-line no-undef
    ]));
  }

  install(event) {
    this.logger.info('onInstall', event);
    event.waitUntil(keyValue.set(keyWorkerSDKVersion, getVersion()).then(() => self.skipWaiting()));
  }

  activate(event) {
    this.logger.info('onActivate', event);
    return event.waitUntil(caches.keys().then(cacheNames => {
      return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }).then(self.clients.claim()));
  }

  subscriptionChange(event) {
    this.logger.info('onPushSubscriptionChange', event);
    event.waitUntil(
      self.registration.pushManager.subscribe({userVisibleOnly: true}).then(() => {
        return this.initApi(true).then(() => {
          return this.api.registerDevice().then(() => this.logger.info('Re-register done.'));
        });
      })
    );
  }
}


const runner = new WorkerRunner();

self.addEventListener('push', (event) => runner.push(event));
self.addEventListener('notificationclick', (event) => runner.click(event));
self.addEventListener('install', (event) => runner.install(event));
self.addEventListener('activate', (event) => runner.activate(event));
self.addEventListener('pushsubscriptionchange', (event) => runner.subscriptionChange(event));

self.Pushwoosh = runner;
