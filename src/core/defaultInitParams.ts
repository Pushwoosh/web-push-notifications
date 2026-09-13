import { DEFAULT_SERVICE_WORKER_URL } from './constants';

export const defaultInitParams = {
  autoSubscribe: true,
  serviceWorkerUrl: DEFAULT_SERVICE_WORKER_URL,
} as const;
