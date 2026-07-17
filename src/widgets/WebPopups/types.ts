export type IWebPopupsConfig = {
  enable: boolean;
};

export type WebPopup = {
  code: string;
  // Exactly one of popup_form_content_code / subscription_form_code is
  // non-empty: a popup shows either a smart-blocks content or a hosted
  // subscription form. The unused field comes empty from the API, so both
  // are optional here and consumers must check before use.
  popup_form_content_code?: string;
  subscription_form_code?: string;
  device_type: 'ALL' | 'DESKTOP' | 'MOBILE';
  visitors_type: 'ALL' | 'NEW' | 'RECURRING';
  matching_pages: string[];
  delay: number;
  frequency: 'ONCE' | 'ONCE_PER_SESSION' | 'EVERY_VISIT';
};

export type WebPopupContent = {
  code: string;
  json: string;
  html: string | null;
};
