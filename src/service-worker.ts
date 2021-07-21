import { EventBus } from './core/modules/EventBus';
import { Data } from './modules/Data/Data';
import { Api } from './modules/Api/Api';

import { PushServiceDefault } from './services/PushService/drivers/PushServiceDefault/PushServiceDefault';

import {sendFatalLogToRemoteServer} from './helpers/logger';
import {message as messagesLog} from './storage';
import {
  PERIOD_GOAL_EVENT,
  EVENT_ON_PUSH_DELIVERY,
  EVENT_ON_NOTIFICATION_CLICK,
  EVENT_ON_NOTIFICATION_CLOSE,
  EVENT_ON_PUT_NEW_MESSAGE_TO_INBOX_STORE
} from './constants';

import {parseSerializedNotificationParams} from './functions';
import { Logger } from './logger';
import WorkerPushwooshGlobal from './worker/global';
import PushwooshNotification from './worker/notification';
import NotificationPayload from './models/NotificationPayload';
import InboxMessages from './models/InboxMessages';
import InboxMessagesPublic from './modules/InboxMessagesPublic';

const eventBus = new EventBus();
const data = new Data();
const api = new Api(eventBus, data);

const Pushwoosh = self.Pushwoosh = new WorkerPushwooshGlobal(eventBus, data, api);
const clickedNotifications: string[] = [];


self.addEventListener('install', onInstallEventHandler);

self.addEventListener('activate', onActivateEventHandler);

self.addEventListener('push', onPushEventHandler);

self.addEventListener('notificationclick', onClickNotificationEventHandler);

self.addEventListener('notificationclose', onCloseNotificationEventHandler);

self.addEventListener('pushsubscriptionchange', onPushSubscriptionChange);


/**
 * On install SW event handler
 * Update indexedDB SW version and skip waiting stage
 * @param event
 */
function onInstallEventHandler(event: ExtendableEvent): void {

  async function onInstall(): Promise<void> {
    await Promise.all([
      Pushwoosh.data.setServiceWorkerVersion(__VERSION__),
      Logger.write('info', 'install')
    ]);

    // PUSH-21674 - not auto closing push if push receive when chrome is closed
    await self.skipWaiting();
  }

  return event.waitUntil(
    onInstall()
      .catch(onInstallFailure)
  );
}

/**
 * On activate SW event handler
 * Do nothing, only write log
 * @param event
 */
function onActivateEventHandler(event: ExtendableEvent) {
  async function onActivate(): Promise<void> {
    await Promise.all([
      Logger.write('info', 'activate')
    ]);

    await self.clients.claim()
  }

  event.waitUntil(
    onActivate()
      .catch(onActivateFailure)
  )
}

/**
 * On push SW event handler
 * @param event
 */
function onPushEventHandler(event: PushEvent): void {
  async function onPush(event: PushEvent): Promise<void> {
    // wake up SW on all pages
    await self.clients.claim();

    // get payload
    const payload = await event.data.json();

    // create notification payload
    const notificationPayload = new NotificationPayload(payload);

    // get notification options
    const notificationOptions = await notificationPayload.getNotificationOptionsPayload();

    // get notification show options
    const notificationShowOptions = await notificationPayload.getShowNotificationOptions();

    // get message hash
    const messageHash = notificationPayload.messageHash;

    // logging in indexedDB;
    await Logger.write('info', JSON.stringify(notificationOptions), 'onPush');

    // show notification instance
    const notification = new PushwooshNotification(
      notificationShowOptions,
      notificationPayload.duration,
      notificationPayload.body,
      await notificationPayload.getTitle()
    );

    // Call receive push listeners
    const callbacks = Pushwoosh.getListeners('onPush');

    await callbacks.reduce((pr, fun) => pr.then(() => fun(notification)), Promise.resolve());

    // Execute receive push actions
    const onPushActions = [
      notification.show(),  // Show notification
      messagesLog.add({  // Put message to messages store
        payload: payload,
        parsedPayload: notificationOptions,
        showOptions: notificationShowOptions
      }),
      broadcastClients({type: EVENT_ON_PUSH_DELIVERY, payload: notificationOptions}),  // post message to window clients
    ];

    // Send delivery statistic
    if (messageHash) {
      onPushActions.push(
        Pushwoosh.initApi().then(() => Pushwoosh.api.messageDeliveryEvent(messageHash, true))
      );
    }

    // Inbox message actions
    if (notificationPayload.inboxId !== '') {
      const inboxMessages = new InboxMessages(Pushwoosh.eventBus, Pushwoosh.data, Pushwoosh.api);
      const inboxMessagesPublic = new InboxMessagesPublic(Pushwoosh.data, Pushwoosh.api, inboxMessages);
      const inboxMessagePayload = await notificationPayload.getInboxMessage();

      const payload = await inboxMessagesPublic.publicMessageBuilder(inboxMessagePayload);
      onPushActions.push(
        inboxMessages.putMessage(inboxMessagePayload),  // put message to inboxMessages store
        broadcastClients({  // post message to window clients
          type: EVENT_ON_PUT_NEW_MESSAGE_TO_INBOX_STORE,
          payload
        })
      );
    }

    await Promise.all(onPushActions)
  }

  event.waitUntil(
    onPush(event)
      .catch((error) => onPushFailure(error, event))
  );
}

