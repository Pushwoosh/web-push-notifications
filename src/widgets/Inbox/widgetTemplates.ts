import { getMessageTime } from './helpers';
import { escape } from '../../helpers/escape';
import { getIconInitial } from '../../models/InboxCell';
import { type IInboxMessageSlide } from '../../models/InboxCell.types';
import { type IInboxMessagePublic } from '../../models/InboxMessages.types';

export const widgetTemplate = (title: string): string => `
<div class="pw-inbox__arrow"></div>
<div class="pw-inbox_inner">
    <div class="pw-inbox_title">
      ${title}
    </div>
    <ul class="pw-inbox_list">

    </ul>
</div>`;

export const widgetTemplateEmpty = (
  emptyInboxIconUrl: string,
  emptyInboxTitle: string,
  emptyInboxText: string,
) => `
<div class="pw-inbox__arrow"></div>
<div class="pw-inbox_list--empty">
    <div class="pw-inbox_list-icon">
      <img src="${emptyInboxIconUrl}" alt="${emptyInboxTitle}">
    </div>
    <div class="pw-inbox_list-title">
      ${emptyInboxTitle}
    </div>
    <div class="ipw-inbox_list-body">
      ${emptyInboxText}
    </div>
</div>`;

// Campaign content, unlike the config-driven templates above: every value is
// escaped because it reaches the page from the control panel.

/** Small round avatar, or the colored initial drawn when the campaign sent no icon. */
const avatarTemplate = ({ iconUrl, title, message }: IInboxMessagePublic): string => (
  iconUrl
    ? `<img src="${escape(iconUrl)}" alt="${escape(title || message)}" class="pw-inbox_message-image">`
    : `<span class="pw-inbox_icon-initial">${escape(getIconInitial(title, message))}</span>`
);

/** Title, body and date. Shared by every layout that draws text at all. */
const textsTemplate = ({ title, message, sendDate, isRead }: IInboxMessagePublic): string => `
<div class="pw-inbox_content">
  <div class="pw-inbox_item-title">
    ${escape(title)}${isRead ? '' : '<span class="pw-inbox_unread-dot"></span>'}
  </div>
  <div class="pw-inbox_item-body">
    ${escape(message)}
  </div>
  <div class="pw-inbox_item-time">
    ${escape(getMessageTime(sendDate))}
  </div>
</div>`;

const heroTemplate = (url: string, alt: string): string => `
<div class="pw-inbox_media">
  <img src="${escape(url)}" alt="${escape(alt)}" class="pw-inbox_hero">
</div>`;

const carouselTemplate = (slides: Array<IInboxMessageSlide>, activeIndex: number, alt: string): string => {
  const slide = slides[activeIndex];
  const caption = slide.caption
    ? `<span class="pw-inbox_slide-caption">${escape(slide.caption)}</span>`
    : '';

  // One slide is in the DOM at a time: the widget replaces its own innerHTML on
  // every refresh, so there is no state to keep in the markup either way.
  const dots = slides.length > 1
    ? `<div class="pw-inbox_pager">${slides
      .map((_slide, index) => `<button type="button" class="pw-inbox_dot${index === activeIndex ? ' pw-active' : ''}" data-pw-slide="${index}"></button>`)
      .join('')}</div>`
    : '';

  return `
<div class="pw-inbox_media">
  <div class="pw-inbox_slide" data-pw-slide-link="${escape(slide.link)}">
    <img src="${escape(slide.imageUrl)}" alt="${escape(slide.caption || alt)}" class="pw-inbox_hero">
    ${caption}
  </div>
  ${dots}
</div>`;
};

export const messageTemplate = (message: IInboxMessagePublic, activeSlide: number = 0): string => {
  const { layout, heroUrl, carousel, title, message: body } = message;
  const alt = title || body;

  let inner: string;

  switch (layout) {
    case 'banner':
      // Banner is the hero alone: the control panel sends it with no title or
      // body on purpose, and drawing an empty text block looks like a bug.
      inner = heroTemplate(heroUrl, alt);
      break;
    case 'captioned':
      inner = `${heroTemplate(heroUrl, alt)}${textsTemplate(message)}`;
      break;
    case 'carousel':
      inner = `${carouselTemplate(carousel, Math.min(activeSlide, carousel.length - 1), alt)}${textsTemplate(message)}`;
      break;
    default:
      inner = `<div class="pw-inbox_icon">${avatarTemplate(message)}</div>${textsTemplate(message)}`;
  }

  return `
<div class="pw-inbox_item-inner pw-inbox_item--${escape(layout)}">
  ${inner}
</div>
<span class="pw-inbox_item-remove"></span>`;
};
