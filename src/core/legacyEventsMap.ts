import * as CONSTANTS from './constants';
import type { EventName } from './events.types';

export const legacyEventsMap: Record<string, { name: EventName; prop?: string }> = {
  [CONSTANTS.LEGACY_EVENT_ON_REGISTER]: {
    name: 'register',
  },
  [CONSTANTS.LEGACY_EVENT_ON_SUBSCRIBE]: {
    name: 'subscribe',
  },
  [CONSTANTS.LEGACY_EVENT_ON_UNSUBSCRIBE]: {
    name: 'unsubscribe',
  },
  [CONSTANTS.LEGACY_EVENT_ON_SW_INIT_ERROR]: {
    name: 'initialize-service-worker-error',
    prop: 'error',
  },
  [CONSTANTS.LEGACY_EVENT_ON_PUSH_DELIVERY]: {
    name: 'receive-push',
    prop: 'notification',
  },
  [CONSTANTS.LEGACY_EVENT_ON_NOTIFICATION_CLICK]: {
    name: 'open-notification',
    prop: 'notification',
  },
  [CONSTANTS.LEGACY_EVENT_ON_NOTIFICATION_CLOSE]: {
    name: 'hide-notification',
    prop: 'notification',
  },
  [CONSTANTS.LEGACY_EVENT_ON_CHANGE_COMMUNICATION_ENABLED]: {
    name: 'change-enabled-communication',
    prop: 'isEnabled',
  },
  [CONSTANTS.LEGACY_EVENT_ON_PUT_NEW_MESSAGE_TO_INBOX_STORE]: {
    name: 'receive-inbox-message',
    prop: 'message',
  },
  [CONSTANTS.LEGACY_EVENT_ON_UPDATE_INBOX_MESSAGES]: {
    name: 'update-inbox-messages',
    prop: 'messages',
  },
  [CONSTANTS.LEGACY_EVENT_ON_SHOW_NOTIFICATION_PERMISSION_DIALOG]: {
    name: 'show-notification-permission-dialog',
  },
  [CONSTANTS.LEGACY_EVENT_ON_HIDE_NOTIFICATION_PERMISSION_DIALOG]: {
    name: 'hide-notification-permission-dialog',
    prop: 'permission',
  },
  [CONSTANTS.LEGACY_EVENT_ON_SHOW_SUBSCRIPTION_WIDGET]: {
    name: 'show-subscription-widget',
  },
  [CONSTANTS.LEGACY_EVENT_ON_HIDE_SUBSCRIPTION_WIDGET]: {
    name: 'hide-subscription-widget',
  },
  [CONSTANTS.LEGACY_EVENT_ON_PERMISSION_DENIED]: {
    name: 'permission-denied',
  },
  [CONSTANTS.LEGACY_EVENT_ON_PERMISSION_PROMPT]: {
    name: 'permission-default',
  },
  [CONSTANTS.LEGACY_EVENT_ON_PERMISSION_GRANTED]: {
    name: 'permission-granted',
  },
};
