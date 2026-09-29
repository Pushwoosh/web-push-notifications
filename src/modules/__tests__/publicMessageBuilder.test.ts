import { type default as InboxMessagesModel } from '../../models/InboxMessages';
import { type IInboxMessage } from '../../models/InboxMessages.types';
import { type Api } from '../Api/Api';
import { type Data } from '../Data/Data';
import InboxMessagesPublic from '../InboxMessagesPublic';

const DEFAULT_IMAGE = 'https://cdn/default-icon.png';
const DEFAULT_TITLE = 'Default title';

function buildModule() {
  const data = <Data><unknown>{
    getDefaultNotificationImage: jest.fn().mockResolvedValue(DEFAULT_IMAGE),
    getDefaultNotificationTitle: jest.fn().mockResolvedValue(DEFAULT_TITLE),
  };

  return new InboxMessagesPublic(data, <Api>{}, <InboxMessagesModel>{});
}

function buildMessage(overrides: Partial<IInboxMessage> = {}): IInboxMessage {
  return {
    inbox_id: 'abc123',
    order: '777',
    rt: '1790000000',
    send_date: '1789000000',
    title: 'Order shipped',
    text: 'Your order is on its way',
    image: 'https://cdn/icon.png',
    action_type: 1,
    action_params: '{}',
    status: 1,
    ...overrides,
  };
}

describe('publicMessageBuilder', () => {
  it('reads the carousel contract out of action_params.u', async () => {
    const message = await buildModule().publicMessageBuilder(buildMessage({
      action_params: JSON.stringify({
        b: 'https://cdn/banner.jpg',
        l: 'https://shop/orders',
        u: {
          displayType: 'carousel',
          carousel: [{ image: 'https://cdn/s1.jpg', title: 'Slide one' }],
          screen: 'orders',
        },
      }),
    }));

    expect(message.layout).toBe('carousel');
    expect(message.carousel).toEqual([
      { imageUrl: 'https://cdn/s1.jpg', caption: 'Slide one', link: '' },
    ]);
    expect(message.customData).toEqual({ screen: 'orders' });
    expect(message.heroUrl).toBe('https://cdn/banner.jpg');
    expect(message.iconUrl).toBe('https://cdn/icon.png');
    expect(message.link).toBe('https://shop/orders');
  });

  it('renders a banner, which the control panel sends with no title or body', async () => {
    const message = await buildModule().publicMessageBuilder(buildMessage({
      title: '',
      text: '',
      image: '',
      action_params: JSON.stringify({ b: 'https://cdn/hero.jpg', u: { displayType: 'banner' } }),
    }));

    expect(message.layout).toBe('banner');
    expect(message.heroUrl).toBe('https://cdn/hero.jpg');
  });

  it('does not let the default title turn a titleless banner into a captioned cell', async () => {
    const message = await buildModule().publicMessageBuilder(buildMessage({
      title: '',
      text: '',
      image: '',
      action_params: JSON.stringify({ b: 'https://cdn/hero.jpg' }),
    }));

    expect(message.layout).toBe('banner');
    expect(message.title).toBe(DEFAULT_TITLE);
  });

  it('accepts the string form of u used on the push path', async () => {
    const message = await buildModule().publicMessageBuilder(buildMessage({
      action_params: JSON.stringify({ b: 'https://cdn/hero.jpg', u: '{"displayType":"captioned"}' }),
    }));

    expect(message.layout).toBe('captioned');
  });

  it('keeps a legacy message classic: no displayType, no banner, just an icon', async () => {
    const message = await buildModule().publicMessageBuilder(buildMessage({ action_params: '' }));

    expect(message.layout).toBe('classic');
    expect(message.carousel).toEqual([]);
    expect(message.customData).toEqual({});
    expect(message.heroUrl).toBe('https://cdn/icon.png');
    expect(message.link).toBe('/');
  });

  it('falls back to the default icon only when the campaign sent none', async () => {
    const withIcon = await buildModule().publicMessageBuilder(buildMessage());
    const withoutIcon = await buildModule().publicMessageBuilder(buildMessage({ image: '' }));

    expect(withIcon.iconUrl).toBe('https://cdn/icon.png');
    expect(withoutIcon.iconUrl).toBe(DEFAULT_IMAGE);
    expect(withoutIcon.imageUrl).toBe(withoutIcon.iconUrl);
  });

  it('reports sendDate as the true UTC instant', async () => {
    const message = await buildModule().publicMessageBuilder(buildMessage({ send_date: '1789000000' }));

    expect(message.sendDate).toBe(new Date(1789000000 * 1000).toISOString());
    expect(Date.parse(message.sendDate)).toBe(1789000000 * 1000);
  });

  it('drops a slide link whose scheme runs script', async () => {
    const message = await buildModule().publicMessageBuilder(buildMessage({
      action_params: JSON.stringify({
        u: {
          displayType: 'carousel',
          carousel: [
            { image: 'https://cdn/1.jpg', url: 'javascript:alert(document.cookie)' },
            { image: 'https://cdn/2.jpg', url: 'https://shop/2' },
          ],
        },
      }),
    }));

    expect(message.carousel.map((slide) => slide.link)).toEqual(['', 'https://shop/2']);
  });
});
