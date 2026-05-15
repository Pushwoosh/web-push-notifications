export type IPopupFormsConfig = {
  enable: boolean;
};

export type PopupForm = {
  code: string;
  popup_form_content_code: string;
  device_type: 'ALL' | 'DESKTOP' | 'MOBILE';
  visitors_type: 'ALL' | 'NEW' | 'RECURRING';
  matching_pages: string[];
  delay: number;
  frequency: 'ONCE' | 'ONCE_PER_SESSION' | 'EVERY_VISIT';
};

export type PopupFormContent = {
  code: string;
  json: string;
  html: string | null;
};
