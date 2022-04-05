export const DEFAULT_SERVICE_WORKER_URL = '/pushwoosh-service-worker.js';
export const DEFAULT_API_URL = 'https://cp.pushwoosh.com/json/1.3/';

// @TODO: this ID should belong to PUSHWOOSH_APP (not abandoned cart)
export const FACEBOOK_APP_ID = '436711767081797';
export const FACEBOOK_HWID_KEY = 'FACEBOOK_HWID_KEY';

export const PERIOD_SEND_APP_OPEN = 3600000;
export const PERIOD_GOAL_EVENT = 86400000;
export const DEFAULT_NOTIFICATION_DURATION = 10;
export const MIN_NOTIFICATION_DURATION = 10; // The min time when the interaction buttons will be displayed
export const MAX_NOTIFICATION_DURATION = 55; // Service worker dies if he pokes more than 110 seconds
export const WAKE_UP_SERVICE_WORKER_INTERVAL = 20; // seconds

export const DEFAULT_NOTIFICATION_TITLE = 'Pushwoosh notification';
export const DEFAULT_NOTIFICATION_IMAGE = 'https://cp.pushwoosh.com/img/logo-medium.png';

// Keys
export const KEY_SHOW_SUBSCRIBE_WIDGET = 'WIDGET_SHOWED';
export const KEY_CLICK_SUBSCRIBE_WIDGET = 'WIDGET_CLICKED';

// Local storage keys
export const KEY_DEVICE_REGISTRATION_STATUS: string = 'deviceRegistrationStatus';
export const KEY_SAFARI_PREVIOUS_PERMISSION = 'safariPreviousPermission';
export const MANUAL_SET_LOGGER_LEVEL = 'PW_SET_LOGGER_LEVEL';

// Device registration status
export const DEVICE_REGISTRATION_STATUS_REGISTERED: string = 'registered';
export const DEVICE_REGISTRATION_STATUS_UNREGISTERED: string = 'unregistered';

// Permissions
export const PERMISSION_DENIED = 'denied';
export const PERMISSION_GRANTED = 'granted';
export const PERMISSION_PROMPT = 'default';

// Events
export const EVENT_ON_LOAD = 'onLoad';
export const EVENT_ON_READY = 'onReady';
export const EVENT_ON_SUBSCRIBE = 'onSubscribe';
export const EVENT_ON_UNSUBSCRIBE = 'onUnsubscribe';
export const EVENT_ON_REGISTER = 'onRegister';
export const EVENT_ON_PERMISSION_PROMPT = 'onPermissionPrompt';
export const EVENT_ON_PERMISSION_DENIED = 'onPermissionDenied';
export const EVENT_ON_PERMISSION_GRANTED = 'onPermissionGranted';
export const EVENT_ON_SW_INIT_ERROR = 'onSWInitError';
export const EVENT_ON_PUSH_DELIVERY = 'onPushDelivery';
export const EVENT_ON_NOTIFICATION_CLICK = 'onNotificationClick';
export const EVENT_ON_NOTIFICATION_CLOSE = 'onNotificationClose';
export const EVENT_ON_CHANGE_COMMUNICATION_ENABLED = 'onChangeCommunicationEnabled';
export const EVENT_ON_PUT_NEW_MESSAGE_TO_INBOX_STORE = 'onPutNewMessageToInboxStore';
export const EVENT_ON_UPDATE_INBOX_MESSAGES = 'onUpdateInboxMessages';
export const EVENT_ON_SHOW_NOTIFICATION_PERMISSION_DIALOG = 'onShowNotificationPermissionDialog';
export const EVENT_ON_HIDE_NOTIFICATION_PERMISSION_DIALOG = 'onHideNotificationPermissionDialog';

export const EVENT_ON_SHOW_SUBSCRIPTION_WIDGET = 'onShowSubscriptionWidget';
export const EVENT_ON_HIDE_SUBSCRIPTION_WIDGET = 'onHideSubscriptionWidget';

// Post Events
export const EVENT_SHOW_SUBSCRIBE_BUTTON = 'showSubscribeButton';
export const EVENT_CLICK_SUBSCRIBE_BUTTON = 'clickSubscribeButton';
export const EVENT_GDPR_CONSENT = 'GDPRConsent';
export const EVENT_GDPR_DELETE = 'GDPRDelete';
export const EVENT_PW_SITE_OPENED = 'PW_SiteOpened'; // for default events

// Manual unsubscription
export const MANUAL_UNSUBSCRIBE = 'MANUAL_UNSUBSCRIBE';

// Page visited
export const PAGE_VISITED_URL = 'PAGE_VISITED_URL';

export const SUBSCRIPTION_SEGMENT_EVENT = 'Subscription Segments';

export const SUBSCRIPTION_WIDGET_USE_CASE_NOT_SET = 'not-set';
export const SUBSCRIPTION_WIDGET_USE_CASE_DEFAULT = 'default';
export const SUBSCRIPTION_WIDGET_USE_CASE_TOPIC_BASED = 'topic-based';

export const SUBSCRIPTION_PROMPT_WIDGET_DEFAULT_CONFIG = {
  headerText: 'Subscribe to our news',
  headerTextColor: '#000000',
  subheaderText: 'Don\'t miss out on the latest news and updates!',
  subheaderTextColor: '#000000',
  buttonAcceptText: 'Agree',
  buttonAcceptTextColor: '#1A72E8',
  buttonAcceptRound: '4px',
  buttonAcceptBackgroundColor: '#FFFFFF',
  buttonAcceptBorderColor: '#E3E4E8',
  buttonCancelText: 'Deny',
  buttonCancelTextColor: '#1A72E8',
  buttonCancelRound: '4px',
  buttonCancelBackgroundColor: '#FFFFFF',
  buttonCancelBorderColor: '#E3E4E8',
  cappingCount: 3,
  cappingDelay: 1000 * 60 * 60 * 4, // time in ms
  backgroundColor: '#FFFFFF'
};