/**
 * On click notification event handler
 * @param event
 */
function onClickNotificationEventHandler(event: NotificationEvent): void {

  async function onClickNotification(event: NotificationEvent) {
    await self.clients.claim();

    // get notification options
    const notificationOptions = await parseNotificationEvent(event);

    const {
      messageHash,
      metaData,
      url,
      code,
      inboxId
    } = notificationOptions;

    if (code) {
      clickedNotifications.push(code);
    }

    if (inboxId !== '') {
      const inboxMessages = new InboxMessages(Pushwoosh.eventBus, Pushwoosh.data, Pushwoosh.api);

      const message = await inboxMessages.getMessage(inboxId);
      (<TInboxMessageStatusOpen>message.status) = 3;
      await inboxMessages.putMessage(message);
    }

    event.notification.close();

    const message = {type: EVENT_ON_NOTIFICATION_CLICK, payload: notificationOptions};

    if (url) {
      event.waitUntil(
        self.clients.matchAll({ type: 'window' })
          .then((windowClients) => {
            return focusWindow(windowClients, url);
          })
          .then((isFocusOnNewWindowClient) => {
            if (isFocusOnNewWindowClient) {
              Pushwoosh.data.setDelayedEvent(message);
            }
          })
      );
    }

    return Promise.all([
      Pushwoosh.initApi().then(() => Pushwoosh.api.pushStat(messageHash, true, metaData)),
      Pushwoosh.data.setLastOpenMessage({
        url,
        messageHash,
        expiry: Date.now() + PERIOD_GOAL_EVENT
      }),
      broadcastClients(message)
    ]);
  }

  event.waitUntil(
    onClickNotification(event)
      .catch(onClickNotificationFailure)
  );
}

/**
 * On close notification event handler
 * @param event
 */
function onCloseNotificationEventHandler(event: NotificationEvent) {
  async function closeNotification(event: NotificationEvent): Promise<void> {
    await self.clients.claim();

    const notificationOptions = await parseNotificationEvent(event);
    const {code} = notificationOptions;

    event.notification.close();

    if (!code) {
      return;
    }

    const index = clickedNotifications.indexOf(code);
    if (index >= 0) {
      clickedNotifications.splice(index, 1);
    } else {
      return broadcastClients({type: EVENT_ON_NOTIFICATION_CLOSE, payload: notificationOptions})
    }
  }

  event.waitUntil(
    closeNotification(event)
      .catch(closeNotificationFailure)
  )
}

async function onPushSubscriptionChange(event: PushSubscriptionChangeEvent): Promise<void> {
  async function changePushSubscription(event: PushSubscriptionChangeEvent): Promise<void>{
    let subscription = event.newSubscription;
    if (!subscription) {
      subscription = await self.registration.pushManager.getSubscription();
      if (!subscription) {
        fetch('https://post-log.pushwoosh.com/websdk', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=UTF-8'
          },
          body: JSON.stringify({
            type: 'websdk',
            error: {
              code: 0,
              message: 'Cannot get subscription in service worker!'
            }
          })
        });

        return;
      }
    }

    const pushService = new PushServiceDefault(api, data, {});
    await pushService.subscribe(subscription);
  }

  event.waitUntil(
    changePushSubscription(event)
      .catch(pushSubscriptionChangeFailure)
  )
}

/**
 * Post message to all Window Clients
 * @param msg
 */
async function broadcastClients(msg: IPWBroadcastClientsParams) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage(msg));
}

