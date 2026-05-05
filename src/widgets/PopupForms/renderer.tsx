import { render } from 'preact';
import { type BuilderDocument, DocumentReader } from 'smart-blocks-utils';

import { DEFAULT_DOCUMENT_WIDTH } from './constants';
import { type PopupFormContent } from './types';

export const renderPopupForm = (container: HTMLElement, content: PopupFormContent): void => {
  const parsedJson = parsePopupFormJson(content.json);
  if (!parsedJson) {
    return;
  }

  const width = parsedJson.settings?.width ?? DEFAULT_DOCUMENT_WIDTH;
  container.style.width = `${width}px`;
  container.style.maxWidth = '100%';

  render(
    <DocumentReader document={parsedJson} />,
    container,
  );
};

const parsePopupFormJson = (json: string): BuilderDocument | null => {
  try {
    return JSON.parse(json) as BuilderDocument;
  } catch {
    return null;
  }
};
