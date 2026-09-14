import {
  getCustomData,
  getHeroUrl,
  getIconInitial,
  getIconUrl,
  getValidSlides,
  KNOWN_LAYOUTS,
  MAX_CAROUSEL_SLIDES,
  parseUserData,
  resolveInboxLayout,
} from '../InboxCell';
import { type IInboxUserData } from '../InboxCell.types';

describe('parseUserData', () => {
  it('accepts the object form used by getInboxMessages', () => {
    expect(parseUserData({ u: { displayType: 'banner' } })).toEqual({ displayType: 'banner' });
  });

  it('accepts the JSON string form used on the push path', () => {
    expect(parseUserData({ u: '{"displayType":"carousel"}' })).toEqual({ displayType: 'carousel' });
  });

  it('returns an empty object for absent, malformed or non-object values', () => {
    expect(parseUserData({})).toEqual({});
    expect(parseUserData({ u: '' })).toEqual({});
    expect(parseUserData({ u: 'not json' })).toEqual({});
    expect(parseUserData({ u: 'null' })).toEqual({});
    expect(parseUserData({ u: 42 })).toEqual({});
  });
});

describe('getValidSlides', () => {
  it('drops slides with no image and maps wire names to public ones', () => {
    const slides = getValidSlides({
      carousel: [
        { image: 'https://cdn/1.jpg', title: 'One', url: 'https://shop/1' },
        { title: 'no image' },
        { image: 'https://cdn/2.jpg' },
      ],
    });

    expect(slides).toEqual([
      { imageUrl: 'https://cdn/1.jpg', caption: 'One', link: 'https://shop/1' },
      { imageUrl: 'https://cdn/2.jpg', caption: '', link: '' },
    ]);
  });

  it('drops a slide link that has no scheme, as the iOS SDK does', () => {
    const [slide] = getValidSlides({ carousel: [{ image: 'https://cdn/1.jpg', url: '/orders' }] });

    expect(slide.link).toBe('');
  });

  it('drops a slide link whose scheme runs script', () => {
    const urls = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>'];

    urls.forEach((url) => {
      const [slide] = getValidSlides({ carousel: [{ image: 'https://cdn/1.jpg', url }] });

      expect(slide.link).toBe('');
    });
  });

  it('keeps a deep link scheme', () => {
    const [slide] = getValidSlides({ carousel: [{ image: 'https://cdn/1.jpg', url: 'myapp://orders/42' }] });

    expect(slide.link).toBe('myapp://orders/42');
  });

  it(`caps the carousel at ${MAX_CAROUSEL_SLIDES} slides, like the sending pipeline`, () => {
    const carousel = Array.from({ length: 9 }, (_item, index) => ({ image: `https://cdn/${index}.jpg` }));

    expect(getValidSlides({ carousel })).toHaveLength(MAX_CAROUSEL_SLIDES);
  });

  it('survives a missing or malformed carousel', () => {
    expect(getValidSlides({})).toEqual([]);
    expect(getValidSlides(<IInboxUserData><unknown>{ carousel: 'nope' })).toEqual([]);
  });
});

describe('getHeroUrl', () => {
  it('prefers action_params.b, the only hero source for web', () => {
    expect(getHeroUrl({ b: 'https://cdn/hero.jpg' }, { image: 'https://cdn/u.png' }, 'https://cdn/icon.png'))
      .toBe('https://cdn/hero.jpg');
  });

  it('falls back to the message image and then to the one inside u', () => {
    expect(getHeroUrl({}, {}, 'https://cdn/icon.png')).toBe('https://cdn/icon.png');
    expect(getHeroUrl({}, { image: 'https://cdn/u.png' }, '')).toBe('https://cdn/u.png');
    expect(getHeroUrl({}, {}, '')).toBe('');
  });
});

describe('getIconUrl', () => {
  it('takes the message image first and never the banner', () => {
    expect(getIconUrl({ image: 'https://cdn/u.png' }, 'https://cdn/icon.png')).toBe('https://cdn/icon.png');
    expect(getIconUrl({ image: 'https://cdn/u.png' }, '')).toBe('https://cdn/u.png');
    expect(getIconUrl({}, '')).toBe('');
  });
});

