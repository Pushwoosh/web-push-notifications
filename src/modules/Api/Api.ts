import { type SetPurchaseAttributes } from './Api.types';
import * as CONSTANTS from '../../core/constants';
import { type EventBus } from '../../core/modules/EventBus';
import { ApiClient } from '../ApiClient/ApiClient';
import {
  type IMapRequest,
  type IMapResponse,
  type IRequest,
} from '../ApiClient/ApiClient.types';
import { Data } from '../Data/Data';

export class Api {
  private readonly data: Data;
  private readonly apiClient: ApiClient;
  private readonly eventBus: EventBus;
  private readonly getIsCommunicationDisabled: () => boolean | undefined;

  constructor(
    eventBus: EventBus,
    data: Data = new Data(),
    apiClient: ApiClient = new ApiClient(),
    getIsCommunicationDisabled: () => boolean | undefined = () => false,
  ) {
    this.eventBus = eventBus;
    this.data = data;
    this.apiClient = apiClient;
    this.getIsCommunicationDisabled = getIsCommunicationDisabled;
  }

  public async checkDevice(): Promise<IMapResponse['checkDevice']> {
    const params = await this.getRequestParams();

    return await this.apiClient.checkDevice(params);
  }

  public async checkDeviceSubscribeForPushNotifications(useCache: boolean = true): Promise<boolean> {
    // get current subscription status from local storage
    let status = localStorage.getItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS);

