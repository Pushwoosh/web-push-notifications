export type TRecommendationStrategy = 'viewed' | 'bestsellers_30d' | 'also_bought';

export interface IRecommendationsConfig {
  /** Base URL of the onsite feed; the NUE deployment by default. */
  endpoint?: string;
  /** `false` keeps the widget bundle off even with `[data-pw-recommendations]` on the page. */
  widget?: boolean;
  /** Single-page apps: keep watching for blocks rendered after load. Off by default, so other sites carry no observer. */
  spa?: boolean;
}

export interface IProductView {
  id: string;
  name?: string;
  price?: number;
  currency?: string;
  category?: string;
  url?: string;
  imageUrl?: string;
}

export interface IRecommendationsRequest {
  strategy: TRecommendationStrategy;
  /** Served when the strategy has nothing; `bestsellers_30d` by default, `none` for an empty answer. */
  fallback?: TRecommendationStrategy | 'none';
  limit?: number;
  /** The anchor of `also_bought`: the product on screen. */
  productId?: string;
  /** Products not to show: the cart, the product on screen. */
  exclude?: string[];
  /** Marks the links and the click event, so a click is traced back to the block. */
  block?: string;
}

export interface IRecommendedProduct {
  id: string;
  title: string;
  description: string;
  image_url: string;
  url: string;
  price: number;
  price_formatted: string;
  old_price_formatted?: string;
  currency: string;
  category: string;
  sku: string;
}

export interface IRecommendationsResponse {
  items: IRecommendedProduct[];
  /** The strategy actually served: the fallback one, or `none` for an empty answer. */
  strategy: TRecommendationStrategy | 'none';
}

export interface IRecommendationClick {
  block?: string;
  strategy?: string;
  productId: string;
  /** 1-based place of the product in the block. */
  position?: number;
}
