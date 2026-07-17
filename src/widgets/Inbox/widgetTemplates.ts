import { getMessageTime } from './helpers';
import { type IInboxMessagePublic } from '../../models/InboxMessages.types';

export const widgetTemplate = (title: string): string => `
<div class="pw-inbox__arrow"></div>
<div class="pw-inbox_inner">
    <div class="pw-inbox_title">
      ${title}
    </div>
    <ul class="pw-inbox_list">

    </ul>
</div>`;

export const widgetTemplateEmpty = (
  emptyInboxIconUrl: string,
  emptyInboxTitle: string,
  emptyInboxText: string,
) => `
<div class="pw-inbox__arrow"></div>
<div class="pw-inbox_list--empty">
    <div class="pw-inbox_list-icon">
      <img src="${emptyInboxIconUrl}" alt="${emptyInboxTitle}">
    </div>
    <div class="pw-inbox_list-title">
      ${emptyInboxTitle}
    </div>
    <div class="ipw-inbox_list-body">
      ${emptyInboxText}
    </div>
</div>`;

export const messageTemplate = ({
  imageUrl,
  title,
  message,
  sendDate,
}: IInboxMessagePublic) => `
<div class="pw-inbox_item-inner">
  <div class="pw-inbox_icon">
    <img src="${imageUrl}" alt="${title || message}" class="pw-inbox_message-image">
  </div>
  <div class="pw-inbox_content">
    ${title ? `<div class="pw-inbox_item-title">
      ${title}
    </div>` : null}
    <div class="pw-inbox_item-body">
      ${message}
    </div>
    <div class="pw-inbox_item-time">
      ${getMessageTime(sendDate)}
    </div>
  </div>
</div>
<span class="pw-inbox_item-remove"></span>`;
