import { SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE } from './SubscriptionPromptWidget.constants';
import { type ISubscriptionPromptWidgetParams } from './SubscriptionPromptWidget.types';

export const getHTML = (params: ISubscriptionPromptWidgetParams): string => {
  return `
  <div id="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}-root" class="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}">
    <div class="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__body">
      <div class="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__header">
        ${params.headerText}
      </div>
      <div class="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__description">
        ${params.subheaderText}
      </div>
      <div class="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__controls">
        <button type="button" id="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}-decline" class="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__control ${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__control_decline">
          ${params.buttonCancelText}
        </button>
        <button type="button" id="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}-accept" class="${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__control ${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__control_accept">
          ${params.buttonAcceptText}
        </button>
      </div>
    </div>
  </div>
  `;
};

export const getStyles = (params: ISubscriptionPromptWidgetParams) => {
  const styles = document.createElement('style');

  styles.innerHTML = `
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE} * {
      box-sizing: border-box!important;
    }
  
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE} {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      margin: 0 auto;
      width: 320px;
      display: none;
      z-index: 2147483648;
      opacity: 0.99;
    }
    
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}_show {
      display: block;
    }
    
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__body {
      width: 320px;
      background-color: ${params.backgroundColor ? params.backgroundColor : '#FFFFFF'};
      box-shadow: 0 9px 15px rgba(0, 0, 0, 0.1), 0 0 6px rgba(0, 0, 0, 0.06);
      border-radius: 4px;
      padding: 20px 20px 12px;
    }
    
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__header {
      color: ${params.headerTextColor};
      font-size: 18px;
      font-weight: bold; 
    }
    
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__description {
      color: ${params.subheaderTextColor};
      font-size: 14px;
      line-height: 1.5;
      margin-top: 14px;
    }
    
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__description:empty {
      display: none;
    }
    
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__controls {
      display: flex;
      flex-wrap: nowrap;
      justify-content: flex-end;
      margin: 20px 0 0;
    }
    
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__control {
      -webkit-appearance: none;
      border: 1px solid transparent;
      font-size: 12px;
      font-weight: bold;
      padding: 0 20px;
      height: 32px;
      cursor: pointer;
    }
    
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__control_decline {
      color: ${params.buttonCancelTextColor};
      background-color: ${params.buttonCancelBackgroundColor};
      border-radius: ${params.buttonCancelRound};
      border-color: ${params.buttonCancelBorderColor};
    }
    
    .${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}__control_accept {
      color: ${params.buttonAcceptTextColor};
      background-color: ${params.buttonAcceptBackgroundColor};
      border-radius: ${params.buttonAcceptRound};
      border-color: ${params.buttonAcceptBorderColor};
      margin: 0 0 0 12px;
    }
  `;

  return styles;
};
