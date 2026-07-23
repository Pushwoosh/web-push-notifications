export type IWebPopupsConfig = {
  enable: boolean;
};

export type PageRuleOperator = 'EQUALS' | 'STARTS_WITH' | (string & {});

// A page rule: a path plus a match operator. Shared by the operator-aware
// Specified-pages include list and the exclude list.
export type PageRule = {
  path: string;
  operator: PageRuleOperator;
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
  // Operator-aware "Specified pages" include rules; preferred over matching_pages
  // when present. Absent on older backends.
  matching_page_rules?: PageRule[];
  excluded_pages?: PageRule[];
  delay: number;
  frequency: 'ONCE' | 'ONCE_PER_SESSION' | 'EVERY_VISIT';
};

export type WebPopupContent = {
  code: string;
  json: string;
  html: string | null;
};
