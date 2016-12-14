import BaseInit from './BaseInit';
import createDoApiXHR from '../utils/createDoApiXHR';
import API from './API';
import PushwooshError from './PushwooshError';

import {getBrowserVersion, getDeviceName, getVersion} from '../utils/functions';

import {keyTagsWasSetted} from '../constants';

export default class PushwooshSafari extends BaseInit {

  getPermission() {
    return window.safari.pushNotification.permission(this.webSitePushID);
  }

  initSubscribe() {
    setTimeout(() => this.checkRemotePermission(this.getPermission()), 0);
    return new Promise((resolve, reject) => {
      this.ee.once('success', () => {
        resolve(this.api);
      });
      this.ee.once('failure', reject);
    });
  }

  unsubscribe() {
    return this.initApi().then(api => api.unregisterDevice());
  }

  initApi() {
    return Promise.resolve().then(() => {
      const permissionData = this.getPermission();
      if (permissionData.permission === 'denied') {
        const err = new PushwooshError('The user said no.', PushwooshError.codes.userDenied);
        this.logger.error(err);
        throw err;
      }
      if (!permissionData.deviceToken) {
        throw new PushwooshError('permissionData.deviceToken is empty');
      }
      const hwid = permissionData.deviceToken.toLowerCase();
      this.api = new API({
        doPushwooshApiMethod: createDoApiXHR(this.pushwooshUrl, this.logger),
        applicationCode: this.applicationCode,
        hwid: hwid,
        pushToken: hwid.toUpperCase()
      });
      this.sendPushStat();
      return this.api;
    });
  }

  checkRemotePermission(permissionData) {
    this.logger.debug('permissionData', permissionData);

    if (permissionData.permission === 'default') {
      this.logger.debug('This is a new web service URL and its validity is unknown.');
      window.safari.pushNotification.requestPermission(
        `${this.pushwooshUrl}safari`,
        this.webSitePushID,
        {application: this.applicationCode},
        (perm) => this.checkRemotePermission(perm)
      );
    }
    else if (permissionData.permission === 'denied') {
      const err = new PushwooshError('The user said no.', PushwooshError.codes.userDenied);
      this.logger.error(err);
      this.ee.emit('failure', err);
    }
    else if (permissionData.permission === 'granted') {
      this.logger.debug('The web service URL is a valid push provider, and the user said yes.');
      this.initApi()
        .then(() => this.setDefaultTags())
        .then(() => this.ee.emit('success'));
    }
  }

  setDefaultTags() {
    return Promise.resolve().then(() => { // eslint-disable-line consistent-return
      const keyTagsWasSettedValue = `${getBrowserVersion()}_${this.api.hwid}_${getVersion()}`;
      if (localStorage.getItem(keyTagsWasSetted) !== keyTagsWasSettedValue) {
        localStorage.setItem(keyTagsWasSetted, keyTagsWasSettedValue);
        return this.api.setTags({
          // eslint-disable-next-line quote-props
          'Language': navigator.language || 'en',
          'Device Model': getBrowserVersion(),
          'Device Name': getDeviceName()
        });
      }
    });
  }

  sendPushStat() {
    try {
      const hashReg = /#P(.*)/;
      const hash = decodeURIComponent(document.location.hash);

      if (hashReg.test(hash)) {
        this.api.pushStat(hashReg.exec(hash)[1]).then(() => this.logger.debug('Push stat sent successfully'));
      }
    }
    catch (e) {
      this.logger.info(`error send push stat: ${e}`);
    }
  }
}
