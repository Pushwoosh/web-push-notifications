export const defaultServiceWorkerUrl = 'pushwoosh-service-worker.js';

export const periodSendAppOpen = 3600000;
export const periodGoalEvent = 86400000;

export const defaultNotificationTitle = 'Pushwoosh notification';
export const defaultNotificationImage = 'https://cp.pushwoosh.com/img/logo-medium.png';
export const defaultNotificationUrl = '/';

export const keyApiParams = 'API_PARAMS';
export const keyInitParams = 'INIT_PARAMS';
export const keySDKVersion = 'SDK_VERSION';
export const keyWorkerVersion = 'WORKER_VERSION';
export const keyLastSentAppOpen = 'LAST_SENT_APP_OPEN';
export const keyLastOpenMessage = 'LAST_OPEN_MESSAGE';
export const keyApiBaseUrl = 'API_BASE_URL';
export const keyShowSubscribeWidget = 'WIDGET_SHOWED';
export const keyClickSubscribeWidget = 'WIDGET_CLICKED';

// Local storage keys
export const keyFakePushToken = 'fakePushToken';
export const KEY_DEVICE_REGISTRATION_STATUS: string = 'deviceRegistrationStatus';
export const keySafariPreviousPermission = 'safariPreviousPermission';

// Device registration status
export const DEVICE_REGISTRATION_STATUS_REGISTERED: string = 'registered';
export const DEVICE_REGISTRATION_STATUS_UNREGISTERED: string = 'unregistered';

// GCM Sender ID
export const keyDBSenderID = 'GCM_SENDER_ID';
export const keyFcmSubscription = 'FCM_SUBSCRIPTION';

export const manualSetLoggerLevel = 'PW_SET_LOGGER_LEVEL';

export const KEY_DELAYED_EVENT = 'DELAYED_EVENT';

// Events
export const EVENT_SHOW_SUBSCRIBE_BUTTON = 'showSubscribeButton';
export const EVENT_CLICK_SUBSCRIBE_BUTTON = 'clickSubscribeButton';

// Permissions
export const PERMISSION_DENIED: string = 'denied';
export const PERMISSION_GRANTED: string = 'granted';
export const PERMISSION_PROMPT: string = 'default';

// Browsers
export const BROWSER_TYPE_SAFARI: number = 10;
export const BROWSER_TYPE_CHROME: number = 11;
export const BROWSER_TYPE_FF: number = 12;
