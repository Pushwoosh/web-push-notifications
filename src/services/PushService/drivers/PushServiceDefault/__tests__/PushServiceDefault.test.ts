import { type Api } from '../../../../../modules/Api/Api';
import { type Data } from '../../../../../modules/Data/Data';
import { PushServiceDefault } from '../PushServiceDefault';

function buildDriver(dataOverrides: object = {}, subscription: object | null = null) {
  const data = <Data><unknown>{
    getLastPermissionStatus: jest.fn().mockResolvedValue(undefined),
    setLastPermissionStatus: jest.fn().mockResolvedValue(undefined),
    getTokens: jest.fn().mockResolvedValue({}),
    getIsVapidChanged: jest.fn().mockResolvedValue(false),
    ...dataOverrides,
  };
  const driver = new PushServiceDefault(<Api>{}, data, {});

  // getServiceWorkerRegistration short-circuits on a cached registration, which
  // keeps the test off navigator.serviceWorker.
  (<{ registration: unknown }><unknown>driver).registration = {
    pushManager: { getSubscription: jest.fn().mockResolvedValue(subscription) },
  };

  return { driver, data };
}

function setPermission(permission: NotificationPermission): void {
  (<{ Notification: unknown }><unknown>globalThis).Notification = { permission };
}

describe('checkIsNeedResubscribe', () => {
  it('does not resubscribe a first-time visitor who was never asked', async () => {
    setPermission('default');
    const { driver, data } = buildDriver();

    await expect(driver.checkIsNeedResubscribe()).resolves.toBe(false);
    expect(data.setLastPermissionStatus).toHaveBeenCalledWith('default');
  });

  it('resubscribes when the permission changed since the last visit', async () => {
    setPermission('granted');
    const { driver } = buildDriver({ getLastPermissionStatus: jest.fn().mockResolvedValue('default') });

    await expect(driver.checkIsNeedResubscribe()).resolves.toBe(true);
  });

  it('resubscribes a first-time visitor whose subscription is out of sync', async () => {
    setPermission('granted');
    const { driver } = buildDriver({}, { endpoint: 'https://push/endpoint' });

    await expect(driver.checkIsNeedResubscribe()).resolves.toBe(true);
  });

  it('resubscribes when the vapid key changed', async () => {
    setPermission('default');
    const { driver } = buildDriver({
      getLastPermissionStatus: jest.fn().mockResolvedValue('default'),
      getIsVapidChanged: jest.fn().mockResolvedValue(true),
    });

    await expect(driver.checkIsNeedResubscribe()).resolves.toBe(true);
  });
});
