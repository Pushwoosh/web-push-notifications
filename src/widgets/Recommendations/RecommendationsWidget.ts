import { RECOMMENDATIONS_STYLES } from './styles';
import { Logger } from '../../core/logger';
import { type Recommendations } from '../../modules/Recommendations/Recommendations';
import {
  type IRecommendationsRequest, type IRecommendationsResponse, type IRecommendedProduct, type TRecommendationStrategy,
} from '../../modules/Recommendations/Recommendations.types';

export const CONTAINER_SELECTOR = '[data-pw-recommendations]';

// a change to any of these re-renders the block
const WATCHED_ATTRIBUTES = [
  'data-pw-recommendations', 'data-pw-strategy', 'data-pw-fallback', 'data-pw-limit', 'data-pw-product-id',
  'data-pw-exclude', 'data-pw-block', 'data-pw-title', 'data-pw-fallback-title',
];

export type TRecommendationsState = 'loading' | 'ready' | 'empty' | 'error';

/** The block's request, read from its data attributes. */
export function readRequest(el: HTMLElement): IRecommendationsRequest {
  const { dataset } = el;
  const limit = Number(dataset.pwLimit);

  return {
    strategy: (dataset.pwStrategy || 'bestsellers_30d') as TRecommendationStrategy,
    fallback: dataset.pwFallback as IRecommendationsRequest['fallback'] || undefined,
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    productId: dataset.pwProductId || undefined,
    exclude: dataset.pwExclude ? dataset.pwExclude.split(',').map((id) => id.trim()).filter(Boolean) : undefined,
    block: dataset.pwBlock || undefined,
  };
}

// the feed is the merchant's catalog: a javascript: link from it must not reach the page
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url, location.href);

    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export class RecommendationsWidget {
  private readonly recommendations: Recommendations;
  private readonly root: Document;
  // a re-render supersedes the request in flight: its late answer must not overwrite the new one
  private readonly generations = new WeakMap<HTMLElement, number>();
  private observer?: MutationObserver;

  constructor(recommendations: Recommendations, root: Document = document) {
    this.recommendations = recommendations;
    this.root = root;
  }

  public run(): void {
    this.root.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR).forEach((el) => void this.render(el));

    // SPA pages add blocks and swap the product on screen without a reload
    this.observer = new MutationObserver((mutations) => this.onMutations(mutations));
    this.observer.observe(this.root.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: WATCHED_ATTRIBUTES,
    });
  }

  public stop(): void {
    this.observer?.disconnect();
  }

  public async render(el: HTMLElement): Promise<void> {
    const generation = (this.generations.get(el) ?? 0) + 1;
    this.generations.set(el, generation);

    const shadow = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
    this.setState(el, 'loading');
    if (el.dataset.pwMinHeight) {
      el.style.minHeight = /^\d+$/.test(el.dataset.pwMinHeight) ? `${el.dataset.pwMinHeight}px` : el.dataset.pwMinHeight;
    }

    const request = readRequest(el);
    let response: IRecommendationsResponse;
    try {
      response = await this.recommendations.fetch(request);
    } catch (error) {
      if (this.generations.get(el) !== generation) return;
      Logger.error(error, 'Pushwoosh: recommendations block failed to load');
      shadow.replaceChildren();
      this.setState(el, 'error');

      return;
    }
    if (this.generations.get(el) !== generation) return;

    if (!response.items?.length) {
      // the site hides its own frame around an empty block by this state
      shadow.replaceChildren();
      this.setState(el, 'empty');

      return;
    }

    shadow.replaceChildren(...this.build(el, request, response));
    this.setState(el, 'ready');
  }

  private build(el: HTMLElement, request: IRecommendationsRequest, response: IRecommendationsResponse): Node[] {
    const doc = this.root;
    const style = doc.createElement('style');
    style.textContent = RECOMMENDATIONS_STYLES;
    const nodes: Node[] = [style];

    const fellBack = response.strategy !== request.strategy;
    const title = fellBack && el.dataset.pwFallbackTitle ? el.dataset.pwFallbackTitle : el.dataset.pwTitle;
    if (title) {
      const heading = doc.createElement('div');
      heading.className = 'title';
      heading.setAttribute('part', 'title');
      heading.textContent = title;
      nodes.push(heading);
    }

    const grid = doc.createElement('div');
    grid.className = 'grid';
    grid.setAttribute('part', 'grid');
    response.items.forEach((item, index) => grid.appendChild(this.card(item, index + 1, request.block, response.strategy)));
    nodes.push(grid);

    return nodes;
  }

  private card(item: IRecommendedProduct, position: number, block: string | undefined, strategy: string): HTMLElement {
    const doc = this.root;
    const card = doc.createElement('a');
    card.className = 'card';
    card.setAttribute('part', 'card');
    const href = safeHref(item.url);
    if (href) card.href = href;
    card.addEventListener('click', () => {
      void this.recommendations.trackClick({ block, strategy, productId: item.id, position })
        .catch((error) => Logger.error(error, 'Pushwoosh: failed to report a recommendation click'));
    });

    if (item.image_url && safeHref(item.image_url)) {
      const image = doc.createElement('img');
      image.className = 'image';
      image.loading = 'lazy';
      image.alt = item.title;
      image.src = item.image_url;
      card.appendChild(image);
    }

    const name = doc.createElement('span');
    name.className = 'name';
    name.textContent = item.title;
    card.appendChild(name);

    if (item.price_formatted) {
      const price = doc.createElement('span');
      price.className = 'price';
      price.textContent = item.price_formatted;
      if (item.old_price_formatted) {
        const old = doc.createElement('span');
        old.className = 'old';
        old.textContent = item.old_price_formatted;
        price.appendChild(old);
      }
      card.appendChild(price);
    }

    return card;
  }

  private setState(el: HTMLElement, state: TRecommendationsState): void {
    el.setAttribute('data-pw-state', state);
  }

  private onMutations(mutations: MutationRecord[]): void {
    const dirty = new Set<HTMLElement>();
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        if ((mutation.target as HTMLElement).matches?.(CONTAINER_SELECTOR)) dirty.add(mutation.target as HTMLElement);

        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(CONTAINER_SELECTOR)) dirty.add(node);
        node.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR).forEach((el) => dirty.add(el));
      });
    });
    dirty.forEach((el) => void this.render(el));
  }
}
