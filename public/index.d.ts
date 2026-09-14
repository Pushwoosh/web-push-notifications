export = PW;
export as namespace PW;

declare namespace PW {
  class Pushwoosh {
    constructor();

    /**
     * Method that puts the stored error/info messages to browser console.
     * @type {{showLog: (() => Promise<any>); showKeyValues: (() => Promise<any>); showMessages: (() => Promise<any>)}}
     */
    debug: any;

    /**
     * Polymorph PW method.
     * Can get an array in the format of [string, params | callback] or a function.
     *
     *  // with callback:
     *  Pushwoosh.push(['onNotificationClick', function(api, payload) {
     *    // click on the notification
     *  }]);
     *
     *  // with function:
     *  Pushwoosh.push(function(api) {
     *    // this is a bit easier way to subscribe to onReady
     *  });
     *
     *  // with params:
     *  // initiates Pushwoosh service and notification subscription
     *  Pushwoosh.push(['init', {
     *    applicationCode: 'XXXXX-XXXXX',
     *    // see more about params in documentation
     *    // https://docs.pushwoosh.com/docs/web-push-sdk-30#section-integration
     *  }]);
     *
     */
    push(input: EventHandler | [EventName, EventHandler] | ['init', InitParams]): void;

    /**
     * Subscribe to an SDK event by name, e.g. 'web-popups-ready',
     * 'show-web-popup', 'hide-web-popup'.
     */
    addEventHandler(name: string, handler: (payload: any) => void): void;

    /**
     * Remove a handler previously added with addEventHandler.
     */
    removeEventHandler(name: string, handler: (payload: any) => void): void;

    /**
     * Programmatic interfaces published by the loaded widgets.
     * Every entry is optional, and when it appears differs per widget:
     * `webPopups` registers as soon as its bundle loads, while `subscribePopup`
     * and `subscriptionPrompt` register only if their own startup decides they
     * are active this session.
     */
    moduleRegistry: ModuleRegistry;

    /**
     * Checks device's subscription status
     * @returns {boolean | Promise<boolean>}
     */
    isSubscribed(): boolean | Promise<boolean>;

    /**
     * Method returns hardware id.
     * @returns {Promise<string>}
     */
    getHWID(): Promise<string>;

    /**
     * Method returns push token.
     * @returns {Promise<string>}
     */
    getPushToken(): Promise<string>;

    /**
     * Method returns userId
     * @returns {Promise<string | null>}
     */
    getUserId(): Promise<string>;

    /**
     * Method returns an object with all params.
     * @returns {Promise<PWParams>}
     */
    getParams(): Promise<PWParams>;

    /** True when the site can subscribe: browser supports push, it is configured and `pushNotifications` is not false. */
    isPushAvailable(): boolean;

    /**
     * Method initializes the permission dialog on the device
     * and registers through the API in case the device hasn't been registered before.
     * @param {{registerLess?: boolean}} params
     * @returns {Promise<void>}
     */
    subscribe(): Promise<void>;

    /**
     * Unsubscribes the device.
     * @returns {Promise<void>}
     */
    unsubscribe(): Promise<void>;
  }

  type EventHandler = (api: API, params?: any) => void;

  type EventName = 'onReady'
    | 'onSubscribe'
    | 'onUnsubscribe'
    | 'onRegister'
    | 'onPermissionPrompt'
    | 'onPermissionDenied'
    | 'onPermissionGranted'
    | 'onNotificationClick'
    | 'onPushDelivery'
    | 'onNotificationClose'
    | 'onSWInitError'
    | 'onChangeCommunicationEnabled';

  interface API {
    /**
     * Calls API method applicationOpen with device parameters.
     * @returns {Promise<void>}
     */
    applicationOpen(): Promise<void>;

    /**
     * Calls Pushwoosh API method.
     * @param {string} methodName
     * @param params
     * @returns {Promise<any>}
     */
    callAPI(methodName: string, params?: any): Promise<any>;

    /**
     * Calls API method getTags.
     * Retrieves a list of Tags with corresponding values for the device.
     * @returns {{[p: string]: any}}
     */
    getTags(): { [key: string]: any };

    /**
     * Calls API method messageDeliveryEvent.
     * Registers push delivery event for the device.
     * @param {string} hash
     * @param {boolean} isTrackingLogOnFailure
     * @returns {Promise<void>}
     */
    messageDeliveryEvent(hash: string, isTrackingLogOnFailure: boolean): Promise<void>;

