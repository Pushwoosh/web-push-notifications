type TMessageInfo = {
  title: string;
  body: string;
  icon: string;
  openUrl: string;
  messageHash: string;
}

export default class PushwooshNotification {
  private _origMess: TMessageInfo;
  private _changedMess: TMessageInfo;
  private _canceled = false;

  constructor(info: TMessageInfo) {
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
    return this._changedMess.body;
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

  show() {
    if (!this._canceled) {
      const {_changedMess} = this;
      return self.registration.showNotification(_changedMess.title, {
        body: _changedMess.body,
        icon: _changedMess.icon,
        tag: JSON.stringify({
          url: _changedMess.openUrl,
          messageHash: _changedMess.messageHash
        })
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

