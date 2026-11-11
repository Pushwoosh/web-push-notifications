import { DEFAULT_API_URL } from '../../core/constants';

const LEGACY_PATH = /json\/1\.3\/?$/;
const DEVICE_API_PATH = 'api/v2/device-api/getFeatureFlags';

// Every host the server hands out ends with json/1.3/ (rotation, dedicated hosts, proxies with a path); any other
// entrypoint keeps its host, so flags go to the same data center as the rest of the SDK.
export function featureFlagsUrl(entrypoint: string | undefined): string {
  const base = entrypoint || DEFAULT_API_URL;
  if (LEGACY_PATH.test(base)) {
    return base.replace(LEGACY_PATH, DEVICE_API_PATH);
  }

  try {
    return `${new URL(base).origin}/${DEVICE_API_PATH}`;
  } catch (_error) {
    return DEFAULT_API_URL.replace(LEGACY_PATH, DEVICE_API_PATH);
  }
}
