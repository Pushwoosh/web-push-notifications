import {
  type IInboxMessageSlide,
  type IInboxSlideRaw,
  type IInboxUserData,
  type TInboxLayout,
} from './InboxCell.types';
import { type IInboxMessageActionParams } from './InboxMessages.types';
import { isSafeAbsoluteUrl } from '../helpers/url';

// Cap of the sending pipeline (`maxInboxCarouselSlides`) and of the editor.
// The rpc-v2 proto comment promising ten is wrong.
export const MAX_CAROUSEL_SLIDES = 5;

/** Layouts we can draw; anything else falls back to the heuristic. */
export const KNOWN_LAYOUTS: ReadonlyArray<TInboxLayout> = ['classic', 'captioned', 'banner', 'carousel'];

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

/** Slides we can draw: the ones with an image, at most {@link MAX_CAROUSEL_SLIDES}. */
export function getValidSlides(userData: IInboxUserData): Array<IInboxMessageSlide> {
  const slides: Array<IInboxSlideRaw> = Array.isArray(userData.carousel) ? userData.carousel : [];

  return slides
    .filter((slide) => !!slide && !!slide.image)
    .slice(0, MAX_CAROUSEL_SLIDES)
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

// Ported from `resolveInboxLayout` in dumb-components, so a cell draws here as
// the control panel preview promised. Unrenderable layouts degrade to classic.
export function resolveInboxLayout(options: {
  displayType?: string;
  hasTitle: boolean;
  hasBody: boolean;
  /** Hero available to draw, avatar fallback included. Decides degradation. */
  heroUrl: string;
  /** The campaign's own banner, `action_params.b`. Only this may trigger the heuristic. */
  bannerUrl: string;
  slidesCount: number;
}): TInboxLayout {
  const { hasTitle, hasBody, heroUrl, bannerUrl, slidesCount } = options;

  let requested = <TInboxLayout>options.displayType;

  if (KNOWN_LAYOUTS.indexOf(requested) === -1) {
    // Narrower than dumb-components on purpose: an icon must not count as a
    // hero here, or every legacy message would flip to captioned.
    if (bannerUrl && !hasTitle) {
      requested = 'banner';
    } else if (bannerUrl && hasTitle && hasBody) {
      requested = 'captioned';
    } else {
      requested = 'classic';
    }
  }

  switch (requested) {
    case 'banner':
      return heroUrl ? 'banner' : 'classic';
    case 'captioned':
      return heroUrl && hasTitle && hasBody ? 'captioned' : 'classic';
    case 'carousel':
      return hasTitle && hasBody && slidesCount > 0 ? 'carousel' : 'classic';
    default:
      return 'classic';
  }
}

/** The colored initial a classic cell shows when the campaign sent no icon. */
export function getIconInitial(title: string, body: string): string {
  return (title || body || '?').trim().charAt(0).toUpperCase() || '?';
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
