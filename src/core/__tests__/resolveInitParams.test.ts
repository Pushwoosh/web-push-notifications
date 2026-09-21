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

  it('overrides a value written in the snippet', () => {
    expect(resolveInitParams(raw({ autoSubscribe: true }), { autoSubscribe: false })).toEqual({ autoSubscribe: false });
  });

  it('leaves a snippet value alone when the panel carries no such key', () => {
    expect(resolveInitParams(raw({ autoSubscribe: false }), { defaultNotificationTitle: 'Panel' }))
      .toEqual({ defaultNotificationTitle: 'Panel' });
  });

  it('overrides strings the same way', () => {
    const resolved = resolveInitParams(
      raw({ defaultNotificationTitle: 'Snippet' }),
      { defaultNotificationTitle: 'Panel', defaultNotificationImage: 'https://site.tld/logo.png' },
    );

    expect(resolved).toEqual({
      defaultNotificationTitle: 'Panel',
      defaultNotificationImage: 'https://site.tld/logo.png',
    });
  });

  it('merges subscribeWidget key by key, the panel winning per key', () => {
    const resolved = resolveInitParams(
      raw({ subscribeWidget: { enable: true, bgColor: '#000' } }),
      { subscribeWidget: { position: 'bottomLeft', bgColor: '#12AE7E' } },
    );

    expect(resolved.subscribeWidget).toEqual({ enable: true, bgColor: '#12AE7E', position: 'bottomLeft' });
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
