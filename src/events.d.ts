type EventName = keyof EventHandlerMap;
type EventPayload<Parameters extends Record<string, unknown>> = Parameters & Record<'eventId', string>;
type EventHandler<Payload extends EventPayload<Record<string, unknown>>> = (payload: Payload) => void | Promise<void>;

/* system events handlers map */
interface EventHandlerMap {
  'ready': EventHandler<EventPayload<Record<string, never>>>,
  'change-enabled-communication': EventHandler<EventPayload<{ isEnabled: boolean }>>,
  'initialize-in-apps-module': EventHandler<EventPayload<Record<string, never>>>,
  'initialize-in-apps-module-error': EventHandler<EventPayload<{ error: Error }>>,
}

/* device events handlers map */
interface EventHandlerMap {
  'register': EventHandler<EventPayload<Record<string, never>>>,
  'unregister': EventHandler<EventPayload<Record<string, never>>>,
}

/* push notification events handlers map */
interface EventHandlerMap {
  'show-subscription-widget': EventHandler<EventPayload<Record<string, never>>>,
  'hide-subscription-widget': EventHandler<EventPayload<Record<string, never>>>,
  'show-notification-permission-dialog': EventHandler<EventPayload<Record<string, never>>>,
  'hide-notification-permission-dialog': EventHandler<EventPayload<{ permission: NotificationPermission }>>,
  'permission-default': EventHandler<EventPayload<Record<string, never>>>,
  'permission-denied': EventHandler<EventPayload<Record<string, never>>>,
  'permission-granted': EventHandler<EventPayload<Record<string, never>>>,
  'change-permission': EventHandler<EventPayload<{ permission: NotificationPermission }>>,
  'initialize-service-worker': EventHandler<EventPayload<Record<string, never>>>,
  'initialize-service-worker-error': EventHandler<EventPayload<{ error: Error }>>,
  'subscribe': EventHandler<EventPayload<Record<string, never>>>,
  'unsubscribe': EventHandler<EventPayload<Record<string, never>>>,
  'receive-push': EventHandler<EventPayload<{ notification: unknown }>>,
  'show-notification': EventHandler<EventPayload<{ notification: unknown }>>,
  'open-notification': EventHandler<EventPayload<{ notification: unknown }>>,
  'hide-notification': EventHandler<EventPayload<{ notification: unknown }>>,
}

/* inbox events handlers map */
interface EventHandlerMap {
  'receive-inbox-message': EventHandler<EventPayload<{ message: unknown }>>,
  'update-inbox-messages': EventHandler<EventPayload<{ messages: unknown }>>,
}

/* in-app events handlers map */
interface EventHandlerMap {
  'receive-in-app-code': EventHandler<EventPayload<{ code: string }>>,
  'show-in-app': EventHandler<EventPayload<{ code: string }>>,
  'hide-in-app': EventHandler<EventPayload<{ code: string }>>,
}