    /**
     * Calls API method postEvent.
     * Calls the event within the particular application.
     * Event name is humanized, and should match the event name in Pushwoosh Control Panel.
     * @param {string} eventName
     * @param {{[p: string]: any}} params
     * @returns {Promise<void>}
     */
    postEvent(eventName: string, params: { [key: string]: any }): Promise<void>;

    /**
     * Calls API method pushStat.
     * Registers a push open event
     * @param {string} hash
     * @param {boolean} isTrackingLogOnFailure
     * @returns {Promise<void>}
     */
    pushStat(hash: string, isTrackingLogOnFailure: boolean): Promise<void>;

    /**
     * Calls API method registerDevice with device parameters.
     * Saves the registration status to localStorage.
     * @returns {Promise<void>}
     */
    registerDevice(): Promise<void>;

    /**
     * Calls API method registerUser with user parameters.
     * Sets new user data to IndexedDB if needed.
     * @param {string} userId
     * @returns {Promise<void>}
     */
    registerUser(userId: string): Promise<void>;

    /**
     * Calls API method setTags.
     * Sets Tag values for the device.
     * @param {{[p: string]: any}} tags
     * @returns {Promise<void>}
     */
    setTags(tags: { [key: string]: any }): Promise<void>;

    /**
     * Sets the device language. Takes priority over initParams tags.Language
     * and the browser's navigator.language. Also sends the value as a "Language" tag.
     * @param {string} language - language locale (ISO-639-1, lowercase two-letter code recommended)
     * @returns {Promise<void>}
     */
    setLanguage(language: string): Promise<void>;

    /**
     * Calls API method unregisterDevice.
     * Removes the registration status from localStorage.
     * @returns {Promise<void>}
     */
    unregisterDevice(): Promise<void>;

    /**
     * Send "GDPRConsent" postEvent and depends on param "isEnabled"
     * device will be registered/unregistered from all communication channels.
     * @param {boolean} isEnabled
     * @returns {Promise<void>}
     */
    setCommunicationEnabled(isEnabled: boolean): Promise<void>;

    /**
     * Check current communication enabled
     * @returns {Promise<boolean>}
     */
    isCommunicationEnabled(): Promise<boolean>;

    /**
     * Send "GDPRDelete" postEvent and remove all device device data from Pushwoosh.
     * @returns {Promise<void>}
     */
    removeAllDeviceData(): Promise<void>;

    /**
     * Calls API method checkDevice with code and hwid parameters.
     * @param {string} code
     * @param {string} hwid
     * @returns {Promise<any>}
     */
    checkDevice(code: string, hwid: string): Promise<any>;
  }

  /**
   * Web popups configuration, passed as `webPopups` in the init params.
   */
  interface WebPopupsConfig {
    /**
     * `false` turns the widget off entirely: the bundle is never loaded.
     * Defaults to `true`, so web popups run unless the site opts out.
     */
    enable?: boolean;
    /** Which palette a dark-mode popup renders with; 'auto' (default) = the
     * visitor's OS setting, which a site with its own theme can override here. */
    colorScheme?: 'auto' | 'light' | 'dark';
    /**
     * `false` turns off automatic display entirely: popups are still loaded but
     * never shown by the SDK itself, leaving the site to call
     * `Pushwoosh.moduleRegistry.webPopups.show(code)`. Defaults to `true`.
     */
    autoShow?: boolean;
  }

  /**
   * Snapshot of the web popups pipeline, for debugging and integration.
   */
  interface WebPopupsState {
    /** Code of the popup currently on screen, if any. */
    visible: string | null;
    /** Popups whose delay has elapsed, waiting for the display slot. */
    queued: string[];
    /** Popups whose delay timer is armed for the current page. */
    waiting: string[];
    /** Every popup code the server returned for this device. */
    available: string[];
  }

  /**
   * Web popups programmatic API, available as
   * `Pushwoosh.moduleRegistry.webPopups` once the widget bundle has loaded.
   *
   * At most one popup is on screen at a time; popups that become eligible
   * meanwhile wait in a queue and show once the current one closes.
   */
  interface WebPopupsApi {
    /**
     * Show a popup by its code, ignoring every display condition: delay, page
     * rules, device type, visitor type, frequency capping and the campaign's
     * trigger setting. Closes the currently visible popup, if any.
     *
     * Resolves true when the popup was shown, false when the code is unknown
     * or its content could not be loaded. Never rejects.
     */
    show(code: string): Promise<boolean>;

