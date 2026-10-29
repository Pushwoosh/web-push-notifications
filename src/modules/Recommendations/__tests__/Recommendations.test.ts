import {
  DEFAULT_RECOMMENDATIONS_ENDPOINT, PRODUCT_VIEW_EVENT, RECOMMENDATION_CLICK_EVENT, Recommendations, type IRecommendationsDeps,
} from '../Recommendations';

const APP = '70699-8A0F4';
const HWID = `${APP}_3f2b8c1e-9d4a-4b7e-8a21-5c6d7e8f9a0b`;

function memoryStorage() {
  const values = new Map<string, string>();

  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
}

function setup(overrides: Partial<IRecommendationsDeps> = {}) {
  let now = 1_700_000_000_000;
  const postEvent = jest.fn().mockResolvedValue({});
  const fetchMock = jest.fn().mockResolvedValue(<Response><unknown>{
    ok: true, status: 200, json: async () => ({ items: [], strategy: 'none' }),
  });
  const reco = new Recommendations({
    postEvent,
    isCommunicationDisabled: () => false,
    getApplicationCode: async () => APP,
    getHwid: async () => HWID,
    getEndpoint: () => undefined,
    fetch: fetchMock,
    now: () => now,
    storage: memoryStorage(),
    ...overrides,
  });

  const tick = (ms: number) => {
    now += ms;
  };

  return { reco, postEvent, fetchMock, tick };
}

describe('Recommendations.trackProductView', () => {
  it('sends the spec-1 attributes under PW_ProductView', async () => {
    const { reco, postEvent } = setup();
    await reco.trackProductView({ id: 'sku1', name: 'Shampoo', price: 10, currency: 'EUR', category: 'Hair', url: 'https://s/p', imageUrl: 'https://s/i' });

    expect(postEvent).toHaveBeenCalledWith(PRODUCT_VIEW_EVENT, {
      productId: 'sku1', name: 'Shampoo', price: 10, currency: 'EUR', category: 'Hair', productUrl: 'https://s/p', imageUrl: 'https://s/i',
    });
  });

  it('sends one event per product in 30 seconds', async () => {
    const { reco, postEvent, tick } = setup();
    await reco.trackProductView({ id: 'sku1' });
    tick(29_000);
    await reco.trackProductView({ id: 'sku1' });
    await reco.trackProductView({ id: 'sku2' });
    tick(2_000);
    await reco.trackProductView({ id: 'sku1' });

    expect(postEvent.mock.calls.map((call) => call[1].productId)).toEqual(['sku1', 'sku2', 'sku1']);
  });

  it('survives whatever else sits under the storage key', async () => {
    for (const stored of ['null', '[1,2]', '"x"', '{"sku1":"soon"}', '{broken']) {
      const storage = memoryStorage();
      storage.setItem('pushwoosh-recommendations-views', stored);
      const { reco, postEvent } = setup({ storage });

      await expect(reco.trackProductView({ id: 'sku1' })).resolves.toBeUndefined();
      expect(postEvent).toHaveBeenCalledTimes(1);
    }
  });

  it('stays silent without communication consent', async () => {
    const { reco, postEvent } = setup({ isCommunicationDisabled: () => true });
    await reco.trackProductView({ id: 'sku1' });

    expect(postEvent).not.toHaveBeenCalled();
  });
});

describe('Recommendations.fetch', () => {
  it('asks the onsite feed with the hwid in a header, not the query', async () => {
    const { reco, fetchMock } = setup();
    await reco.fetch({ strategy: 'also_bought', fallback: 'none', limit: 4, productId: 'p1', exclude: ['p2', 'p3'], block: 'cart-cross' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${DEFAULT_RECOMMENDATIONS_ENDPOINT}/feed/v1/onsite/products.json`
      + `?application=${APP}&strategy=also_bought&fallback=none&limit=4&product_id=p1&exclude=p2%2Cp3&block=cart-cross`);
    expect(init.headers).toEqual({ 'X-PW-HWID': HWID });
  });

  it('goes anonymous without communication consent', async () => {
    const { reco, fetchMock } = setup({ isCommunicationDisabled: () => true });
    await reco.fetch({ strategy: 'viewed' });

    expect(fetchMock.mock.calls[0][1].headers).toEqual({});
  });

  it('honours a custom endpoint', async () => {
    const { reco, fetchMock } = setup({ getEndpoint: () => 'https://reco.example/' });
    await reco.fetch({ strategy: 'viewed' });

    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/reco\.example\/feed\/v1\/onsite\/products\.json\?/);
  });

  it('rejects on a non-200 answer', async () => {
    const { reco } = setup({ fetch: jest.fn().mockResolvedValue(<Response><unknown>{ ok: false, status: 404 }) });

    await expect(reco.fetch({ strategy: 'viewed' })).rejects.toThrow('status 404');
  });
});

describe('Recommendations.trackClick', () => {
  it('keeps the product off the keys that feed the viewed tail, and survives navigation', async () => {
    const { reco, postEvent } = setup();
    await reco.trackClick({ block: 'pdp', strategy: 'viewed', productId: 'p1', position: 2 });

    expect(postEvent).toHaveBeenCalledWith(RECOMMENDATION_CLICK_EVENT,
      { block: 'pdp', strategy: 'viewed', recoProductId: 'p1', position: 2 }, { keepalive: true });
    expect(postEvent.mock.calls[0][1]).not.toHaveProperty('productId');
  });
});
