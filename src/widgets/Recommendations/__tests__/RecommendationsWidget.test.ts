import { loadWhenRecommendationsAppear } from '../../../core/recommendationsLoader';
import { type Recommendations } from '../../../modules/Recommendations/Recommendations';
import { type IRecommendationsRequest, type IRecommendationsResponse } from '../../../modules/Recommendations/Recommendations.types';
import { readRequest, RecommendationsWidget } from '../RecommendationsWidget';

const item = (id: string, extra: object = {}) => ({
  id, title: `Product ${id}`, description: '', image_url: `https://shop.example/${id}.jpg`, url: `https://shop.example/${id}`,
  price: 10, price_formatted: '€10', currency: 'EUR', category: '', sku: id, ...extra,
});

function fakeRecommendations(answer: () => Promise<IRecommendationsResponse>) {
  return {
    fetch: jest.fn((_request: IRecommendationsRequest) => answer()),
    trackClick: jest.fn().mockResolvedValue(undefined),
  };
}

function container(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-pw-recommendations', '');
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
  document.body.appendChild(el);

  return el;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('readRequest', () => {
  it('maps the data attributes to the feed request', () => {
    const el = container({
      'data-pw-strategy': 'viewed', 'data-pw-fallback': 'bestsellers_30d', 'data-pw-limit': '6',
      'data-pw-product-id': 'outwear01', 'data-pw-exclude': 'a, b', 'data-pw-block': 'pdp-viewed',
    });

    expect(readRequest(el)).toEqual({
      strategy: 'viewed', fallback: 'bestsellers_30d', limit: 6, productId: 'outwear01', exclude: ['a', 'b'], block: 'pdp-viewed',
    });
  });
});

describe('RecommendationsWidget', () => {
  it('renders the cards in shadow DOM and swaps the title for a fallback answer', async () => {
    const reco = fakeRecommendations(async () => ({ items: [item('p1', { old_price_formatted: '€12' }), item('p2')], strategy: 'bestsellers_30d' }));
    const el = container({ 'data-pw-strategy': 'viewed', 'data-pw-title': 'You viewed', 'data-pw-fallback-title': 'Popular' });

    await new RecommendationsWidget(<Recommendations><unknown>reco).render(el);

    expect(el.getAttribute('data-pw-state')).toBe('ready');
    expect(el.shadowRoot!.querySelector('.title')!.textContent).toBe('Popular');
    const cards = el.shadowRoot!.querySelectorAll<HTMLAnchorElement>('.card');
    expect([...cards].map((card) => card.href)).toEqual(['https://shop.example/p1', 'https://shop.example/p2']);
    expect(cards[0].querySelector('.old')!.textContent).toBe('€12');
  });

  it('reports a click with the served strategy and the position', async () => {
    const reco = fakeRecommendations(async () => ({ items: [item('p1'), item('p2')], strategy: 'viewed' }));
    const el = container({ 'data-pw-strategy': 'viewed', 'data-pw-block': 'pdp' });
    await new RecommendationsWidget(<Recommendations><unknown>reco).render(el);

    const card = el.shadowRoot!.querySelectorAll<HTMLAnchorElement>('.card')[1];
    card.addEventListener('click', (event) => event.preventDefault());
    card.click();

    expect(reco.trackClick).toHaveBeenCalledWith({ block: 'pdp', strategy: 'viewed', productId: 'p2', position: 2 });
  });

  it('leaves an empty block empty so the site can hide its frame', async () => {
    const reco = fakeRecommendations(async () => ({ items: [], strategy: 'none' }));
    const el = container({ 'data-pw-strategy': 'viewed' });
    await new RecommendationsWidget(<Recommendations><unknown>reco).render(el);

    expect(el.getAttribute('data-pw-state')).toBe('empty');
    expect(el.shadowRoot!.childNodes).toHaveLength(0);
  });

  it('marks a failed request as error', async () => {
    const reco = fakeRecommendations(async () => {
      throw new Error('boom');
    });
    const el = container({ 'data-pw-strategy': 'viewed' });
    await new RecommendationsWidget(<Recommendations><unknown>reco).render(el);

    expect(el.getAttribute('data-pw-state')).toBe('error');
  });

  it('drops a javascript: link from the feed', async () => {
    const reco = fakeRecommendations(async () => ({ items: [item('p1', { url: 'javascript:alert(1)' })], strategy: 'viewed' }));
    const el = container({ 'data-pw-strategy': 'viewed' });
    await new RecommendationsWidget(<Recommendations><unknown>reco).render(el);

    expect(el.shadowRoot!.querySelector('.card')!.hasAttribute('href')).toBe(false);
  });

  it('ignores a late answer superseded by a re-render', async () => {
    let resolveFirst!: (value: IRecommendationsResponse) => void;
    const answers = [
      new Promise<IRecommendationsResponse>((resolve) => { resolveFirst = resolve; }),
      Promise.resolve({ items: [item('new')], strategy: 'viewed' as const }),
    ];
    const reco = fakeRecommendations(() => answers.shift()!);
    const el = container({ 'data-pw-strategy': 'viewed' });
    const widget = new RecommendationsWidget(<Recommendations><unknown>reco);

    const first = widget.render(el);
    await widget.render(el);
    resolveFirst({ items: [item('old')], strategy: 'viewed' });
    await first;

    expect(el.shadowRoot!.querySelector('.name')!.textContent).toBe('Product new');
  });

  it('renders blocks added later and re-renders on an attribute change', async () => {
    const reco = fakeRecommendations(async () => ({ items: [item('p1')], strategy: 'also_bought' }));
    const widget = new RecommendationsWidget(<Recommendations><unknown>reco);
    widget.run();

    const el = container({ 'data-pw-strategy': 'also_bought', 'data-pw-product-id': 'a' });
    await flush();
    el.setAttribute('data-pw-product-id', 'b');
    await flush();
    widget.stop();

    expect(reco.fetch.mock.calls.map((call) => call[0].productId)).toEqual(['a', 'b']);
  });
});

describe('loadWhenRecommendationsAppear', () => {
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  it('loads at once when a block is already on the page', () => {
    container({});
    const load = jest.fn();
    loadWhenRecommendationsAppear(document, load);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not watch the page unless the site is an SPA', async () => {
    const load = jest.fn();
    loadWhenRecommendationsAppear(document, load);
    container({});
    await flush();
    await frame();

    expect(load).not.toHaveBeenCalled();
  });

  it('in an SPA waits for a block and loads once', async () => {
    const load = jest.fn();
    loadWhenRecommendationsAppear(document, load, true);
    await flush();
    expect(load).not.toHaveBeenCalled();

    container({});
    container({});
    await flush();
    await frame();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
