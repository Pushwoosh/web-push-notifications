import { type WebPopupProductsSlot } from '@pushwoosh/websdk-common/web-popups';

import { Logger } from '../../../core/logger';
import { createProductsHost } from '../productsHost';

const SLOT: WebPopupProductsSlot = {
  type: 'products',
  key: 'recs',
  strategy: 'viewed',
  limit: 4,
  layout: 'grid',
  fields: { title: true, price: true, image: true, cta: true },
  ctaText: '',
  hideWhenEmpty: false,
};

const ITEM = {
  id: 'p1', title: 'Water', description: '', image_url: 'https://cdn.example/p1.jpg', url: 'https://shop.example/p1',
  price: 4.5, price_formatted: '$4.50', currency: 'USD', category: '', sku: '',
};

function recommendations() {
  return {
    fetch: jest.fn().mockResolvedValue({ items: [ITEM], strategy: 'viewed' }),
    trackClick: jest.fn().mockResolvedValue(undefined),
  };
}

describe('createProductsHost', () => {
  it('maps feed items to product cards; no fallback on the slot = none', async () => {
    const reco = recommendations();
    const host = createProductsHost(reco);

    await expect(host.load(SLOT)).resolves.toEqual([{
      id: 'p1', title: 'Water', price: 4.5, currency: 'USD', image: 'https://cdn.example/p1.jpg', url: 'https://shop.example/p1',
    }]);
    expect(reco.fetch).toHaveBeenCalledWith({ strategy: 'viewed', limit: 4, block: 'recs', fallback: 'none' });
  });

  it('passes the slot fallback to the feed, which serves it when the strategy is empty', async () => {
    const reco = recommendations();
    await createProductsHost(reco).load({ ...SLOT, strategy: 'cart', fallbackStrategy: 'bestsellers_30d', hideWhenEmpty: true });

    expect(reco.fetch).toHaveBeenCalledWith({ strategy: 'cart', limit: 4, block: 'recs', fallback: 'bestsellers_30d' });
  });

  it('lets a feed failure reach the shared loader, which reads it as empty', async () => {
    const reco = recommendations();
    reco.fetch.mockRejectedValueOnce(new Error('down'));

    await expect(createProductsHost(reco).load(SLOT)).rejects.toThrow('down');
  });

  it('asks for the fallback on its own when the strategy itself fails', async () => {
    const reco = recommendations();
    reco.fetch.mockRejectedValueOnce(new Error('status 400'));

    const items = await createProductsHost(reco).load({ ...SLOT, strategy: 'cart', fallbackStrategy: 'bestsellers_30d' });

    expect(items).toHaveLength(1);
    expect(reco.fetch).toHaveBeenLastCalledWith({ strategy: 'bestsellers_30d', limit: 4, block: 'recs', fallback: 'none' });
  });

  it('logs a failed click report instead of swallowing it', async () => {
    const error = jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const reco = recommendations();
    reco.trackClick.mockRejectedValueOnce(new Error('down'));

    createProductsHost(reco).onClick?.({ id: 'p1', title: 'Water', url: '' }, SLOT);
    await Promise.resolve();

    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('reports a card click as a recommendation click', () => {
    const reco = recommendations();
    createProductsHost(reco).onClick?.({ id: 'p1', title: 'Water', url: '' }, SLOT);

    expect(reco.trackClick).toHaveBeenCalledWith({ block: 'recs', strategy: 'viewed', productId: 'p1' });
  });
});
