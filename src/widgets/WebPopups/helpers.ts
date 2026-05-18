import type { WebPopup } from './types';

export const getWebPopups = (features: unknown): Array<WebPopup> => {
  if (typeof features !== 'object' || features === null) {
    return [];
  }

  const webPopups = (features as Record<string, unknown>)['popup_forms'];
  if (!Array.isArray(webPopups)) {
    return [];
  }

  return webPopups as Array<WebPopup>;
};
