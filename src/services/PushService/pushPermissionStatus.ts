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

// Pass safariWebsitePushId only when the legacy Safari driver is the one in use:
// its permission is separate from Notification.permission.
export function readPushPermissionStatus(global: typeof globalThis, safariWebsitePushId?: string): TPushPermissionStatus {
  const legacySafari = 'safari' in global ? (<Pick<Window, 'safari'>>global).safari?.pushNotification : undefined;

  if (legacySafari && safariWebsitePushId) {
    try {
      return mapPushPermission(legacySafari.permission(safariWebsitePushId).permission);
    } catch {
      return 'unsupported';
    }
  }

  if ('PushManager' in global && 'Notification' in global) {
    return mapPushPermission(global.Notification.permission);
  }

  return legacySafari ? 'not_determined' : 'unsupported';
}
