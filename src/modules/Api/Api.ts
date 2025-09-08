import {
  type SetPurchaseAttributes,
  type MultiRegisterDeviceRequest,
  type PushDevice,
  type WebPushPlatformData,
} from './Api.types';
import * as CONSTANTS from '../../core/constants';
import { type EventBus } from '../../core/modules/EventBus';
import { ApiClient } from '../ApiClient/ApiClient';
import {
  type IMapResponse,
  type IRequest,
} from '../ApiClient/ApiClient.types';
import { Data } from '../Data/Data';
import { type TPlatform } from '../PlatformChecker/PlatformChecker.types';

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
      return Promise.reject(new Error('Communication is disabled'));
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

  public async registerUser(userId: string | number, isManual = true): Promise<IMapResponse['registerUser']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject(new Error('Communication is disabled'));
    }
    const {
      hwid,
      device_type: _device_type,
      ...params
    } = await this.getRequestParams();
    const deviceType = await this.data.getDeviceType();

    const id = `${userId}`;

    // register user in pushwoosh
    const response = await this.apiClient.registerUser({
      ...params,
      hwid,
      userId: id,
      ts_offset: -(new Date()).getTimezoneOffset() * 60,
      device_type: deviceType,
    });

    // set user id to database
    await this.data.setUserId(id);

    // set info to database that user id was change
    if (isManual) {
      await this.data.setStatusUserIdWasChanged(true);
    }

    return response;
  }

  public async registerEmail(email: string, isManual = true): Promise<IMapResponse['registerEmail']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject(new Error('Communication is disabled'));
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return Promise.reject(new Error('Invalid Email format'));
    }
    const {
      hwid: _hwid,
      device_type: _device_type,
      ...requestParams
    } = await this.getRequestParams();

    // register user email in pushwoosh
    const response = await this.apiClient.registerEmail({
      ...requestParams,
      email,
      ts_offset: -(new Date()).getTimezoneOffset() * 60,
    });

    // set user email to database
    await this.data.setEmail(email);

    // set info to database that user email was change
    if (isManual) {
      await this.data.setStatusEmailWasChanged(true);
    }

    return response;
  }

  public async registerSmsNumber(number: string, isManual = true): Promise<IMapResponse['registerSmsNumber']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject(new Error('Communication is disabled'));
    }
    if (!/^\+?[0-9]+$/.test(number)) {
      return Promise.reject(new Error('Invalid Phone number format: +1234567890'));
    }
    const { application, userId } = await this.getRequestParams();

    const response = await this.apiClient.registerDevice({
      application,
      userId,
      hwid: number,
      device_type: 18,
    });

    await this.data.setSmsNumber(number);

    if (isManual) {
      await this.data.setStatusSmsNumberWasChanged(true);
    }

    return response;
  }

  public async registerWhatsappNumber(number: string, isManual = true): Promise<IMapResponse['registerWhatsappNumber']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject(new Error('Communication is disabled'));
    }
    if (!/^whatsapp:\+?[0-9]+$/.test(number)) {
      return Promise.reject(new Error('Invalid WhatsApp number format: whatsapp:+1234567890'));
    }
    const { application, userId } = await this.getRequestParams();

    const response = await this.apiClient.registerDevice({
      application,
      userId,
      hwid: number,
      device_type: 21,
    });

    await this.data.setWhatsAppNumber(number);

    if (isManual) {
      await this.data.setStatusWhatsAppNumberWasChanged(true);
    }

    return response;
  }

  public async postEvent(event: string, attributes: { [key: string]: any }): Promise<IMapResponse['postEvent']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject(new Error('Communication is disabled'));
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
        return Promise.reject(new Error('attribute msgHash already defined'));
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

  public async multiRegisterDevice(request: Partial<MultiRegisterDeviceRequest>): Promise<IMapResponse['multiRegisterDevice']> {
    if (this.getIsCommunicationDisabled()) {
      return Promise.reject(new Error('Communication is disabled'));
    }

    const applicationCode = await this.data.getApplicationCode();
    const deviceModel = await this.data.getDeviceModel();
    const deviceType = await this.data.getDeviceType();
    const language = await this.data.getLanguage();
    const version = await this.data.getSdkVersion();
    const tokens = await this.data.getTokens();
    const hwid = await this.data.getHwid();

    const fullRequest: MultiRegisterDeviceRequest = {
      application: applicationCode,
      ...request,
    };

    if (request.user_id) {
      fullRequest.user_id = String(request.user_id);
      const currentUserId = await this.data.getUserId();
      if (currentUserId !== fullRequest.user_id) {
        await this.data.setUserId(fullRequest.user_id);
        await this.data.setStatusUserIdWasChanged(true);
      }
    }

    if (request.email) {
      if (!/^\S+@\S+\.\S+$/.test(request.email)) {
        return Promise.reject(new Error('Invalid Email format'));
      }
      const currentEmail = await this.data.getEmail();
      if (currentEmail !== request.email) {
        await this.data.setEmail(request.email);
        await this.data.setStatusEmailWasChanged(true);
      }
    }

    if (request.sms_phone_number) {
      if (!/^\+?[0-9]+$/.test(request.sms_phone_number)) {
        return Promise.reject(new Error('Invalid Phone number format: +1234567890'));
      }
      const currentSmsNumber = await this.data.getSmsNumber();
      if (currentSmsNumber !== request.sms_phone_number) {
        await this.data.setSmsNumber(request.sms_phone_number);
        await this.data.setStatusSmsNumberWasChanged(true);
      }
    }

    if (request.whatsapp_phone_number) {
      if (!/^whatsapp:\+?[0-9]+$/.test(request.whatsapp_phone_number)) {
        return Promise.reject(new Error('Invalid WhatsApp number format: whatsapp:+1234567890'));
      }
      const currentWhatsAppNumber = await this.data.getWhatsAppNumber();
      if (currentWhatsAppNumber !== request.whatsapp_phone_number) {
        await this.data.setWhatsAppNumber(request.whatsapp_phone_number);
        await this.data.setStatusWhatsAppNumberWasChanged(true);
      }
    }

    if (fullRequest.language) {
      await this.data.setLanguage(fullRequest.language);
    } else {
      fullRequest.language = language;
    }

    if (!fullRequest.timezone) {
      const timezone = -(new Date()).getTimezoneOffset() * 60;
      fullRequest.timezone = String(timezone);
    }

    if (!fullRequest.push_devices && tokens.pushToken) {
      const pushDevice: PushDevice = {
        hwid: hwid,
        platform: deviceType as TPlatform,
        push_token: tokens.pushToken,
        sdk_version: version,
      };

      if (tokens.publicKey || tokens.authToken || deviceModel) {
        const webPushData: WebPushPlatformData = {};
        if (tokens.publicKey) webPushData.public_key = tokens.publicKey;
        if (tokens.authToken) webPushData.auth_token = tokens.authToken;
        if (deviceModel) webPushData.browser = deviceModel;
        pushDevice.platformData = webPushData;
      }

      fullRequest.push_devices = [pushDevice];
    }

    const response = await this.apiClient.multiRegisterDevice(fullRequest);

    if (fullRequest.push_devices?.length) {
      await this.data.setStatusManualUnsubscribed(false);
      localStorage.setItem(CONSTANTS.KEY_DEVICE_REGISTRATION_STATUS, CONSTANTS.DEVICE_REGISTRATION_STATUS_REGISTERED);
      this.eventBus.dispatchEvent('register', {});
    }

    return response;
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
