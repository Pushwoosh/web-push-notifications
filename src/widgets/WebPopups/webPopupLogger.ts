import { type WebPopupLogger } from '@pushwoosh/websdk-common/web-popups';

import { WEB_POPUPS_LOG_PREFIX } from './constants';
import { Logger } from '../../core/logger';

// Logger has no warn level; error keeps the renderer's reasons visible at the default log level.
export const webPopupLogger: WebPopupLogger = {
  warn: (message) => Logger.error(WEB_POPUPS_LOG_PREFIX, message),
};
