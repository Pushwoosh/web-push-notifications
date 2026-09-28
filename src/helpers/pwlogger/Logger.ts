import {
  loggerRelationsMap,
  LOGGER_LEVEL_FATAL,
  LOGGER_LEVEL_ERROR,
  LOGGER_LEVEL_WARN,
  LOGGER_LEVEL_INFO,
  LOGGER_LEVEL_DEBUG, LOGGER_LEVEL_SILENT,
} from './Logger.constants';
import {
  type ILoggerConfig,
  type TLoggerLevels,
  type TLoggerApplicationType,
  type ILoggerLogOptions,
  type ILoggerLogParams,
  type ILoggerMessage,
  type TLoggerHandler,
  type ILoggerSubscriber,
  type TLoggerOutputLevels,
  type TReject,
} from './Logger.types';

export * from './Logger.types';
export * from './Logger.constants';

export class Logger {
  public readonly relations: typeof loggerRelationsMap = loggerRelationsMap;
  public applicationType: TLoggerApplicationType;
  public level: TLoggerLevels;
  public readonly subscribers: ILoggerSubscriber[];

  public applicationCode: string | undefined;
  public domain: string | undefined;
  public deviceInfo: { [key: string]: any } | undefined;

  constructor(config?: ILoggerConfig) {
    this.level = config && typeof (config.level) !== 'undefined' ? config.level : LOGGER_LEVEL_ERROR;
    this.applicationType = config && typeof (config.applicationType) !== 'undefined' ? config.applicationType : 'sdk';
    this.subscribers = config && typeof (config.subscribers) !== 'undefined' ? config.subscribers : [];
  }

  public updateLogLevel(level: TLoggerLevels): void {
    this.level = level;
  }

  public updateApplicationType(applicationType: TLoggerApplicationType): void {
    this.applicationType = applicationType;
  }

  public updateApplicationCode(applicationCode: string): void {
    this.applicationCode = applicationCode;
  }

  public updateDomain(domain: string): void {
    this.domain = domain;
  }

  public updateDeviceInfo(deviceInfo: { [key: string]: any }): void {
    this.deviceInfo = deviceInfo;
  }

  public subscribe(level: TLoggerOutputLevels, handler: TLoggerHandler) {
    this.subscribers.push({
      handler,
      level,
    });
  }

  public async log(params: ILoggerLogParams): Promise<void> {
    const actions: Array<Promise<void> | void> = [];
    const {
      options,
      ...other
    } = params;

    let data = other;

    if (options) {
      const {
        handler: _handler,
        ...additionalData
      } = options;

      data = {
        ...other,
        ...additionalData,
      };
    }
    const message = this.getMessage(data);

    this.subscribers.forEach((subscriber) => {
      if (subscriber.level === params.type && this.relations[subscriber.level] <= this.relations[this.level]) {
        actions.push(subscriber.handler.call(null, message));
      }
    });

    if (options && options.handler && this.level !== LOGGER_LEVEL_SILENT) {
      options.handler.call(null, message);
    }

    await Promise.all(actions);
    return;
  }

  public async debug(text: string, options?: ILoggerLogOptions): Promise<void> {
    return this.log({
      type: LOGGER_LEVEL_DEBUG,
      text,
      options,
    });
  }

  public async info(text: string, options?: ILoggerLogOptions): Promise<void> {
    return this.log({
      type: LOGGER_LEVEL_INFO,
      text,
      options,
    });
  }

  public async warn(text: string, code?: string, options?: ILoggerLogOptions): Promise<void> {
    return this.log({
      type: LOGGER_LEVEL_WARN,
      text,
      code,
      options,
    });
  }

  public async error(text: string, code?: string, options?: ILoggerLogOptions): Promise<void> {
    return this.log({
      type: LOGGER_LEVEL_ERROR,
      text,
      code,
      options,
    });
  }

  public async fatal(text: string, code?: string, options?: ILoggerLogOptions): Promise<void> {
    return this.log({
      type: LOGGER_LEVEL_FATAL,
      text,
      code,
      options,
    });
  }

  public async errorAndThrow(text: string, code?: string, options?: ILoggerLogOptions): Promise<void> {
    return this.logAndThrow({
      type: LOGGER_LEVEL_ERROR,
      text,
      code,
      options,
    });
  }

  public async errorAndReject(cb: TReject, text: string, code?: string, options?: ILoggerLogOptions): Promise<void> {
    return this.logAndReject(cb, {
      type: LOGGER_LEVEL_ERROR,
      text,
      code,
      options,
    });
  }

  public async fatalAndThrow(text: string, code?: string, options?: ILoggerLogOptions): Promise<void> {
    return this.logAndThrow({
      type: LOGGER_LEVEL_FATAL,
      text,
      code,
      options,
    });
  }

  public async fatalAndReject(cb: TReject, text: string, code?: string, options?: ILoggerLogOptions): Promise<void> {
    return this.logAndReject(cb, {
      type: LOGGER_LEVEL_FATAL,
      text,
      code,
      options,
    });
  }

  private async logAndThrow(params: ILoggerLogParams): Promise<void> {
    await this.log(params);

    const error = new Error(params.text);

    if (params.code) {
      // @ts-ignore
      error.code = params.code;
    }

    throw error;
  }

  private async logAndReject(reject: TReject, params: ILoggerLogParams): Promise<void> {
    await this.log(params);

    const error = new Error(params.text);

    if (params.code) {
      // @ts-ignore
      error.code = params.code;
    }

    reject(error);
  }

  private getMessage(params: ILoggerLogParams): ILoggerMessage {
    return {
      applicationCode: this.applicationCode,
      domain: this.domain,
      applicationType: this.applicationType,
      deviceInfo: this.deviceInfo,
      ...params,
    };
  }
}
