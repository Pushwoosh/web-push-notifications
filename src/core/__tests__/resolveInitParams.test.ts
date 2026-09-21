import type { IInitParams } from '../Pushwoosh.types';
import { resolveInitParams } from '../resolveInitParams';

const raw = (params: Partial<IInitParams> = {}): IInitParams => ({
  applicationCode: 'XXXXX-XXXXX',
  ...params,
} as IInitParams);

describe('resolveInitParams', () => {
  it('changes nothing when the server sent no config', () => {
    expect(resolveInitParams(raw({ autoSubscribe: false }))).toEqual({});
  });

  it('takes a server value the integrator did not set', () => {
    expect(resolveInitParams(raw(), { autoSubscribe: false })).toEqual({ autoSubscribe: false });
  });

  it('keeps an explicit value even when it equals the SDK default', () => {
    expect(resolveInitParams(raw({ autoSubscribe: true }), { autoSubscribe: false })).toEqual({});
  });

  it('keeps an explicit false over the server', () => {
    expect(resolveInitParams(raw({ autoSubscribe: false }), { autoSubscribe: true })).toEqual({});
  });

  it('resolves strings the same way', () => {
    const resolved = resolveInitParams(
      raw({ defaultNotificationTitle: 'Snippet' }),
      { defaultNotificationTitle: 'Panel', defaultNotificationImage: 'https://site.tld/logo.png', safariWebsitePushID: 'web.tld.site' },
    );

    expect(resolved).toEqual({
      defaultNotificationImage: 'https://site.tld/logo.png',
      safariWebsitePushID: 'web.tld.site',
    });
  });

  it('merges subscribeWidget key by key, the snippet winning per key', () => {
    const resolved = resolveInitParams(
      raw({ subscribeWidget: { enable: true, bgColor: '#000' } }),
      { subscribeWidget: { position: 'bottomLeft', bgColor: '#12AE7E' } },
    );

    expect(resolved.subscribeWidget).toEqual({ enable: true, bgColor: '#000', position: 'bottomLeft' });
  });

  it('takes the whole widget when the snippet has none', () => {
    const resolved = resolveInitParams(raw(), { subscribeWidget: { enable: true, position: 'topRight' } });

    expect(resolved.subscribeWidget).toEqual({ enable: true, position: 'topRight' });
  });

  it('leaves the widget alone when the server did not send one', () => {
    const resolved = resolveInitParams(raw({ subscribeWidget: { enable: true } }), { autoSubscribe: false });

    expect(resolved.subscribeWidget).toBeUndefined();
  });

  it('ignores keys outside the managed set', () => {
    const resolved = resolveInitParams(raw(), { serviceWorkerUrl: '/other-sw.js' } as never);

    expect(resolved).toEqual({});
  });
});
