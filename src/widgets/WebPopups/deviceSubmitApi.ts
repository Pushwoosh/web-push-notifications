import {
  type WebPopupChoiceSubmitHandler, type WebPopupRatingSubmitHandler,
  type WebPopupSubscribeResult,
} from 'smart-blocks-utils';

import { Logger } from '../../core/logger';
import { type Pushwoosh } from '../../core/Pushwoosh';

// The host side of the slots that talk to the device API: a choice becomes
// TAGS, a rating an EVENT, a subscribe button the permission prompt.

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

// A `subscribe`-action button. Kept synchronous up to pw.subscribe(): Firefox
// only honours a permission request inside the click's own task.
export function createSubscribeHandler(pw: Pushwoosh): () => Promise<WebPopupSubscribeResult> {
  return async () => {
    try {
      await pw.subscribe();
    } catch (error) {
      Logger.error(error, 'Failed to subscribe from a web popup');
    }

    // The permission is the answer either way: a failed registration after a
    // granted prompt must not read to the popup as a refusal.
    return (pw.driver?.getPermission() ?? 'default') as WebPopupSubscribeResult;
  };
}
