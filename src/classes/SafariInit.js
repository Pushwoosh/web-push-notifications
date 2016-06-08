import EventEmitter from 'eventemitter3';
import createDoApiXHR from '../utils/createDoApiXHR';
import API from './API';
import PushwooshError from './PushwooshError';

import {getBrowserVersion, getDeviceName} from '../utils/functions';

import {keyTagsWasSetted} from '../constants';
// const keySubscribed = 'pushwooshSubscribed';

export default class PushwooshSafari {
  constructor(params) {
    this.webSitePushID = params.webSitePushID;
    this.pushwooshUrl = params.pushwooshUrl;
    this.applicationCode = params.applicationCode;
    this.logger = params.logger;

    this.ee = new EventEmitter();
  }

  getPermission() {
    return window.safari.pushNotification.permission(this.webSitePushID);
  }

  trySubscribe() {
    this.checkRemotePermission(this.getPermission());
  }

  init() {
    setTimeout(() => this.trySubscribe(), 0);
    return new Promise((resolve, reject) => {
      this.ee.once('success', () => {
        resolve(this.api);
      });
      this.ee.once('failure', reject);
    });
  }

  checkRemotePermission(permissionData) {
    this.logger.debug('permissionData', permissionData);

    if (permissionData && permissionData.deviceToken) {
      this.hwid = permissionData.deviceToken.toLowerCase();
    }

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
      this.logger.debug(`You pushtoken is ${permissionData.deviceToken.toLowerCase()}`);
      this.api = new API({
        doPushwooshApiMethod: createDoApiXHR(this.pushwooshUrl, this.logger),
        applicationCode: this.applicationCode,
        hwid: this.hwid,
        pushToken: this.hwid.toUpperCase()
      });
      this.setDefaultTags().then(() => this.ee.emit('success'));
      this.sendPushStat();
    }
  }

  setDefaultTags() {
    return Promise.resolve().then(() => { // eslint-disable-line consistent-return
      if (localStorage.getItem(keyTagsWasSetted) !== 'true') {
        localStorage.setItem(keyTagsWasSetted, 'true');
        return this.api.setTags({
          // eslint-disable-next-line quote-props
          'Language': window.navigator.language || 'en',
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
