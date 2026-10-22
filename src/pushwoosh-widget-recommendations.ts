import { type Pushwoosh } from './core/Pushwoosh';
import { RecommendationsWidget } from './widgets/Recommendations/RecommendationsWidget';

const globalPW: Pushwoosh = (globalThis as any).Pushwoosh;

globalPW.push(async () => {
  try {
    new RecommendationsWidget(globalPW.recommendations).run();
  } catch (error) {
    console.error('Error during Pushwoosh Recommendations widget initialization:', error);
  }
});
