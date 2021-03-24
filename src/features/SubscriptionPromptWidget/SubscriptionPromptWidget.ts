import { EventBus } from '../../core/modules/EventBus';

import { EVENT_ON_SHOW_SUBSCRIPTION_WIDGET, EVENT_ON_HIDE_SUBSCRIPTION_WIDGET } from '../../constants';

import { getHTML, getStyles } from './SubscriptionPromptWidget.helpers';
import { SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE } from './SubscriptionPromptWidget.constants';

import { ISubscriptionPromptWidgetParams } from './SubscriptionPromptWidget.types';

export class SubscriptionPromptWidget {
  private readonly eventBus: EventBus;
  private readonly pw: any;

  constructor(eventBus: EventBus, pw: any) {
    this.eventBus = eventBus;
    this.pw = pw;
  };

  public init(params: ISubscriptionPromptWidgetParams): void {
    const rootElement = this.getRootElement();

    // if root element not exist
    // create widget
    if (!rootElement) {
      const html = getHTML(params);
      const styles = getStyles(params);

      // append popup to body
      document.body.insertAdjacentHTML('beforeend', html);

      // append styles to head
      document.head.appendChild(styles);
    }

    this.addEventListeners();
  }

  public show(): void {
    const rootElement = this.getRootElementWithCheckExist();
    this.eventBus.dispatchEvent('show-subscription-widget', {});

    rootElement.classList.add(`${ SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE }_show`);
  }

  public hide(): void {
    const rootElement = this.getRootElementWithCheckExist();

    if (rootElement.classList.contains(`${ SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE }_show`)) {
      this.eventBus.dispatchEvent('hide-subscription-widget', {});
      rootElement.classList.remove(`${ SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE }_show`);
    }
  }

  private getRootElement(): HTMLElement | null {
    return document.getElementById(`${ SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE }-root`);
  }

  private getRootElementWithCheckExist(): HTMLElement {
    const element = this.getRootElement();

    if (!element) {
      throw new Error(`Can't find element by id "${ SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE }-root", please use method init first.`);
    }

    return element;
  }

  private getDeclineButtonWithCheckExist(): HTMLButtonElement {
    const element = document.getElementById(`${ SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE }-decline`) as HTMLButtonElement;

    if (!element) {
      throw new Error(`Can't find element by id "${ SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE }-decline", please use method init first.`);
    }

    return element;
  }

  private getAcceptButtonWithCheckExist(): HTMLButtonElement {
    const element = document.getElementById(`${ SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE }-accept`) as HTMLButtonElement;

    if (!element) {
      throw new Error(`Can't find element by id "${ SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE }-accept", please use method init first.`);
    }

    return element;
  }

  private addEventListeners(): void {
    const rootElement = this.getRootElementWithCheckExist();
    const declineElement = this.getDeclineButtonWithCheckExist();
    const acceptElement = this.getAcceptButtonWithCheckExist();

    document.addEventListener('click', (event) => {
      if (!rootElement.contains((event.target as HTMLElement))) {
        this.hide();
      }
    });

    declineElement.addEventListener('click', () => {
      this.hide();
    });

    acceptElement.addEventListener('click', () => {
      this.hide();
      this.pw.subscribe();
    });
  }
}
