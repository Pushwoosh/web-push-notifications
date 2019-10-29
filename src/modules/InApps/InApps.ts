import ApiClient from '../api/ApiClient';
import Logger from '../../logger';
import API from '../../API';
import {keyValue} from '../../storage';
import {CommandBus, TCommands} from '../CommandBus/CommandBus';
import {EventBus, TEvents} from '../EventBus/EventBus';
import {Connector} from '../Connector/Connector';
import {Modal} from '../Modal/Modal';
import {RichMedia} from '../RichMedia/RichMedia';
import {ExpanderPushManager, ExpanderPushwoosh, ExpanderPushwooshSendMessage} from './expanders/expanders';

import {CHANNELS} from '../../constants';

import {IInAppsOptions} from './InApps.types';


export class InApps {
  private readonly options: IInAppsOptions;
  private commandBus: CommandBus;
  private eventBus: EventBus;
  private connector: Connector;
  private readonly api: ApiClient;
  private readonly store: typeof keyValue;
  private readonly PW: API;
  private delayInApps: string[] = [];
  public isLoadedInAppsList: boolean = false;
  public inApps: IInApp[];
  public modal: Modal;

  constructor(options: IInAppsOptions, PW: API, api = new ApiClient(), store = keyValue) {
    this.options = options;
    this.api = api;
    this.store = store;
    this.PW = PW;
    this.modal = new Modal(this.options && this.options.modal ? this.options.modal : {});

    this.connector = new Connector();
    this.commandBus = CommandBus.getInstance();
    this.eventBus = EventBus.getInstance();

    this.init()
      .then(() => {
        Logger.write('info', 'InApps module has been initialized');

        this.eventBus.emit(TEvents.INIT_IN_APPS_MODULE);
      })
      .catch((error) => {
        Logger.write('error', 'InApps module initialization has been failed', error);
      });
  }

  private async init(): Promise<void> {
    this.subscribeToReceiveMessageFromIFrame();

    // when we send postEvent in response
    // we can receive in-app code to be show
    this.commandBus.on(TCommands.SHOW_IN_APP, ({ code }) => {
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

    this.inApps = inApps;
  }

  private subscribeToReceiveMessageFromIFrame() {
    window.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data && typeof data === 'object') {
          this.onReceiveNewMessageFromIFrame(data);
        }
      } catch (e) {
        // nothing...
      }
    });
  }

  private onReceiveNewMessageFromIFrame(message: any) {
    switch (message.method) {
      case 'subscribe':
        this.connector.subscribe()
          .then(() => {
            this.commandBus.emit(TCommands.POST_MESSAGE_TO_IFRAME, {
              code: message.code
            })
          });
        break;
      case 'unsubscribe':
        this.connector.unsubscribe()
          .then(() => {
            this.commandBus.emit(TCommands.POST_MESSAGE_TO_IFRAME, {
              code: message.code
            })
          });
        break;
      case 'getTags':
        this.connector.getTags()
          .then((tags) => {
            this.commandBus.emit(TCommands.POST_MESSAGE_TO_IFRAME, {
              code: message.code,
              tags: {
                ...tags,
                PWChannels: ['Sport news']
              },
            })
          });
        break;
      case 'setTags':
        this.connector.setTags(message.options.tags)
          .then(() => {
            this.commandBus.emit(TCommands.POST_MESSAGE_TO_IFRAME, {
              code: message.code
            })
          });
        break;
      case 'getChannels':
        keyValue.get('CHANNELS')
          .then((channels: unknown[]) => {
            this.commandBus.emit(TCommands.POST_MESSAGE_TO_IFRAME, {
              code: message.code,
              channels
            });
          });

        break;
      case 'checkSubscription':
        this.connector.checkIsSubscribed()
          .then((state) => {
            this.commandBus.emit(TCommands.POST_MESSAGE_TO_IFRAME, {
              code: message.code,
              state,
            })
          });
        break;
      case 'checkManualUnsubscribed':
        this.connector.checkIsManualUnsubscribed()
          .then((state) => {
            this.commandBus.emit(TCommands.POST_MESSAGE_TO_IFRAME, {
              code: message.code,
              state,
            })
          });
        break;
      case 'openLink':
        window.open(message.href, '_blank');
        break;
      case 'closeInApp':
        this.commandBus.emit(TCommands.CLOSE_IN_APP);
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
      this.PW,
      [ExpanderPushwooshSendMessage, ExpanderPushwoosh, ExpanderPushManager]
    ).getContent();

    await this.modal.setContent(inAppContent);

    this.modal
      .removeLoading()
      .showContent();
  }

  public async getList(): Promise<IGetInAppsResponse> {
    const {
      INIT_PARAMS: {
        deviceType,
        tags: {
          Language: language,
          'Device Model': deviceModel,
        }
      },
      'params.applicationCode': applicationCode,
      'params.hwid': hwid,
      'params.userId': userId,
    } = await keyValue.getAll();

    return this.api.getInApps({
      application: applicationCode,
      hwid: hwid,
      device_type: deviceType,
      v: deviceModel,
      language: language,
      userId: userId || hwid,
    });
  }
}
