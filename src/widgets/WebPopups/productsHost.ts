import {
  collectWebPopupProductSlots, loadWebPopupProducts,
  type WebPopupParams, type WebPopupProductsHost,
} from '@pushwoosh/websdk-common/web-popups';

import { WEB_POPUPS_LOG_PREFIX } from './constants';
import { Logger } from '../../core/logger';
import { type Recommendations } from '../../modules/Recommendations/Recommendations';

/** Products slots load from the onsite recommendations feed; a click goes out as PW_RecommendationClick. */
export function createProductsHost(recommendations: Pick<Recommendations, 'fetch' | 'trackClick'>): WebPopupProductsHost {
  return {
    load: async (slot) => {
      const fallback = slot.fallbackStrategy ?? 'none';
      const request = { limit: slot.limit, block: slot.key };
      // The feed serves the fallback itself when the strategy is empty; the slot's own, never the server default.
      const response = await recommendations.fetch({ ...request, strategy: slot.strategy, fallback }).catch((error) => {
        // A strategy this feed does not know yet is a 400 that would take the fallback down with it.
        if (fallback === 'none' || fallback === slot.strategy) {
          throw error;
        }
        Logger.error(error, `${WEB_POPUPS_LOG_PREFIX} products slot "${slot.key}": strategy "${slot.strategy}" failed, trying "${fallback}"`);
        return recommendations.fetch({ ...request, strategy: fallback, fallback: 'none' });
      });

      return response.items.map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        currency: item.currency || undefined,
        image: item.image_url || undefined,
        url: item.url,
      }));
    },
    onClick: (product, slot) => {
      recommendations.trackClick({ block: slot.key, strategy: slot.strategy, productId: product.id }).catch((error) => {
        Logger.error(error, `${WEB_POPUPS_LOG_PREFIX} Failed to track a click on product "${product.id}" in slot "${slot.key}"`);
      });
    },
  };
}

/** False when a `hideWhenEmpty` products slot has nothing, its fallback included: the popup is then not shown at all. */
export async function webPopupProductsAvailable(params: WebPopupParams, host: WebPopupProductsHost): Promise<boolean> {
  const required = collectWebPopupProductSlots(params).filter((slot) => slot.hideWhenEmpty);
  // the same memoised answer the render gets: one request, one verdict
  const answers = await Promise.all(required.map((slot) => loadWebPopupProducts(host, slot)));

  return answers.every((items) => items.length > 0);
}