async function focusWindow(windowClients: Array<WindowClient>, url: string): Promise<boolean> {
  // if opened url without location, use service worker origin
  const {
    hostname: openedHostname,
    pathname: openedPathname,
  } = new URL(url, self.location.origin);

  const clientWithSameAddress = windowClients.find((windowClient) => {
    const {
      hostname: windowClientHostname,
      pathname: windowClientPathname
    } = new URL(windowClient.url);

    // opened url is equal with current window client url if hostname and pathname are equals
    return windowClientHostname === openedHostname && windowClientPathname === openedPathname;
  });
  if (clientWithSameAddress) {
    await clientWithSameAddress.focus();
    return false; // focus on exist window client
  }

  // if not window client with opened url we must open new window and focus it
  await self.clients.openWindow(url)
    .then((newClientWindow) => {
      newClientWindow.focus();
    });
  return true; // focus on new window client
}

async function parseNotificationEvent(event: NotificationEvent): Promise<INotificationOptions> {
  const {notification = {}} = event;
  const {data: notificationData} = notification;
  const notificationTag = parseSerializedNotificationParams(notification.tag, {});

  let url = '';

  if (event.action && Array.isArray(notificationData.buttons)) {
    const button = notificationData.buttons.find((button: INotificationButton) => button.action === event.action) || {};
    url = button.url;
  } else {
    url = notificationTag.url;
  }

  return {
    requireInteraction: notification.requireInteraction,
    title: notification.title,
    body: notification.body,
    icon: notification.icon,

    buttons: notificationData.buttons,
    duration: notificationData.duration,
    image: notificationData.image,
    code: notificationData.code,
    campaignCode: notificationData.campaignCode,
    inboxId: notificationData.inboxId,

    messageHash: notificationTag.messageHash,
    customData: notificationTag.customData,
    metaData: notificationTag.metaData,
    openUrl: notificationTag.url,

    tag: notification.tag,
    url
  };
}

async function onInstallFailure(error: Error | string): Promise<void> {
  const applicationCode = await Pushwoosh.data.getApplicationCode();
  const workerVersion = await Pushwoosh.data.getServiceWorkerVersion();

  await sendFatalLogToRemoteServer({
    message: 'Error in onInstallEventHandler',
    code: 'FATAL-SW-001',
    error,
    applicationCode,
    workerVersion
  });
}

async function onActivateFailure(error: Error | string): Promise<void> {
  const applicationCode = await Pushwoosh.data.getApplicationCode();
  const workerVersion = await Pushwoosh.data.getServiceWorkerVersion();

  await sendFatalLogToRemoteServer({
    message: 'Error in onActivateEventHandler',
    code: 'FATAL-SW-002',
    error,
    applicationCode,
    workerVersion
  })
}

async function onPushFailure(error: Error | string, event: PushEvent): Promise<void> {
  const applicationCode = await Pushwoosh.data.getApplicationCode();
  const workerVersion = await Pushwoosh.data.getServiceWorkerVersion();

  await sendFatalLogToRemoteServer({
    message: 'Error in onPushEventHandler',
    code: 'FATAL-SW-003',
    error,
    applicationCode,
    workerVersion
  });

  if (!(error instanceof Error)) {
    error = new Error(error);
  }

  return messagesLog.add({
    error: `${error}`,
    stack: error.stack,
    payload: event.data && event.data.text()
  });
}

async function onClickNotificationFailure(error: Error | string): Promise<void> {
  const applicationCode = await Pushwoosh.data.getApplicationCode();
  const workerVersion = await Pushwoosh.data.getServiceWorkerVersion();

  await sendFatalLogToRemoteServer({
    message: 'Error in onNotificationClickEventHandler',
    code: 'FATAL-SW-004',
    error,
    applicationCode,
    workerVersion
  })
}

async function closeNotificationFailure(error: Error | string): Promise<void> {
  const applicationCode = await Pushwoosh.data.getApplicationCode();
  const workerVersion = await Pushwoosh.data.getServiceWorkerVersion();

  await sendFatalLogToRemoteServer({
    message: 'Error in onNotificationCloseEventHandler',
    code: 'FATAL-SW-005',
    error,
    applicationCode,
    workerVersion
  });
}

async function pushSubscriptionChangeFailure(error: Error | string): Promise<void> {
  const applicationCode = await Pushwoosh.data.getApplicationCode();
  const workerVersion = await Pushwoosh.data.getServiceWorkerVersion();

  await sendFatalLogToRemoteServer({
    message: 'Error in onPushSubscriptionChange',
    code: 'FATAL-SW-006',
    error,
    applicationCode,
    workerVersion
  });
}