    // check need force update
    if (typeof status === 'undefined' || !useCache) {
      const { exist, push_token_exist } = await this.checkDevice();
      localStorage.setItem(
        CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS,
        (exist && push_token_exist)
          ? CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED
          : CONSTANTS.DEVICE_REGISTRATION_STATUS_UNREGISTERED,
      );

      status = localStorage.getItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS);
    }

    return status === CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED;
  }

  public async getConfig(features: string[]): Promise<IMapResponse['getConfig']> {
    const params = await this.getRequestParams();

    return this.apiClient.getConfig({
      ...params,
      features,
    });
  }

  public async applicationOpen(): Promise<IMapResponse['applicationOpen']> {
    const params = await this.getRequestParams();

    // set do database latest sending time
    await this.data.setLastOpenApplicationTime(Date.now());

    return this.apiClient.applicationOpen(params);
  }

  public async registerDevice(): Promise<IMapResponse['registerDevice']> {
    // check communication disabled
    const isCommunicationDisabled = await this.data.getStatusCommunicationDisabled();

    // if communication disabled -> can't register device
    if (isCommunicationDisabled) {
      throw new Error(`Can't register device: Communication is disabled!`);
    }

    const params = await this.getRequestParams();
    const tokens = await this.data.getTokens();

    // if there is no pushToken -> user did not grant permission to send push notifications
    if (!tokens.pushToken) {
      throw new Error(`Can't register device: pushToken is not exist!`);
    }

    // register device into Pushwoosh
    const response = await this.apiClient.registerDevice({
      ...params,
      push_token: tokens.pushToken,
      auth_token: tokens.authToken,
      public_key: tokens.publicKey,
    });

    // set info to database, that the device IS NOT manual unsubscribed
    await this.data.setStatusManualUnsubscribed(false);

    // set info to local storage, that device is subscribed
    localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED);

    // emit event
    this.eventBus.dispatchEvent('register', {});

    return response;
  }

  public async unregisterDevice(): Promise<IMapResponse['unregisterDevice']> {
    const params = await this.getRequestParams();
    const response = await this.apiClient.unregisterDevice(params);

    // set info to local storage, that device is unsubscribed
    localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_UNREGISTERED);

    // emit event
    this.eventBus.dispatchEvent('unsubscribe', {});

    return response;
  }

  public async deleteDevice(): Promise<IMapResponse['deleteDevice']> {
    const params = await this.getRequestParams();

    const response = await this.apiClient.deleteDevice(params);

    // set info to database, that the device IS manual unsubscribed
    await this.data.setStatusManualUnsubscribed(true);

    // set info to local storage, that device is unsubscribed
    localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_UNREGISTERED);

    // emit event
    this.eventBus.dispatchEvent('unsubscribe', {});

    return response;
  }

  public async messageDeliveryEvent(hash: string, isTrackingLogOnFailure?: boolean, metaData: { [key: string]: any } = {}): Promise<IMapResponse['messageDeliveryEvent']> {
    const params = await this.getRequestParams();

    return await this.apiClient.messageDeliveryEvent({
      ...params,
      hash,
      metaData,
    });
  }

  public async pushStat(hash: string, isTrackingLogOnFailure?: boolean, metaData: { [key: string]: any } = {}): Promise<IMapResponse['pushStat']> {
    const params = await this.getRequestParams();

    return await this.apiClient.pushStat({
      ...params,
      hash,
      metaData,
    });
  }

  public async setTags(tags: { [key: string]: any }): Promise<IMapResponse['setTags']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject('Communication is disabled');
    }
    const { hwid, device_type, ...params } = await this.getRequestParams();
    const email = await this.data.getEmail();

    // set email tags in pushwoosh
    if (email) {
      await this.apiClient.setEmailTags({
        ...params,
        email,
        tags,
      });
    }

    return this.apiClient.setTags({
      ...params,
      hwid,
      device_type,
      tags,
    });
  }

  public async getTags(): Promise<IMapResponse['getTags']> {
    const params = await this.getRequestParams();

    return this.apiClient.getTags(params);
  }

  public async registerUser(userId: string | number): Promise<IMapResponse['registerUser']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject('Communication is disabled');
    }
    const {
      hwid,
      device_type: _device_type,
      ...params
    } = await this.getRequestParams();
    const deviceType = await this.data.getDeviceType();

    const id = `${userId}`;
    const email = await this.data.getEmail();

    // register user in pushwoosh
    const response = await this.apiClient.registerUser({
      ...params,
      hwid,
      userId: id,
      ts_offset: -(new Date()).getTimezoneOffset() * 60,
      device_type: deviceType,
    });

    // register user email in pushwoosh
    if (email) {
      await this.apiClient.registerEmailUser({
        ...params,
        email,
        userId: id,
        ts_offset: -(new Date()).getTimezoneOffset() * 60,
      });
    }

    // set user id to database
    await this.data.setUserId(`${userId}`);

    // set info to database that user id was change
    await this.data.setStatusUserIdWasChanged(true);

    return response;
  }

  public async registerEmail(email: string, params?: IMapRequest['registerEmail']): Promise<IMapResponse['registerEmail']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject('Communication is disabled');
    }
    const {
      hwid: _hwid,
      device_type: _device_type,
      ...requestParams
    } = await this.getRequestParams();

    // register user email in pushwoosh
    const response = await this.apiClient.registerEmail({
      ...requestParams,
      ...params,
      email,
      ts_offset: -(new Date()).getTimezoneOffset() * 60,
    });

    // set user email to database
    await this.data.setEmail(`${email}`);

    // set info to database that user email was change
    await this.data.setStatusEmailWasChanged(true);

    return response;
  }

  public async postEvent(event: string, attributes: { [key: string]: any }): Promise<IMapResponse['postEvent']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject('Communication is disabled');
    }
    const params = await this.getRequestParams();

    const date = new Date();
    const time = date.getTime();
    const timestampUTC = Math.floor(time / 1000);
    const timestampCurrent = timestampUTC - (date.getTimezoneOffset() / 60 * 3600);

    // if post event send after notification open:
    // need add message hash to event
    const lastOpenMessage = await this.data.getLastOpenMessage();

    if (lastOpenMessage && lastOpenMessage.expiry > Date.now()) {
      if (attributes['msgHash']) {
        return Promise.reject('attribute msgHash already defined');
      }

      attributes = {
        ...attributes,
        msgHash: lastOpenMessage.messageHash,
      };
    }

    // remove last open message
    await this.data.setLastOpenMessage(undefined);

    const response = await this.apiClient.postEvent({
      ...params,
      event,
      timestampUTC,
      timestampCurrent,
      attributes,
    });

    if (response && response.code) {
      this.eventBus.dispatchEvent('receive-in-app-code', {
        code: response.code,
      });
    }

    return response;
  }

  public async getInboxMessages(count: number = 0): Promise<IMapResponse['getInboxMessages']> {
    const params = await this.getRequestParams();

    const lastCode = await this.data.getInboxLastRequestCode();
    const lastRequestTime = await this.data.getInboxLastRequestTime();

    return this.apiClient.getInboxMessages({
      ...params,
      count,
      last_code: lastCode,
      last_request_time: lastRequestTime,
    });
  }

  public async inboxStatus(order: string, status: number): Promise<IMapResponse['inboxStatus']> {
    const params = await this.getRequestParams();

    return this.apiClient.inboxStatus({
      ...params,
      inbox_code: order,
      status,
      time: (new Date()).getTime(),
    });
  }

  public async pageVisit(config: { title: string; url_path: string; url: string }): Promise<IMapResponse['pageVisit']> {
    const params = await this.getRequestParams();
    const features = await this.data.getFeatures();

    const url = features && features.page_visit && features.page_visit.entrypoint;

    if (!url) {
      return;
    }

    return this.apiClient.pageVisit({
      ...params,
      ...config,
    }, url);
  }

  public async setPurchase(attributes: SetPurchaseAttributes): Promise<IMapResponse['setPurchase']> {
    const params = await this.getRequestParams();

    return this.apiClient.setPurchase({
      ...params,
      ...attributes,
    });
  }

  public async getParams() {
    const applicationCode = await this.data.getApplicationCode();
    const hwid = await this.data.getHwid();
    const apiParams = await this.data.getTokens();
    const initParams = await this.data.getInitParams();

    return {
      applicationCode,
      hwid,
      ...apiParams,
      ...initParams,
    };
  }

  private async getRequestParams(): Promise<IRequest> {
    const applicationCode = await this.data.getApplicationCode();
    const hwid = await this.data.getHwid();
    const userId = await this.data.getUserId();
    const deviceType = await this.data.getDeviceType();
    const deviceModel = await this.data.getDeviceModel();
    const language = await this.data.getLanguage();
    const version = await this.data.getSdkVersion();

    const timezone = -(new Date()).getTimezoneOffset() * 60;

    return {
      application: applicationCode,
      hwid: hwid,

      userId: userId || hwid,
      device_type: deviceType,
      device_model: deviceModel,
      timezone: timezone,
      language: language,
      v: version,
    };
  };
}
