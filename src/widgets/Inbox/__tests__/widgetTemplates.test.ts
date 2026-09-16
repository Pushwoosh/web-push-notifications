import { type IInboxMessagePublic } from '../../../models/InboxMessages.types';
import { messageTemplate } from '../widgetTemplates';

function buildMessage(overrides: Partial<IInboxMessagePublic> = {}): IInboxMessagePublic {
  return {
    code: 'abc123',
    title: 'Order shipped',
    message: 'Your order is on its way',
    imageUrl: 'https://cdn/icon.png',
    iconUrl: 'https://cdn/icon.png',
    heroUrl: '',
    layout: 'classic',
    carousel: [],
    customData: {},
    webPopupCode: '',
    sendDate: new Date().toISOString(),
    type: 0,
    link: '/',
    isRead: false,
    isActionPerformed: false,
    ...overrides,
  };
}

/** Renders the way the widget does, so the assertions see a real DOM. */
function render(message: IInboxMessagePublic, activeSlide?: number): HTMLElement {
  const item = document.createElement('li');
  item.className = 'pw-inbox_item';
  item.innerHTML = messageTemplate(message, activeSlide);

  return item;
}

describe('classic', () => {
  it('draws the avatar, the texts and the unread dot', () => {
    const item = render(buildMessage());

    expect(item.querySelector('.pw-inbox_message-image')!.getAttribute('src')).toBe('https://cdn/icon.png');
    expect(item.querySelector('.pw-inbox_item-title')!.textContent).toContain('Order shipped');
    expect(item.querySelector('.pw-inbox_item-body')!.textContent).toContain('Your order is on its way');
    expect(item.querySelector('.pw-inbox_unread-dot')).not.toBeNull();
    expect(item.querySelector('.pw-inbox_media')).toBeNull();
  });

  it('hides the unread dot once the message is read', () => {
    expect(render(buildMessage({ isRead: true })).querySelector('.pw-inbox_unread-dot')).toBeNull();
  });

  it('falls back to a colored initial when there is no icon', () => {
    const item = render(buildMessage({ iconUrl: '' }));

    expect(item.querySelector('.pw-inbox_message-image')).toBeNull();
    expect(item.querySelector('.pw-inbox_icon-initial')!.textContent!.trim()).toBe('O');
  });
});

describe('banner', () => {
  it('draws the hero alone, with no text block', () => {
    const item = render(buildMessage({
      layout: 'banner', heroUrl: 'https://cdn/hero.jpg', title: '', message: '',
    }));

    expect(item.querySelector('.pw-inbox_hero')!.getAttribute('src')).toBe('https://cdn/hero.jpg');
    expect(item.querySelector('.pw-inbox_content')).toBeNull();
  });
});

describe('captioned', () => {
  it('draws the hero above the texts', () => {
    const item = render(buildMessage({ layout: 'captioned', heroUrl: 'https://cdn/hero.jpg' }));

    expect(item.querySelector('.pw-inbox_hero')!.getAttribute('src')).toBe('https://cdn/hero.jpg');
    expect(item.querySelector('.pw-inbox_content')).not.toBeNull();
  });
});

describe('carousel', () => {
  const carousel = [
    { imageUrl: 'https://cdn/1.jpg', caption: 'Slide one', link: 'https://shop/1' },
    { imageUrl: 'https://cdn/2.jpg', caption: '', link: '' },
    { imageUrl: 'https://cdn/3.jpg', caption: 'Slide three', link: '' },
  ];

  it('draws the first slide and one dot per slide', () => {
    const item = render(buildMessage({ layout: 'carousel', carousel }));

    expect(item.querySelector('.pw-inbox_hero')!.getAttribute('src')).toBe('https://cdn/1.jpg');
    expect(item.querySelector('.pw-inbox_slide-caption')!.textContent!.trim()).toBe('Slide one');
    expect(item.querySelectorAll('.pw-inbox_dot')).toHaveLength(3);
    expect(item.querySelector('.pw-inbox_dot.pw-active')!.getAttribute('data-pw-slide')).toBe('0');
  });

  it('draws the slide it is asked for and marks its dot active', () => {
    const item = render(buildMessage({ layout: 'carousel', carousel }), 2);

    expect(item.querySelector('.pw-inbox_hero')!.getAttribute('src')).toBe('https://cdn/3.jpg');
    expect(item.querySelector('.pw-inbox_dot.pw-active')!.getAttribute('data-pw-slide')).toBe('2');
  });

  it('clamps an index past the end instead of rendering nothing', () => {
    const item = render(buildMessage({ layout: 'carousel', carousel }), 99);

    expect(item.querySelector('.pw-inbox_hero')!.getAttribute('src')).toBe('https://cdn/3.jpg');
  });

  it('carries the slide link the click handler reads, and omits an absent one', () => {
    expect(render(buildMessage({ layout: 'carousel', carousel }), 0)
      .querySelector('.pw-inbox_slide')!.getAttribute('data-pw-slide-link')).toBe('https://shop/1');
    expect(render(buildMessage({ layout: 'carousel', carousel }), 1)
      .querySelector('.pw-inbox_slide')!.getAttribute('data-pw-slide-link')).toBe('');
  });

  it('drops the pager for a single slide', () => {
    const item = render(buildMessage({ layout: 'carousel', carousel: [carousel[0]] }));

    expect(item.querySelector('.pw-inbox_pager')).toBeNull();
  });
});

describe('escaping', () => {
  const payload = '<img src=x onerror=alert(document.domain)>';

  it('renders campaign content as inert text in every layout', () => {
    const layouts: Array<Partial<IInboxMessagePublic>> = [
      { layout: 'classic' },
      { layout: 'captioned', heroUrl: 'https://cdn/h.jpg' },
      {
        layout: 'carousel',
        carousel: [{ imageUrl: 'https://cdn/1.jpg', caption: payload, link: '' }],
      },
    ];

    layouts.forEach((overrides) => {
      const item = render(buildMessage({ title: payload, message: payload, ...overrides }));

      // Only the images the templates themselves write may exist.
      item.querySelectorAll('img').forEach((img) => {
        expect(img.getAttributeNames().filter((name) => /^on/i.test(name))).toHaveLength(0);
      });
      expect(item.querySelectorAll('script')).toHaveLength(0);
      // The payload has to arrive as text, not as an element.
      const title = item.querySelector('.pw-inbox_item-title');

      if (title) {
        expect(title.textContent).toContain(payload);
        expect(title.querySelector('img')).toBeNull();
      }
    });
  });

  it('keeps a hostile icon url inside the src attribute', () => {
    const item = render(buildMessage({ iconUrl: 'https://cdn/x.png" onerror="alert(1)' }));
    const img = item.querySelector('.pw-inbox_message-image')!;

    expect(img.getAttribute('src')).toBe('https://cdn/x.png" onerror="alert(1)');
    expect(img.getAttributeNames()).toEqual(['src', 'alt', 'class']);
  });
});
