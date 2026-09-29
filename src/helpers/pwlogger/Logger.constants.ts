import {
  type TLoggerLevelSilent,
  type TLoggerLevelFatal,
  type TLoggerLevelError,
  type TLoggerLevelWarn,
  type TLoggerLevelInfo,
  type TLoggerLevelDebug,
} from './Logger.types';

export const LOGGER_LEVEL_SILENT: TLoggerLevelSilent = 'silent';
export const LOGGER_LEVEL_FATAL: TLoggerLevelFatal = 'fatal';
export const LOGGER_LEVEL_ERROR: TLoggerLevelError = 'error';
export const LOGGER_LEVEL_WARN: TLoggerLevelWarn = 'warn';
export const LOGGER_LEVEL_INFO: TLoggerLevelInfo = 'info';
export const LOGGER_LEVEL_DEBUG: TLoggerLevelDebug = 'debug';

export const LOGGER_LEVEL_VALUE_SILENT = 0;
export const LOGGER_LEVEL_VALUE_FATAL = 10;
export const LOGGER_LEVEL_VALUE_ERROR = 20;
export const LOGGER_LEVEL_VALUE_WARN = 30;
export const LOGGER_LEVEL_VALUE_INFO = 40;
export const LOGGER_LEVEL_VALUE_DEBUG = 50;

export const loggerRelationsMap = {
  [LOGGER_LEVEL_SILENT]: LOGGER_LEVEL_VALUE_SILENT,
  [LOGGER_LEVEL_FATAL]: LOGGER_LEVEL_VALUE_FATAL,
  [LOGGER_LEVEL_ERROR]: LOGGER_LEVEL_VALUE_ERROR,
  [LOGGER_LEVEL_WARN]: LOGGER_LEVEL_VALUE_WARN,
  [LOGGER_LEVEL_INFO]: LOGGER_LEVEL_VALUE_INFO,
  [LOGGER_LEVEL_DEBUG]: LOGGER_LEVEL_VALUE_DEBUG,
};
