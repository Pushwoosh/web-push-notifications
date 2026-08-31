import {
  type WebPopupChoiceSubmitHandler, type WebPopupRatingSubmitHandler,
} from 'smart-blocks-utils';

import { Logger } from '../../core/logger';
import { type Pushwoosh } from '../../core/Pushwoosh';

// The host side of the two submitting phase-2 slots: a choice becomes device
// TAGS, a rating an EVENT. Both reject on failure, like the subscription form.

// A choice slot's picks appended to a LIST tag — additive by design: the slot
// resets its selection on every show, so it cannot express an un-pick.
export function createChoiceSubmitHandler(pw: Pushwoosh): WebPopupChoiceSubmitHandler {
  return async ({ slotKey, tagName, values }) => {
    try {
      // String operation + `value` is setTags' shape; the numeric TagValue in
      // Api.types.ts belongs to multiRegisterDevice and no-ops here.
      await pw.api.setTags({ [tagName]: { operation: 'append', value: values } }); // also writes EMAIL tags when the visitor has one
    } catch (error) {
      Logger.error(error, `Failed to write web popup choice "${slotKey}" to tag "${tagName}"`);
      throw error;
    }
  };
}

// The score as an event, scale alongside (4 of 5 stars is not 4 of 10 NPS). An
// in-app configured for this event can open over the popup; that's normal.
export function createRatingSubmitHandler(pw: Pushwoosh): WebPopupRatingSubmitHandler {
  return async ({ slotKey, eventName, score, scale }) => {
    try {
      await pw.api.postEvent(eventName, { score, scale, slotKey });
    } catch (error) {
      Logger.error(error, `Failed to post web popup rating "${slotKey}" as event "${eventName}"`);
      throw error;
    }
  };
}
