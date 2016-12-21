import {
  keyValue,
  log,
  message as messagesLog
} from './storage';
import {
  keyWorkerVerion,
  defaultNotificationTitle,
  defaultNotificationImage,
  defaultNotificationUrl
} from './constants';
import {getVersion} from './functions';
import Logger from './logger'
import WorkerPushwooshGlobal from './worker/global';
import PushwooshNotification from './worker/notification';

declare const caches: Cache;

const Pushwoosh = self.Pushwoosh = new WorkerPushwooshGlobal();

async function onPush(event: PushEvent) {
  try {
    const payload = event.data.json();
    await Logger.write('info', payload, 'onPush');
    const notification = new PushwooshNotification({
      title: payload.header || defaultNotificationTitle,
      body: payload.body,
      icon: payload.i || defaultNotificationImage,
      openUrl: payload.l || defaultNotificationUrl,
      messageHash: payload.p
    });
    const callbacks = Pushwoosh.getListeners('onPush');
    await callbacks.reduce((pr, fun) => pr.then(() => fun(notification)), Promise.resolve());
    await Promise.all([
      notification.show(),
      messagesLog.add({
        ...notification._forLog(),
        payload
      })
    ]);
  }
  catch (e) {
    await messagesLog.add({
      error: `${e}`,
      stack: e.stack,
      payload: event.data.text()
    });
  }
}

async function onClick(event: NotificationEvent) {
  let tag = JSON.parse(event.notification.tag);
  event.notification.close();
  await Promise.all([
    self.clients.openWindow(tag.url),
    Pushwoosh.initApi().then(() => Pushwoosh.api.pushStat(tag.messageHash))
  ]);
}

self.addEventListener('install', (event: InstallEvent) => {
  event.waitUntil(Promise.all([
    keyValue.set(keyWorkerVerion, getVersion()),
    Logger.write('info', 'install')
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', function(event: ExtendableEvent) {
  console.info('activate', event);
  event.waitUntil(caches.keys().then(cacheNames => {
    return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }).then(() => Logger.write('info', 'activate')).then(() => self.clients.claim()));
});

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(onPush(event).catch(e => console.log(e)));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.waitUntil(onClick(event));
});
