import {keyValue, message as messagesLog} from './storage';
import {
  KEY_WORKER_VERSION,
  KEY_LAST_OPEN_MESSAGE,
  PERIOD_GOAL_EVENT,
  DEFAULT_NOTIFICATION_TITLE,
  DEFAULT_NOTIFICATION_IMAGE,
  DEFAULT_NOTIFICATION_URL,
  KEY_INIT_PARAMS,

  KEY_DELAYED_EVENT,
  EVENT_ON_PUSH_DELIVERY,
  EVENT_ON_NOTIFICATION_CLICK,
  EVENT_ON_NOTIFICATION_CLOSE
} from './constants';
import {getVersion, prepareDuration} from './functions';
import Logger from './logger';
import WorkerPushwooshGlobal from './worker/global';
import PushwooshNotification from './worker/notification';

const Pushwoosh = self.Pushwoosh = new WorkerPushwooshGlobal();

async function broadcastClients(msg: IPWBroadcastClientsParams) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage(msg));
}

async function parseCustomData(customData: any) {
  if (customData) {
    try {
      return JSON.parse(customData);
    }
    catch (e) {
      await Logger.write('error', e, 'Error occurred during parsing custom data');
    }
  }
  return customData;
}

async function getNotificationData(event: PushEvent) {
  const initParams = await keyValue.get(KEY_INIT_PARAMS);
  Logger.setLevel(initParams.logLevel);
  const payload = await event.data.json();
  const notificationData = payload.data || payload;
  await Logger.write('info', JSON.stringify(notificationData), 'onPush');
  const messageHash = notificationData.p || '';
  const buttons = notificationData.buttons || [];
  const image = notificationData.image || '';
  const duration = prepareDuration(notificationData.duration);
  const customData = await parseCustomData(notificationData.u);
  return {
    messageHash,
    payload,
    notificationPayload: {
      title: notificationData.header || initParams.defaultNotificationTitle || DEFAULT_NOTIFICATION_TITLE,
      body: notificationData.body,
      icon: notificationData.i || initParams.defaultNotificationImage || DEFAULT_NOTIFICATION_IMAGE,
      openUrl: notificationData.l || DEFAULT_NOTIFICATION_URL,
      messageHash,
      customData,
      duration,
      buttons,
      image
    }
  };
}

async function onPush(event: PushEvent) {
  try {
    const {
      messageHash,
      payload,
      notificationPayload
    } = await getNotificationData(event);
    const notification = new PushwooshNotification(notificationPayload);
    const callbacks = Pushwoosh.getListeners('onPush');
    await callbacks.reduce((pr, fun) => pr.then(() => fun(notification)), Promise.resolve());
    await Promise.all([
      notification.show(),
      messageHash && Pushwoosh.initApi().then(() => Pushwoosh.api.messageDeliveryEvent(messageHash)),
      messagesLog.add({
        ...notification._forLog(),
        payload
      }),
      broadcastClients({type: EVENT_ON_PUSH_DELIVERY, payload: notificationPayload})
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

const clickedNotifications: any = [];

async function onClick(event: NotificationEvent) {
  const data = event.notification.data;
  const tag = JSON.parse(event.notification.tag);
  clickedNotifications.push(data.code);
  event.notification.close();
  let url = '';
  if (event.action && Array.isArray(data.buttons)) {
    const button = data.buttons.find((button: NotificationButton) => button.action === event.action) || {};
    url = button.url;
  } else {
    url = tag.url;
  }
  const message = {type: EVENT_ON_NOTIFICATION_CLICK, payload: {...tag, url}};
  if (url) {
    await event.waitUntil(self.clients.matchAll({
      type: "window"
    }).then(async (clientList: Array<TServiceWorkerClientExtended>) => {
      for (let i = clientList.length - 1; i > -1; --i) {
        const client = clientList[i];
        if ((url === client.url || url === '/') && 'focus' in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        await keyValue.set(KEY_DELAYED_EVENT, message);
        return self.clients.openWindow(url);
      }
    }));
  }
  await Promise.all([
    Pushwoosh.initApi().then(() => Pushwoosh.api.pushStat(tag.messageHash)),
    keyValue.set(KEY_LAST_OPEN_MESSAGE, {
      url,
      messageHash: tag.messageHash,
      expiry: Date.now() + PERIOD_GOAL_EVENT
    }),
    broadcastClients(message)
  ]);
}

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(Promise.all([
    keyValue.set(KEY_WORKER_VERSION, getVersion()),
    Logger.write('info', 'install')
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', function (event: ExtendableEvent) {
  console.info('activate', event);
  event.waitUntil(Promise.all([
    Logger.write('info', 'activate')
  ]).then(() => self.clients.claim()));
});

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(onPush(event).catch(e => console.log(e)));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.waitUntil(onClick(event).catch(e => console.log(e)));
});

self.addEventListener('notificationclose', (event: NotificationEvent) => {
  const code = event.notification.data && event.notification.data.code;
  const tag = JSON.parse(event.notification.tag);
  event.notification.close();
  const index = clickedNotifications.indexOf(code);
  if (index >= 0) {
    clickedNotifications.splice(index, 1);
  } else {
    broadcastClients({type: EVENT_ON_NOTIFICATION_CLOSE, payload: tag}).catch(e => console.log(e));
  }
});
