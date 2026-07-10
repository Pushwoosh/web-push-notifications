export type IWebPopupsConfig = {
  enable: boolean;
};

export type WebPopup = {
  code: string;
  popup_form_content_code: string;
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
