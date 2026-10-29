import { type WebPopup } from './types';
import { type Pushwoosh } from '../../core/Pushwoosh';
import { type TPushPermissionStatus } from '../../services/PushService/pushPermissionStatus';

// The campaign value for each status the SDK reports in the Push Permission Status tag.
const CAMPAIGN_VALUE: Record<TPushPermissionStatus, string> = {
  not_determined: 'DEFAULT',
  granted_explicit: 'GRANTED',
  denied: 'DENIED',
  unsupported: 'UNSUPPORTED',
};

const CONDITIONS = new Set(Object.values(CAMPAIGN_VALUE));

// An npm core can be older than this CDN widget, and legacy Safari throws outside its push package.
function readCampaignValue(pw: Pushwoosh): string | undefined {
  if (typeof pw.getPushPermissionStatus !== 'function') {
    return undefined;
  }

  try {
    return CAMPAIGN_VALUE[pw.getPushPermissionStatus()];
  } catch {
    return undefined;
  }
}

/** Absent, empty, unknown or ALL lets everyone through; a status that can't be read lets nothing else through. */
export function matchesPushPermission(pw: Pushwoosh, popup: WebPopup): boolean {
  const required = popup.push_permission_status?.toUpperCase();

  if (!required || !CONDITIONS.has(required)) {
    return true;
  }

  return readCampaignValue(pw) === required;
}
