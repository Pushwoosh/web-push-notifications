import {log as logStorage} from './storage';
import {patchConsole} from "./functions";

type TWriteType = 'error' | 'apirequest' | 'info';

const levels: {[key: string]: number} = {
  error: 1,
  info: 2,
  debug: 3
};

let numLevel = 3;

patchConsole();

interface ILogger {
  setLevel(level: string): void;
  error(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
  write(type: TWriteType, message: any, additional?: any): Promise<void>;
  [key: string]: any;
}

const Logger: ILogger = {
  setLevel(level) {
    if (!levels[level]) {
      level = 'error';
    }
    numLevel = levels[level];
  },
  write(type: TWriteType, message: any, additional?: any) {
    if (type === 'error') {
      this.error(message);
    }
    else {
      this.info(message);
    }
    return logStorage.add(type, message, additional);
  }
} as ILogger;

Object.keys(levels).forEach((k: string) => {
  const n = levels[k];
  Logger[k] = (...args: any[]) => {
    if (n <= numLevel) {
      console.info(k, ...args);
      console.trace('trace');
    }
  };
});

export function logAndThrowError(error: string) {
  const logText = new Error(error);
  Logger.write('error', logText, 'logAndThrowError');
  throw logText;
}

export function logAndRejectError(error: string, reject: (e: any) => void) {
  const logText = new Error(error);
  Logger.write('error', logText, 'logAndRejectError');
  reject(logText);
}

export default Logger;
