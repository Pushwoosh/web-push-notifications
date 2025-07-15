import {
  type ILoggerMessage,
  type TLoggerOutputLevels,
} from './../../Logger';

export function handlerConsole(message: ILoggerMessage) {
  const {
    code,
    text,
    type,
  } = message;

  const log = getOutputFunction(type);
  // tslint:disable-next-line
  console.groupCollapsed(type);

  if (code) {
    log(`${code}: ${text}`);
  } else {
    log(text);
  }

  // tslint:disable-next-line
  console.groupEnd();
}

function getOutputFunction(type: TLoggerOutputLevels): (text: string) => void {
  switch (type) {
    case 'fatal':
    case 'error':
      // tslint:disable-next-line
      return console.error;

    case 'warn':
    case 'info':
    case 'debug':
      // tslint:disable-next-line
      return console.log;
  }
}