    /**
     * Hide the visible popup, or only the given one when a code is passed.
     * Returns false when nothing was hidden.
     */
    hide(code?: string): boolean;

    /**
     * Hide the visible popup and dismiss everything still pending for this page
     * load. `show()` keeps working afterwards.
     */
    hideAll(): boolean;

    /** Whether any popup — or the given one — is on screen. */
    isVisible(code?: string): boolean;

    /** Code of the popup on screen, or null. */
    getVisibleCode(): string | null;

    /** Every popup code the server returned for this device. */
    getAvailableCodes(): string[];

    /** Snapshot of the display pipeline. */
    getState(): WebPopupsState;
  }

  /**
   * Programmatic interfaces published by the loaded widgets.
   */
  interface ModuleRegistry {
    webPopups?: WebPopupsApi;
    subscribePopup?: {
      show(): void;
      hide(): void;
      toggle(isShown?: boolean): void;
    };
    subscriptionPrompt?: {
      show(): void;
      hide(): void;
    };
    [key: string]: any;
  }

  /**
   * Initialization parameters.
   */
  interface InitParams {
    applicationCode: string;
    autoSubscribe?: boolean;
    defaultNotificationImage?: string;
    defaultNotificationTitle?: string;
    logLevel?: 'error' | 'info' | 'debug';
    /**
     * `false` turns the push part off (service worker, prompt, widgets), keeping popups and inbox.
     * Devices subscribed earlier are NOT unsubscribed: call `unsubscribe()` for that.
     */
    pushNotifications?: boolean;
    pushwooshApiUrl?: string;
    pushwooshUrl?: string;
    safariWebsitePushID?: string;
    scope?: string;
    serviceWorkerUrl?: string | null;
    subscribeWidget?: SubscribeWidget;
    inboxWidget?: InboxWidget;
    webPopups?: WebPopupsConfig;
    tags?: { [key: string]: any };
    userId?: string;
  }

  /**
   * Init params and driver api params
   */
  interface PWParams {
    applicationCode: string;
    autoSubscribe?: boolean;
    defaultNotificationImage?: string;
    defaultNotificationTitle?: string;
    logLevel?: 'error' | 'info' | 'debug';
    pushNotifications?: boolean;
    pushwooshApiUrl?: string;
    safariWebsitePushID?: string;
    scope?: string;
    subscribeWidget?: SubscribeWidget;
    inboxWidget?: InboxWidget;
    webPopups?: WebPopupsConfig;
    tags?: {
      Language: string;
      'Device Model': string;
      [key: string]: any;
    };
    userId?: string;
    pushwooshUrl?: string;
    deviceType?: number;
    serviceWorkerUrl?: string | null;
    authToken?: string;
    hwid?: string;
    publicKey?: string;
    pushToken?: string;
  }

  /**
   * Sets subscription widget interface parameters.
   */
  interface SubscribeWidget {
    enable: boolean;
    position?: string;
    bgColor?: string;
    bellColor?: string;
    shadow?: string;
    size?: string;
    indent?: string;
    zIndex?: string;
    tooltipText?: TooltipText;
  }

  /**
   * Sets inbox widget interface parameters.
   */
  interface InboxWidget {
    enable: boolean;
    triggerId?: string;
    position?: string;
  }

  /**
   * Sets subscribe widget tooltip interface parameters.
   */
  interface TooltipText {
    successSubscribe?: string;
    needSubscribe?: string;
    blockSubscribe?: string;
    alreadySubscribed?: string;
  }

  /**
   * Payload for onPushDelivery event callback.
   *
   * Pushwoosh.push['onPushDelivery', (api: PW.API, payload: PW.onPushDeliveryPayload) => {}]
   */
  interface onPushDeliveryPayload {
    title: string;
    body: string;
    icon: string;
    openUrl: string;
    messageHash: string;
    customData?: { [key: string]: any };
  }

  /**
   * Payload for onNotificationClick event callback.
   *
   * Pushwoosh.push['onNotificationClick', (api: PW.API, payload: PW.onNotificationClickPayload) => {}]
   */
  interface onNotificationClickPayload {
    url: string;
    messageHash: string;
    customData?: { [key: string]: any };
  }

  /**
   * Payload for onNotificationClose event callback.
   *
   * Pushwoosh.push['onNotificationClose', (api: PW.API, payload: PW.onNotificationClosePayload) => {}]
   */
  interface onNotificationClosePayload {
    url: string;
    messageHash: string;
  }
}
