interface IInnerTemplate {
  iconUrl?: string;
  iconAlt?: string;
  text: string;
  askLaterButtonText: string;
  confirmSubscriptionButtonText: string;
}

export const innerTemplate = ({ iconUrl, iconAlt, text, askLaterButtonText, confirmSubscriptionButtonText }: IInnerTemplate): string => {
  return `<div class="pw-subscription-popup-inner">
    <div class="pw-subscription-popup-content">
      ${iconUrl
        ? `<div class="pw-subscription-popup-icon"><img src="${iconUrl}" alt="${iconAlt || 'Subscribe'}"></div>`
        : ''}
      <div class="pw-subscription-popup-text">
        ${text}
      </div>
    </div>
    <div class="pw-subscription-popup-controls">
      <button name="pwAskLater" class="pw-subscribe-popup-button">${askLaterButtonText}</button>
      <button name="pwSubscribe" class="pw-subscribe-popup-button pw-subscribe-popup-button-active">${confirmSubscriptionButtonText}</button>
    </div>
  </div>`;
};
