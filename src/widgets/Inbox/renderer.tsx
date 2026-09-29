import { render } from 'preact';

import {
  InboxWidgetReader, type InboxWidgetAppearance, type InboxWidgetMessage,
} from '@pushwoosh/websdk-common/inbox';

import { type IInboxMessagePublic } from '../../models/InboxMessages.types';

/** Clicks the reader reports back; the widget owns the actions, this module only renders. */
export type InboxWidgetHandlers = {
  onMessageClick: (code: string) => void;
  onMessageRemove: (code: string) => void;
  onSlideLinkClick: (code: string, link: string) => void;
};

// `heroUrl` already carries the icon fallback and `layout` is resolved, so the
// reader can only degrade it, never re-run the heuristic on the default title.
export const toInboxWidgetMessage = (message: IInboxMessagePublic): InboxWidgetMessage => ({
  code: message.code,
  title: message.title,
  body: message.message,
  iconUrl: message.iconUrl,
  bannerUrl: message.heroUrl,
  layoutType: message.layout,
  carousel: message.carousel,
  sendDate: message.sendDate,
  isRead: message.isRead,
  isActionPerformed: message.isActionPerformed,
});

export const renderInboxWidget = (
  container: HTMLElement,
  messages: Array<IInboxMessagePublic>,
  appearance: InboxWidgetAppearance,
  handlers: InboxWidgetHandlers,
): void => {
  render(
    <InboxWidgetReader
      mode="live"
      messages={messages.map(toInboxWidgetMessage)}
      appearance={appearance}
      onMessageClick={handlers.onMessageClick}
      onMessageRemove={handlers.onMessageRemove}
      onSlideLinkClick={handlers.onSlideLinkClick}
    />,
    container,
  );
};
