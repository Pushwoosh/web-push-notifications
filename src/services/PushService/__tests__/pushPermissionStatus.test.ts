import { mapPushPermission, readPushPermissionStatus } from '../pushPermissionStatus';

function buildGlobal(props: object): typeof globalThis {
  return <typeof globalThis><unknown>props;
}

describe('mapPushPermission', () => {
  it.each([
    ['default', 'not_determined'],
    ['granted', 'granted_explicit'],
    ['denied', 'denied'],
    [undefined, 'not_determined'],
  ] as const)('maps %s to %s', (permission, expected) => {
    expect(mapPushPermission(permission)).toBe(expected);
  });
});

describe('readPushPermissionStatus', () => {
  it('reads Notification.permission where the Push API exists', () => {
    const global = buildGlobal({ PushManager: {}, Notification: { permission: 'denied' } });

    expect(readPushPermissionStatus(global)).toBe('denied');
  });

  it('reports unsupported without PushManager, as iOS Safari outside a home screen app', () => {
    const global = buildGlobal({ Notification: { permission: 'default' } });

    expect(readPushPermissionStatus(global)).toBe('unsupported');
  });

  it('reports unsupported without any Push API', () => {
    expect(readPushPermissionStatus(buildGlobal({}))).toBe('unsupported');
  });

  it('reads the legacy Safari permission for the website push ID', () => {
    const permission = jest.fn().mockReturnValue({ permission: 'granted' });
    const global = buildGlobal({
      safari: { pushNotification: { permission } },
      PushManager: {},
      Notification: { permission: 'default' },
    });

    expect(readPushPermissionStatus(global, 'web.com.example')).toBe('granted_explicit');
    expect(permission).toHaveBeenCalledWith('web.com.example');
  });

  it('ignores legacy Safari when its driver is not in use', () => {
    const global = buildGlobal({
      safari: { pushNotification: { permission: () => ({ permission: 'granted' }) } },
      PushManager: {},
      Notification: { permission: 'denied' },
    });

    expect(readPushPermissionStatus(global)).toBe('denied');
  });

  it('does not report unsupported for legacy Safari without a website push ID', () => {
    const global = buildGlobal({ safari: { pushNotification: { permission: () => ({ permission: 'granted' }) } } });

    expect(readPushPermissionStatus(global)).toBe('not_determined');
  });
});
