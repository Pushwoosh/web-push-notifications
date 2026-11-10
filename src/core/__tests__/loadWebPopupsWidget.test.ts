import { WIDGET_LOAD_TIMEOUT_MS } from '../constants';
import { Pushwoosh } from '../Pushwoosh';
import { type IInitParams, type IModuleRegistry } from '../Pushwoosh.types';

function load(sdk: Pushwoosh): Promise<IModuleRegistry['webPopups']> {
  return (<{ loadWebPopupsWidget: () => Promise<IModuleRegistry['webPopups']> }><unknown>sdk).loadWebPopupsWidget();
}

const fakeWidget = <IModuleRegistry['webPopups']><unknown>{ show: jest.fn() };

describe('loadWebPopupsWidget', () => {
  it('fetches the bundle and reports the widget it registered', async () => {
    const sdk = new Pushwoosh();
    sdk.widgetLoader = jest.fn(async () => {
      sdk.moduleRegistry.webPopups = fakeWidget;

      return true;
    });

    await expect(load(sdk)).resolves.toBe(fakeWidget);
    expect(sdk.widgetLoader).toHaveBeenCalledWith('web-popups');
  });

  it('respects a site that switched web popups off', async () => {
    const sdk = new Pushwoosh();
    sdk.initParams = <IInitParams>{ webPopups: { enable: false } };
    sdk.widgetLoader = jest.fn();

    await expect(load(sdk)).resolves.toBeUndefined();
    expect(sdk.widgetLoader).not.toHaveBeenCalled();
  });

  it('gives up when there is no loader (npm) or the bundle fails', async () => {
    const sdk = new Pushwoosh();

    await expect(load(sdk)).resolves.toBeUndefined();

    sdk.widgetLoader = jest.fn().mockResolvedValue(false);
    await expect(load(sdk)).resolves.toBeUndefined();
  });

  it('gives up when the bundle hangs', async () => {
    jest.useFakeTimers();
    const sdk = new Pushwoosh();
    sdk.widgetLoader = jest.fn(() => new Promise<boolean>(() => undefined));

    const loading = load(sdk);
    jest.advanceTimersByTime(WIDGET_LOAD_TIMEOUT_MS);

    await expect(loading).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});

describe('journey web placements delivery', () => {
  const PLACEMENT = { hash: 'HASH', content_code: 'CONTENT' };

  function deliver(sdk: Pushwoosh, placements: Array<typeof PLACEMENT>): void {
    (<{ deliverWebPlacements: (list: Array<typeof PLACEMENT>) => void }><unknown>sdk).deliverWebPlacements(placements);
  }

  it('buffers placements and loads the widget until it takes over', () => {
    const sdk = new Pushwoosh();
    sdk.initParams = <IInitParams>{};
    sdk.widgetLoader = jest.fn().mockResolvedValue(true);

    deliver(sdk, [PLACEMENT]);

    expect(sdk.widgetLoader).toHaveBeenCalledWith('web-popups');
    expect(sdk.takeWebPlacements()).toEqual([PLACEMENT]);
    expect(sdk.takeWebPlacements()).toEqual([]);
  });

  it('passes placements straight to the widget once it renders them', () => {
    const sdk = new Pushwoosh();
    sdk.initParams = <IInitParams>{};
    sdk.webPlacementsSink = jest.fn();

    deliver(sdk, [PLACEMENT]);

    expect(sdk.webPlacementsSink).toHaveBeenCalledWith([PLACEMENT]);
    expect(sdk.takeWebPlacements()).toEqual([]);
  });

  it('drops placements a site switched off', () => {
    const sdk = new Pushwoosh();
    sdk.initParams = <IInitParams>{ webPlacements: { enable: false } };
    sdk.widgetLoader = jest.fn();

    deliver(sdk, [PLACEMENT]);

    expect(sdk.widgetLoader).not.toHaveBeenCalled();
    expect(sdk.takeWebPlacements()).toEqual([]);
  });
});
