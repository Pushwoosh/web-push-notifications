import * as CONSTANTS from '../../core/constants';

export type TPushPermissionStatus = 'not_determined' | 'granted_explicit' | 'denied' | 'unsupported';

// Browsers grant notifications only on a user gesture, so 'granted' is always explicit.
export function mapPushPermission(permission: NotificationPermission | undefined): TPushPermissionStatus {
  switch (permission) {
    case CONSTANTS.PERMISSION_GRANTED:
      return 'granted_explicit';
    case CONSTANTS.PERMISSION_DENIED:
      return 'denied';
    default:
      return 'not_determined';
  }
}

function legacySafariApi(global: typeof globalThis): Window['safari']['pushNotification'] | undefined {
  return 'safari' in global ? (<Pick<Window, 'safari'>>global).safari?.pushNotification : undefined;
}

// Undefined when the API throws, as it does for a domain outside the push package.
function readLegacySafariPermission(global: typeof globalThis, safariWebsitePushId: string): IPushServiceSafariInfo | undefined {
  try {
    return legacySafariApi(global)?.permission(safariWebsitePushId);
  } catch {
    return undefined;
  }
}

// Pass safariWebsitePushId only when the legacy Safari driver is the one in use:
// its permission is separate from Notification.permission.
export function readPushPermissionStatus(global: typeof globalThis, safariWebsitePushId?: string): TPushPermissionStatus {
  const legacySafari = legacySafariApi(global);

  if (legacySafari && safariWebsitePushId) {
    const info = readLegacySafariPermission(global, safariWebsitePushId);

    return info ? mapPushPermission(info.permission) : 'unsupported';
  }

  if ('PushManager' in global && 'Notification' in global) {
    return mapPushPermission(global.Notification.permission);
  }

  return legacySafari ? 'not_determined' : 'unsupported';
}

// A granted legacy permission comes with the APNs token; nothing else counts as a live subscription.
export function hasLegacySafariSubscription(global: typeof globalThis, safariWebsitePushId?: string): boolean {
  const info = safariWebsitePushId ? readLegacySafariPermission(global, safariWebsitePushId) : undefined;

  return info?.permission === CONSTANTS.PERMISSION_GRANTED && !!info.deviceToken;
}
