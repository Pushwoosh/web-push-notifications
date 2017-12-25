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

export const keyFakePushToken = 'fakePushToken';
export const keyDeviceRegistrationStatus = 'deviceRegistrationStatus';
export const keySafariPreviousPermission = 'safariPreviousPermission';

export const manualSetLoggerLevel = 'PW_SET_LOGGER_LEVEL';

// Events
export const EVENT_SHOW_SUBSCRIBE_BUTTON = 'showSubscribeButton';
export const EVENT_CLICK_SUBSCRIBE_BUTTON = 'clickSubscribeButton';

// Permissions
export const PERMISSION_DENIED = 'denied';
export const PERMISSION_GRANTED = 'granted';
export const PERMISSION_PROMPT = 'default';

// Browsers
export const BROWSER_TYPE_SAFARI = 10;
export const BROWSER_TYPE_CHROME = 11;
export const BROWSER_TYPE_FF = 12;
