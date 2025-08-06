import { SUBSCRIPTION_PROMPT_WIDGET_DEFAULT_CONFIG } from './constants';
import type { ISubscriptionPromptWidgetParams } from './SubscriptionPromptWidget.types';
import type { Pushwoosh } from '../../core/Pushwoosh';

export const getWidgetConfig = (features: any): ISubscriptionPromptWidgetParams => {
  // get config by features from get config method
  const currentConfig = features['subscription_prompt_widget'] && features['subscription_prompt_widget'].params;

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

export const updateCappingParams = async (pw: Pushwoosh): Promise<void> => {
  const displayCount = await pw.data.getPromptDisplayCount();
  const currentTime = new Date().getTime();

  await pw.data.setPromptDisplayCount(displayCount + 1);
  await pw.data.setPromptLastSeenTime(currentTime);
};
