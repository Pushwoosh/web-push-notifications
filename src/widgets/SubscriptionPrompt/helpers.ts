import {
  SUBSCRIPTION_PROMPT_WIDGET_DEFAULT_CONFIG,
  SUBSCRIPTION_WIDGET_USE_CASE_NOT_SET,
  SUBSCRIPTION_WIDGET_USE_CASE_NOT_USED,
} from './constants';
import type { ISubscriptionPromptWidgetParams } from './SubscriptionPromptWidget.types';
import type { Pushwoosh } from '../../core/Pushwoosh';

export const getWidgetConfig = (features: any): ISubscriptionPromptWidgetParams => {
  // get config by features from get config method
  const currentConfig = features?.['subscription_prompt_widget'] && features['subscription_prompt_widget'].params;

  // merge current config with capping defaults
  const configWithDefaultCapping: ISubscriptionPromptWidgetParams = {
    cappingCount: SUBSCRIPTION_PROMPT_WIDGET_DEFAULT_CONFIG.cappingCount,
    cappingDelay: SUBSCRIPTION_PROMPT_WIDGET_DEFAULT_CONFIG.cappingDelay,
    ...currentConfig,
  };

  // if current config is not exist show with default values
  return currentConfig
    ? configWithDefaultCapping
    : SUBSCRIPTION_PROMPT_WIDGET_DEFAULT_CONFIG;
};

export const checkCanShowByCapping = async (widgetConfig: ISubscriptionPromptWidgetParams, pw: Pushwoosh): Promise<boolean> => {
  const currentTime = new Date().getTime();
  const displayCount = await pw.data.getPromptDisplayCount();
  const lastSeenTime = await pw.data.getPromptLastSeenTime();

  // can show by max display count
  const canShowByCapping = widgetConfig.cappingCount > displayCount;

  // can show last seen time
  const canShowByLastTime = currentTime - lastSeenTime > widgetConfig.cappingDelay;

  return canShowByCapping && canShowByLastTime;
};

// Shared by the widget and by the entry point that decides whether to fetch
// the widget bundle at all, so both answer the same question in one place.
export const getSubscriptionPromptSkipReason = async (
  features: any,
  pw: Pushwoosh,
  widgetConfig: ISubscriptionPromptWidgetParams = getWidgetConfig(features),
): Promise<string | null> => {
  const useCase = features?.['subscription_prompt']?.['use_case'];

  if (useCase === SUBSCRIPTION_WIDGET_USE_CASE_NOT_USED) {
    return 'the application uses its own subscription prompt';
  }

  if (useCase === SUBSCRIPTION_WIDGET_USE_CASE_NOT_SET && !pw.initParams.autoSubscribe) {
    return 'the subscription prompt use case is not set and autoSubscribe is off';
  }

  if (!await checkCanShowByCapping(widgetConfig, pw)) {
    return 'the subscription prompt capping is exhausted';
  }

  // Absent features (older backend, failed loadConfig) keep the previous
  // behaviour: the bundle is fetched and the widget decides for itself.
  return null;
};

export const updateCappingParams = async (pw: Pushwoosh): Promise<void> => {
  const displayCount = await pw.data.getPromptDisplayCount();
  const currentTime = new Date().getTime();

  await pw.data.setPromptDisplayCount(displayCount + 1);
  await pw.data.setPromptLastSeenTime(currentTime);
};
