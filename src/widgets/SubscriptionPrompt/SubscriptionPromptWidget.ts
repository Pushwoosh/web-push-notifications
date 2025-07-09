import { SUBSCRIPTION_WIDGET_USE_CASE_DEFAULT, SUBSCRIPTION_WIDGET_USE_CASE_NOT_SET } from './constants';
import { checkCanShowByCapping, getWidgetConfig, updateCappingParams } from './helpers';
import { SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE } from './SubscriptionPromptWidget.constants';
import { getHTML, getStyles } from './SubscriptionPromptWidget.helpers';
import { type ISubscriptionPromptWidgetParams } from './SubscriptionPromptWidget.types';
import { type Pushwoosh } from '../../core/Pushwoosh';

export class PWSubscriptionPromptWidget {
  private readonly pw: Pushwoosh;

  constructor(pw: Pushwoosh) {
    this.pw = pw;
  };

  public async run(): Promise<void> {
    const { pw } = this;

    const features = await pw.data.getFeatures();
    const widgetConfig = getWidgetConfig(features);
    const canShowByCapping = await checkCanShowByCapping(widgetConfig, pw);
    if (!canShowByCapping) {
      return;
    }

    const currentPromptUseCase = features['subscription_prompt']?.['use_case'];

    // show subscription prompt widget
    const isDefaultUseCase = currentPromptUseCase === SUBSCRIPTION_WIDGET_USE_CASE_DEFAULT;
    const isNotSetUseCase = currentPromptUseCase === SUBSCRIPTION_WIDGET_USE_CASE_NOT_SET && pw.initParams.autoSubscribe;

    // show subscription prompt widget
    if (isDefaultUseCase || isNotSetUseCase) {
      this.init(widgetConfig);
      this.show();
      pw.moduleRegistry.subscriptionPrompt = this;
    }

    await updateCappingParams(pw);
  }

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
    this.pw.dispatchEvent('show-subscription-widget', {});

    rootElement.classList.add(`${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}_show`);
  }

  public hide(): void {
    const rootElement = this.getRootElementWithCheckExist();

    if (rootElement.classList.contains(`${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}_show`)) {
      this.pw.dispatchEvent('hide-subscription-widget', {});
      rootElement.classList.remove(`${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}_show`);
    }
  }

  private getRootElement(): HTMLElement | null {
    return document.getElementById(`${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}-root`);
  }

  private getRootElementWithCheckExist(): HTMLElement {
    const element = this.getRootElement();

    if (!element) {
      throw new Error(`Can't find element by id "${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}-root", please use method init first.`);
    }

    return element;
  }

  private getDeclineButtonWithCheckExist(): HTMLButtonElement {
    const element = document.getElementById(`${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}-decline`) as HTMLButtonElement;

    if (!element) {
      throw new Error(`Can't find element by id "${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}-decline", please use method init first.`);
    }

    return element;
  }

  private getAcceptButtonWithCheckExist(): HTMLButtonElement {
    const element = document.getElementById(`${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}-accept`) as HTMLButtonElement;

    if (!element) {
      throw new Error(`Can't find element by id "${SUBSCRIPTION_PROMPT_WIDGET_NAMESPACE}-accept", please use method init first.`);
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
