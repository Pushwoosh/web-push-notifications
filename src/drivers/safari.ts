class SafariDriver implements IPWDriver {
  constructor(private params: {applicationCode: string, webSitePushID: string, pushwooshUrl: string}) {

  }

  private getPermissionObject() {
    return safari.pushNotification.permission(this.params.webSitePushID);
  }

  async getPermission() {
    const {permission} = this.getPermissionObject();
    return permission === 'default' ? 'prompt' : permission;
  }

  async isSubscribed() {
    const perm = await this.getPermission();
    return perm === 'granted';
  }

  askSubscribe() {
    return new Promise((resolve, reject) => {
      safari.pushNotification.requestPermission(
        `${this.params.pushwooshUrl}safari`,
        this.params.webSitePushID,
        {application: this.params.applicationCode},
        (permission) => {
          if (permission.permission === 'granted') {
            resolve();
          }
          else {
            reject('The user said no');
          }
        }
      );
    });
  }

  async getAPIParams() {
    const {deviceToken} = this.getPermissionObject();
    if (!deviceToken) {
      throw new Error('empty deviceToken');
    }
    const hwid = deviceToken.toLowerCase();
    const pushToken = deviceToken.toUpperCase();
    return {hwid, pushToken};
  }
}

export default SafariDriver;
