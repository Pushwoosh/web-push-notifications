import type { PopupForm } from './types';

export const getPopupForms = (features: unknown): Array<PopupForm> => {
  if (typeof features !== 'object' || features === null) {
    return [];
  }

  const popupForms = (features as Record<string, unknown>)['popup_forms'];
  if (!Array.isArray(popupForms)) {
    return [];
  }

  return popupForms as Array<PopupForm>;
};