describe('resolveInboxLayout', () => {
  const base = { hasTitle: true, hasBody: true, heroUrl: '', bannerUrl: '', slidesCount: 0 };

  it('draws every layout the campaign asked for when it can render', () => {
    expect(resolveInboxLayout({ ...base, displayType: 'classic' })).toBe('classic');
    expect(resolveInboxLayout({ ...base, displayType: 'banner', heroUrl: 'https://cdn/h.jpg' })).toBe('banner');
    expect(resolveInboxLayout({ ...base, displayType: 'captioned', heroUrl: 'https://cdn/h.jpg' })).toBe('captioned');
    expect(resolveInboxLayout({ ...base, displayType: 'carousel', slidesCount: 2 })).toBe('carousel');
  });

  it('degrades to classic when the requested layout cannot render', () => {
    expect(resolveInboxLayout({ ...base, displayType: 'banner' })).toBe('classic');
    expect(resolveInboxLayout({ ...base, displayType: 'captioned' })).toBe('classic');
    expect(resolveInboxLayout({ ...base, displayType: 'captioned', heroUrl: 'https://cdn/h.jpg', hasBody: false })).toBe('classic');
    expect(resolveInboxLayout({ ...base, displayType: 'carousel', slidesCount: 0 })).toBe('classic');
    expect(resolveInboxLayout({ ...base, displayType: 'carousel', slidesCount: 2, hasTitle: false })).toBe('classic');
  });

  it('degrades an unsupported layout, such as the iOS video type', () => {
    const banner = { heroUrl: 'https://cdn/h.jpg', bannerUrl: 'https://cdn/h.jpg' };

    expect(resolveInboxLayout({ ...base, ...banner, displayType: 'video' })).toBe('captioned');
    expect(resolveInboxLayout({ ...base, displayType: 'video' })).toBe('classic');
  });

  describe('with no displayType, which messaging omits for an empty layoutType', () => {
    const banner = { heroUrl: 'https://cdn/h.jpg', bannerUrl: 'https://cdn/h.jpg' };

    it('picks banner for a campaign banner with no title', () => {
      expect(resolveInboxLayout({ ...base, ...banner, hasTitle: false })).toBe('banner');
    });

    it('picks captioned for a campaign banner with both title and body', () => {
      expect(resolveInboxLayout({ ...base, ...banner })).toBe('captioned');
    });

    it('picks classic with no banner at all', () => {
      expect(resolveInboxLayout(base)).toBe('classic');
    });

    it('picks classic for a campaign banner with a title but no body', () => {
      expect(resolveInboxLayout({ ...base, ...banner, hasBody: false })).toBe('classic');
    });

    it('leaves a legacy message classic when only an icon stands in as hero', () => {
      // Every message sent before the layouts existed: icon, title, body, no
      // displayType. The icon must not be read as a hero.
      expect(resolveInboxLayout({ ...base, heroUrl: 'https://cdn/icon.png', bannerUrl: '' })).toBe('classic');
    });
  });

  it('only ever returns a layout we can draw', () => {
    const cases = ['classic', 'banner', 'captioned', 'carousel', 'video', '', undefined, 'nonsense'];

    cases.forEach((displayType) => {
      expect(KNOWN_LAYOUTS).toContain(resolveInboxLayout({ ...base, displayType }));
    });
  });
});

describe('getIconInitial', () => {
  it('takes the first letter of the title, then of the body', () => {
    expect(getIconInitial('order shipped', 'body')).toBe('O');
    expect(getIconInitial('', 'body text')).toBe('B');
    expect(getIconInitial('  spaced', '')).toBe('S');
  });

  it('falls back to a question mark when there is nothing to take', () => {
    expect(getIconInitial('', '')).toBe('?');
    expect(getIconInitial('   ', '')).toBe('?');
  });
});

describe('getCustomData', () => {
  it('keeps campaign keys and strips the cell contract', () => {
    const userData: IInboxUserData = {
      displayType: 'carousel',
      carousel: [{ image: 'https://cdn/1.jpg' }],
      image: 'https://cdn/icon.png',
      screen: 'orders',
      orderId: 42,
    };

    expect(getCustomData(userData)).toEqual({ screen: 'orders', orderId: 42 });
  });

  it('is empty when the campaign sent nothing of its own', () => {
    expect(getCustomData({ displayType: 'banner' })).toEqual({});
    expect(getCustomData({})).toEqual({});
  });
});
