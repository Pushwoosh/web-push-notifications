import { EventBus } from '../../core/modules/EventBus';

import { Api } from '../Api/Api';
import {Modal} from '../Modal/Modal';
import {RichMedia} from '../RichMedia/RichMedia';
import {ExpanderPushManager, ExpanderPushwoosh, ExpanderPushwooshSendMessage} from './expanders/expanders';

import { Data } from '../Data/Data';

import {IInAppsOptions} from './InApps.types';


export class InApps {
  private readonly pw: any;
  private readonly options: IInAppsOptions;
  private eventBus: EventBus;
  private readonly api: Api;
  private readonly data: Data;
  private delayInApps: string[] = [];
  public isLoadedInAppsList: boolean = false;
  public inApps: IInApp[];
  public modal: Modal;


  constructor(options: IInAppsOptions, pw: any, eventBus: EventBus, api: Api) {
    this.pw = pw;
    this.options = options;
    this.eventBus = eventBus;
    this.api = api;
    this.modal = new Modal(this.options && this.options.modal ? this.options.modal : {});

    this.data = new Data();
  }

  public async init(): Promise<void> {
    this.subscribeToReceiveMessageFromIFrame();

    // when we send postEvent in response
    // we can receive in-app code to be show
    this.eventBus.addEventHandler('receive-in-app-code', ({ code }) => {
      // if is not loaded in app list
      // we delay the show
      if (!this.isLoadedInAppsList) {
        this.delayInApps.push(code);

        return;
      }

      this.showInApp(code);
    });

    const { inApps } = await this.getList();

    if(this.delayInApps.length) {
      this.delayInApps.forEach((code: string) => {
        this.showInApp(code);
      })
    }

    this.isLoadedInAppsList = true;

    await this.data.setInApps(inApps);

    this.inApps = inApps;
  }

  private subscribeToReceiveMessageFromIFrame() {
    window.addEventListener('message', (event) => {
      if (!event.source) {
        return;
      }

      if (event.source === window || 'parent' in event.source && event.source.parent === window) {
        try {
          const data = JSON.parse(event.data);

          if (data && typeof data === 'object') {
            this.onReceiveNewMessageFromIFrame(data);
          }
        } catch (e) {
          // nothing...
        }
      }
    });
  }

  private onReceiveNewMessageFromIFrame(message: any) {
    switch (message.method) {
      case 'subscribe':
        this.pw.subscribe()
          .then(() => {
            this.modal.postMessage({
              code: message.code,
            })
          });
        break;
      case 'unsubscribe':
        this.pw.unsubscribe()
          .then(() => {
            this.modal.postMessage({
              code: message.code,
            })
          });
        break;
      case 'getTags':
        this.pw.api.getTags()
          .then(({ result }: any) => {
            this.modal.postMessage({
              code: message.code,
              tags: result,
            })
          });
        break;
      case 'setTags':
        this.pw.api.setTags(message.options.tags)
          .then(() => {
            this.modal.postMessage({
              code: message.code,
            })
          });
        break;
      case 'getChannels':
        this.data.getFeatures()
          .then(({ channels }: { channels: unknown[] }) => {
            this.modal.postMessage({
              code: message.code,
              channels
            })
          });

        break;
      case 'checkSubscription':
        this.api.checkDeviceSubscribeForPushNotifications()
          .then((state) => {
            this.modal.postMessage({
              code: message.code,
              state
            })
          });
        break;
      case 'checkManualUnsubscribed':
        this.data.getStatusManualUnsubscribed()
          .then((state) => {
            this.modal.postMessage({
              code: message.code,
              state
            })
          });
        break;
      case 'closeInApp':
        this.modal.hide();
        break;
      case 'openLink':
        window.open(message.options.href, '_blank');
        break;
    }

  }

  public async showInApp(code: string) {
    const filteredRichMedia = this.inApps.filter((inApp) => inApp.code === code);

    if (filteredRichMedia.length !== 1) {
      throw new Error('Can\'t find Rich Media');
    }

    this.modal
      .setLoading()
      .show();

    const currentRichMedia = filteredRichMedia[0];
    const inAppContent = await new RichMedia(
      currentRichMedia.url,
      this.api,
      [ExpanderPushwooshSendMessage, ExpanderPushwoosh, ExpanderPushManager]
    ).getContent();

    await this.modal.setContent(inAppContent);

    this.modal
      .removeLoading()
      .showContent();
  }

  public async getList(): Promise<IGetInAppsResponse> {
    return this.api.getInApps();
  }
}
