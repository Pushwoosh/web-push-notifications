export default class PushwooshNotification {
  private _origMess: INotificationOptions;
  private _changedMess: INotificationOptions;
  private _canceled = false;

  constructor(info: INotificationOptions) {
    this._origMess = info;
    this._changedMess = {...info};
  }

  get title() {
    return this._changedMess.title;
  }
  set title(title: string) {
    this._changedMess.title = title;
  }

  get body() {
    return this._changedMess.body || '';
  }
  set body(body: string) {
    this._changedMess.body = body;
  }

  get icon() {
    return this._changedMess.icon;
  }
  set icon(icon) {
    this._changedMess.icon = icon;
  }

  get openUrl() {
    return this._changedMess.openUrl;
  }
  set openUrl(openUrl) {
    this._changedMess.openUrl = openUrl;
  }

  get duration() {
    return this._changedMess.duration;
  }
  set duration(duration) {
    this._changedMess.duration = duration;
  }

  get messageHash() {
    return this._changedMess.messageHash;
  }
  set messageHash(messageHash) {
    this._changedMess.messageHash = messageHash;
  }

  get customData() {
    return this._changedMess.customData;
  }
  set customData(customData) {
    this._changedMess.customData = customData;
  }

  get campaignCode() {
    return this._changedMess.campaignCode
  }
  set campaignCode(campaignCode) {
    this._changedMess.campaignCode = campaignCode;
  }

  async show() {
    if (!this._canceled) {
      const code = `notificationCode-${Date.now()}`;
      const {image} = this._changedMess;
      let {buttons} = this._changedMess;

      if (buttons && Array.isArray(buttons)) {
        buttons.forEach((button: TNotificationButton, key: number) => {
          button.action = `action-${key}`
        });
      }
      const notificationOptions = {
        body: this.body,
        icon: this.icon,
        requireInteraction: this.duration === 0 || this.duration > 20,
        tag: JSON.stringify({
          url: this.openUrl,
          messageHash: this.messageHash,
          customData: this.customData
        }),
        data: {
          code,
          buttons,
          duration: this.duration,
          image,
          campaignCode: this.campaignCode
        },
        actions: buttons,
        image
      };
      await self.registration.showNotification(this.title, notificationOptions);
      const notifications = await self.registration.getNotifications();
      notifications.forEach(notification => {
        if (notification.data && notification.data.code === code && this.duration) {
          setTimeout(() => notification.close(), 1000 * this.duration);
        }
      });
    }
  }

  cancel() {
    this._canceled = true;
  }

  _forLog() {
    return {
      orig: this._origMess,
      changed: this._changedMess,
      canceled: this._canceled,
    };
  }
}

