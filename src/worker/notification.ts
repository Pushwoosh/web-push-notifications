declare const self: ServiceWorkerGlobalScope;

export default class PushwooshNotification {
  private _canceled = false;

  private readonly showNotificationOptions: NotificationOptions;
  private readonly body: string;
  private readonly title: string;

  constructor(
    showNotificationOptions: NotificationOptions,
    body: string,
    title: string,
  ) {
    this.showNotificationOptions = showNotificationOptions;
    this.body = body;
    this.title = title;
  }

  async show() {
    if (this._canceled) {
      return;
    }

    const showNotificationOptions = this.showNotificationOptions;
    if (!showNotificationOptions.silent) {
      await self.registration.showNotification(this.title, showNotificationOptions);
    }
  }

  cancel() {
    this._canceled = true;
  }
}
