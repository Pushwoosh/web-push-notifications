type PushwooshApiResponce = {
  status_code: number,
  status_message: string,
  response?: any
}

type TPWPermission = 'denied' | 'granted' | 'prompt';

interface IPWDriverAPIParams {
  hwid: string;
  pushToken: string;
  publicKey?: string;
  authToken?: string;
}

interface TPWAPIParams extends IPWDriverAPIParams {
  applicationCode: string;
  deviceType: number;
  deviceModel: string;
  language: string;
  userId?: string;
}

interface PushManager {
  permissionState(options: PushSubscriptionOptions): Promise<TPWPermission>
}

interface IPWDriver {
  getPermission(): Promise<TPWPermission>;
  isSubscribed(): Promise<boolean>;
  askSubscribe(): Promise<any>;
  getAPIParams(): Promise<IPWDriverAPIParams>;
  onApiReady?(api: any): void;
}

interface ServiceWorkerRegistration {
  showNotification(a: any, b: any): Promise<any>;
}

interface IInitParams  {
  applicationCode: string;
  safariWebsitePushID?: string;
  autoSubscribe?: boolean;
  pushwooshUrl?: string;
  logLevel?: string;
  userId?: string;
  tags?: {[key: string]: any};
  driversSettings?: {
    worker?: {
      serviceWorkerUrl?: string;
      applicationServerPublicKey?: string;
    }
  };
}

interface IInitParamsWithDefaults extends IInitParams {
  autoSubscribe: boolean;
  pushwooshUrl: string;
  deviceType: number;
  tags: {
    Language: string,
    'Device Model': string,
    [key: string]: any
  };
  driversSettings: {
    worker: {
      serviceWorkerUrl: string;
      applicationServerPublicKey?: string;
    }
  };
}

type TPWCanWaitCallback = (f: any) => Promise<any> | any;

interface IWorkerPushwooshGlobal {
  push(listener: ['onPush', TPWCanWaitCallback]): void;
  getListeners(eventName: string): TPWCanWaitCallback[];
  api: any;
  initApi: any;
}

interface Window {
  Pushwoosh: IWorkerPushwooshGlobal;
}
interface PushMessageData {
  json(): any;
  text(): string;
}

interface PushEvent extends ExtendableEvent {
  data: PushMessageData
}
