export interface IPushServiceSubscriptionKeys {
  pushToken?: string;
  publicKey?: string;
  authToken?: string;
  endpoint?: string;
}

export abstract class IPushService {
  /**
   * Get current status of permission for send notifications.
   *
   * @return { NotificationPermission }
   */
  public abstract getPermission(): NotificationPermission;

  /**
   * Check is permission granted.
   *
   * @return { boolean }
   */
  public abstract checkIsPermissionGranted(): boolean;

  /**
   * Check is permission default.
   *
   * @return { boolean }
   */
  public abstract checkIsPermissionDefault(): boolean;

  /**
   * Check is manual unsubscribed for push notifications.
   */
  public abstract checkIsManualUnsubscribed(): Promise<boolean>;

  /**
   * Request permission for send notifications.
   *
   * @return { Promise<void> }
   */
  public abstract askPermission(): Promise<void>;

  /**
   * Get subscription keys for send push notifications.
   *
   * @return { Promise<IPushServiceSubscriptionKeys> }
   */
  public abstract getTokens(): Promise<IPushServiceSubscriptionKeys>;

  /**
   * Subscribe for push notifications.
   *
   * @return { Promise<void> }
   */
  public abstract subscribe(): Promise<void>;

  /**
   * Unsubscribe for push notifications.
   *
   * @return { Promise<void> }
   */
  public abstract unsubscribe(): Promise<void>;

  /**
   * Check can receive notifications from Pushwoosh.
   *
   * @return { Promise<boolean> }
   */
  public abstract checkIsRegister(): Promise<boolean>;

  /**
   * Check is change sender configuration
   */
  public abstract checkIsNeedResubscribe(): Promise<boolean>;
}
