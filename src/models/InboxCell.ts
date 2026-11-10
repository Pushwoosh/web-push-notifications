import { INBOX_MAX_CAROUSEL_SLIDES } from '@pushwoosh/websdk-common/inbox';

import {
  type IInboxMessageSlide,
  type IInboxSlideRaw,
  type IInboxUserData,
} from './InboxCell.types';
import { type IInboxMessageActionParams } from './InboxMessages.types';
import { isSafeAbsoluteUrl } from '../helpers/url';

// An object from `getInboxMessages`, a JSON string on the push path; both
// forms are accepted, as in the iOS SDK.
export function parseUserData(actionParams: IInboxMessageActionParams): IInboxUserData {
  const userData = actionParams?.u;

  if (!userData) {
    return {};
  }

  if (typeof userData === 'string') {
    try {
      return JSON.parse(userData) || {};
    } catch {
      return {};
    }
  }

  return typeof userData === 'object' ? <IInboxUserData>userData : {};
}

/** Slides we can draw: the ones with an image, at most {@link INBOX_MAX_CAROUSEL_SLIDES}. */
export function getValidSlides(userData: IInboxUserData): Array<IInboxMessageSlide> {
  const slides: Array<IInboxSlideRaw> = Array.isArray(userData.carousel) ? userData.carousel : [];

  return slides
    .filter((slide) => !!slide && !!slide.image)
    .slice(0, INBOX_MAX_CAROUSEL_SLIDES)
    .map((slide) => ({
      imageUrl: <string>slide.image,
      caption: slide.title || '',
      // Needs a scheme, as in the iOS SDK, and a scheme that is not script:
      // the widget assigns this straight to `location.href` on a tap.
      link: slide.url && isSafeAbsoluteUrl(slide.url) ? slide.url : '',
    }));
}

// Hero of the banner and captioned layouts. `b` is the campaign's `bannerUrl`
// and the only hero source for web; the avatar stands in when none was sent.
export function getHeroUrl(
  actionParams: IInboxMessageActionParams,
  userData: IInboxUserData,
  messageImage: string,
): string {
  return actionParams?.b || messageImage || userData.image || '';
}

/** Small round avatar of a cell: the message image, or the one inside `u`. */
export function getIconUrl(userData: IInboxUserData, messageImage: string): string {
  return messageImage || userData.image || '';
}

// The pipeline merges `customData` flat into `u`, so the contract keys are the
// only ones to strip.
export function getCustomData(userData: IInboxUserData): Record<string, unknown> {
  const contractKeys = ['displayType', 'carousel', 'image'];

  return Object.keys(userData)
    .filter((key) => contractKeys.indexOf(key) === -1)
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = userData[key];

      return acc;
    }, {});
}
