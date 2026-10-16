export type TLoggerLevelSilent = 'silent';
export type TLoggerLevelFatal = 'fatal';
export type TLoggerLevelError = 'error';
export type TLoggerLevelWarn = 'warn';
export type TLoggerLevelInfo = 'info';
export type TLoggerLevelDebug = 'debug';

export type TLoggerFromSDK = 'sdk';
export type TLoggerFromCP = 'cp';

export type TLoggerApplicationType =
  | TLoggerFromSDK
  | TLoggerFromCP;

export type TLoggerOutputLevels =
  | TLoggerLevelFatal
  | TLoggerLevelError
  | TLoggerLevelWarn
  | TLoggerLevelInfo
  | TLoggerLevelDebug;

export type TLoggerLevels =
  | TLoggerLevelSilent
  | TLoggerOutputLevels;

export interface ILoggerLogOptions {
  handler?: TLoggerHandler;
  [key: string]: any;
}

export interface ILoggerLogParams {
  type: TLoggerOutputLevels;
  text: string;
  code?: string | number;
  options?: ILoggerLogOptions;
}

export type TLoggerHandler = (message: ILoggerMessage) => void | Promise<void>;

export interface ILoggerSubscriber {
  handler: TLoggerHandler;
  level: TLoggerOutputLevels;
}

export interface ILoggerMessage {
  type: TLoggerOutputLevels;
  text: string;
  applicationType: TLoggerApplicationType;

  code?: string | number;
  applicationCode?: string;
  domain?: string;
  deviceInfo?: {
    [key: string]: any;
  };

  [key: string]: any;
}

export interface ILoggerConfig {
  level?: TLoggerLevels;
  applicationType?: TLoggerApplicationType;
  subscribers?: ILoggerSubscriber[];
}

export type TReject = (reason: Error) => void;
