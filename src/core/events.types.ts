export type EventPayload<Parameters extends Record<string, unknown>> = Parameters & Record<'eventId', string>;
export type EventHandler<Payload extends EventPayload<Record<string, unknown>>> = (payload: Payload) => void | Promise<void>;

export interface EventHandlerMap {
  /* system events handlers map */
  ready: EventHandler<EventPayload<Record<string, never>>>;
  'change-enabled-communication': EventHandler<EventPayload<{ isEnabled: boolean }>>;

  /* device events handlers map */
  register: EventHandler<EventPayload<Record<string, never>>>;
  unregister: EventHandler<EventPayload<Record<string, never>>>;

  /* push notification events handlers map */
  'show-subscription-widget': EventHandler<EventPayload<Record<string, never>>>;
  'hide-subscription-widget': EventHandler<EventPayload<Record<string, never>>>;
  'show-notification-permission-dialog': EventHandler<EventPayload<Record<string, never>>>;
  'hide-notification-permission-dialog': EventHandler<EventPayload<{ permission: NotificationPermission }>>;
  'permission-default': EventHandler<EventPayload<Record<string, never>>>;
  'permission-denied': EventHandler<EventPayload<Record<string, never>>>;
  'permission-granted': EventHandler<EventPayload<Record<string, never>>>;
  'change-permission': EventHandler<EventPayload<{ permission: NotificationPermission }>>;
  'initialize-service-worker': EventHandler<EventPayload<Record<string, never>>>;
  'initialize-service-worker-error': EventHandler<EventPayload<{ error: Error }>>;
  subscribe: EventHandler<EventPayload<Record<string, never>>>;
  unsubscribe: EventHandler<EventPayload<Record<string, never>>>;
  'receive-push': EventHandler<EventPayload<{ notification: unknown }>>;
  'show-notification': EventHandler<EventPayload<{ notification: unknown }>>;
  'open-notification': EventHandler<EventPayload<{ notification: unknown }>>;
  'hide-notification': EventHandler<EventPayload<{ notification: unknown }>>;

  /* inbox events handlers map */
  'receive-inbox-message': EventHandler<EventPayload<{ message: unknown }>>;
  'update-inbox-messages': EventHandler<EventPayload<{ messages: unknown }>>;

  /* in-app events handlers map */
  'receive-in-app-code': EventHandler<EventPayload<{ code: string }>>;

  /* subscribe popup events */
  'subscribe-popup-ready': EventHandler<EventPayload<Record<string, never>>>;
  'subscribe-popup-show': EventHandler<EventPayload<Record<string, never>>>;
  'subscribe-popup-hide': EventHandler<EventPayload<Record<string, never>>>;
  'subscribe-popup-decline': EventHandler<EventPayload<Record<string, never>>>;
  'subscribe-popup-accept': EventHandler<EventPayload<Record<string, never>>>;
}

export type EventName = keyof EventHandlerMap;
