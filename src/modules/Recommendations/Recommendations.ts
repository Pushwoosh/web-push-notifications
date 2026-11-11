import {
  type IProductView,
  type IRecommendationClick,
  type IRecommendationsRequest,
  type IRecommendationsResponse,
} from './Recommendations.types';

export const PRODUCT_VIEW_EVENT = 'PW_ProductView';
export const RECOMMENDATION_CLICK_EVENT = 'PW_RecommendationClick';
export const DEFAULT_RECOMMENDATIONS_ENDPOINT = 'https://recommender-onsite.svc-nue.pushwoosh.com';

const FEED_PATH = '/feed/v1/onsite/products.json';
const HWID_HEADER = 'X-PW-HWID';
const VIEW_DEDUP_MS = 30 * 1000;
const VIEWS_STORAGE_KEY = 'pushwoosh-recommendations-views';

export interface IRecommendationsDeps {
  postEvent: (event: string, attributes: Record<string, unknown>, init?: { keepalive?: boolean }) => Promise<unknown>;
  isCommunicationDisabled: () => boolean;
  getApplicationCode: () => Promise<string>;
  getHwid: () => Promise<string>;
  getEndpoint: () => string | undefined;
  fetch?: typeof fetch;
  now?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

// whatever the site or an older build left under the key: anything but a map of numbers counts as empty
function readViews(raw: string | null): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(Object.entries(parsed).filter(([, at]) => typeof at === 'number')) as Record<string, number>;
  } catch {
    return {};
  }
}

// sessionStorage throws when the site's storage is blocked, and is absent outside a window
function sessionStore(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // fall through to the in-memory store
  }
  const memory = new Map<string, string>();

  return { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => void memory.set(key, value) };
}

export class Recommendations {
  private readonly deps: Required<IRecommendationsDeps>;

  constructor(deps: IRecommendationsDeps) {
    this.deps = {
      fetch: (...args) => fetch(...args),
      now: Date.now,
      storage: sessionStore(),
      ...deps,
    };
  }

  /** Feeds "You viewed" and the co-occurrence pairs; one event per product in 30 s, so a reload is not a second view. */
  public async trackProductView(product: IProductView): Promise<void> {
    if (!product?.id || this.deps.isCommunicationDisabled() || this.seenRecently(String(product.id))) {
      return;
    }

    await this.deps.postEvent(PRODUCT_VIEW_EVENT, {
      productId: String(product.id),
      name: product.name,
      price: product.price,
      currency: product.currency,
      category: product.category,
      productUrl: product.url,
      imageUrl: product.imageUrl,
    });
  }

  /** Without communication consent the request goes anonymous: no hwid, so `viewed` falls back on the server. */
  public async fetch(request: IRecommendationsRequest): Promise<IRecommendationsResponse> {
    const query = new URLSearchParams({
      application: await this.deps.getApplicationCode(),
      strategy: request.strategy,
    });
    if (request.fallback) query.set('fallback', request.fallback);
    if (request.limit) query.set('limit', String(request.limit));
    if (request.productId) query.set('product_id', request.productId);
    if (request.exclude?.length) query.set('exclude', request.exclude.join(','));
    if (request.block) query.set('block', request.block);

    const headers: Record<string, string> = {};
    const hwid = this.deps.isCommunicationDisabled() ? '' : await this.deps.getHwid();
    if (hwid) headers[HWID_HEADER] = hwid;

    const endpoint = (this.deps.getEndpoint() || DEFAULT_RECOMMENDATIONS_ENDPOINT).replace(/\/+$/, '');
    const response = await this.deps.fetch(`${endpoint}${FEED_PATH}?${query}`, { headers });
    if (!response.ok) {
      throw new Error(`Pushwoosh: recommendations request failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * The product goes under `recoProductId`, not `productId`: a scalar product id feeds the viewed tail
   * and the pairs on the server, and recommendations would then reinforce themselves.
   */
  public async trackClick(click: IRecommendationClick): Promise<void> {
    if (!click?.productId || this.deps.isCommunicationDisabled()) {
      return;
    }

    await this.deps.postEvent(RECOMMENDATION_CLICK_EVENT, {
      block: click.block,
      strategy: click.strategy,
      recoProductId: String(click.productId),
      position: click.position,
    }, { keepalive: true });
  }

  private seenRecently(productId: string): boolean {
    const now = this.deps.now();
    const views = readViews(this.deps.storage.getItem(VIEWS_STORAGE_KEY));
    if (now - (views[productId] ?? -Infinity) < VIEW_DEDUP_MS) {
      return true;
    }

    const fresh: Record<string, number> = { [productId]: now };
    Object.keys(views).forEach((id) => {
      if (now - views[id] < VIEW_DEDUP_MS) fresh[id] = views[id];
    });
    try {
      this.deps.storage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // private mode or a full quota: the view still goes out, only the dedup is lost
    }

    return false;
  }
}
