import { KEY_SDK_USAGE_REPORTED_ON, SdkUsage } from '../SdkUsage';

describe('SdkUsage', () => {
  beforeEach(() => localStorage.clear());

  it('reports names of init keys one level deep, never values', () => {
    const usage = new SdkUsage();
    const send = jest.fn().mockResolvedValue(undefined);

    usage.recordInitParams({
      applicationCode: 'AAAAA-BBBBB',
      userId: 'secret-user',
      subscribeWidget: { enable: true, position: { top: 1 } },
      tags: ['a'],
    });
    usage.flush(send);

    const [report, init] = send.mock.calls[0];
    expect(report.init_keys).toEqual([
      'applicationCode', 'userId', 'subscribeWidget', 'subscribeWidget.enable', 'subscribeWidget.position', 'tags',
    ]);
    expect(JSON.stringify(report)).not.toContain('secret-user');
    expect(init).toEqual({ keepalive: true });
  });

  it('keeps legacy and new events apart, each name once', () => {
    const usage = new SdkUsage();
    const send = jest.fn().mockResolvedValue(undefined);

    usage.recordLegacyEvent('onReady');
    usage.recordLegacyEvent('onReady');
    usage.recordEvent('subscribe');
    usage.flush(send);

    expect(send.mock.calls[0][0]).toMatchObject({ events: ['subscribe'], legacy_events: ['onReady'] });
  });

  it('sends at most once a day', () => {
    const usage = new SdkUsage();
    const send = jest.fn().mockResolvedValue(undefined);

    usage.flush(send);
    usage.flush(send);
    expect(send).toHaveBeenCalledTimes(1);

    localStorage.setItem(KEY_SDK_USAGE_REPORTED_ON, '2000-01-01');
    usage.flush(send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('flushes when the page is hidden', () => {
    const usage = new SdkUsage();
    const send = jest.fn().mockResolvedValue(undefined);

    usage.listen(send);
    window.dispatchEvent(new Event('pagehide'));

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed send', async () => {
    const usage = new SdkUsage();
    const send = jest.fn().mockRejectedValue(new Error('offline'));

    expect(() => usage.flush(send)).not.toThrow();
    await Promise.resolve();
  });
});
