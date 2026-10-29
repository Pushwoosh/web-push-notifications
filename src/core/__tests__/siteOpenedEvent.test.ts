import { type Api } from '../../modules/Api/Api';
import { type Data } from '../../modules/Data/Data';
import { EVENT_PW_SITE_OPENED } from '../constants';
import { Pushwoosh } from '../Pushwoosh';

function buildSdk() {
  const data = <Data><unknown>{
    getDeviceType: jest.fn().mockResolvedValue(11),
  };
  const api = <Api><unknown>{
    postEvent: jest.fn().mockResolvedValue(undefined),
  };
  const sdk = new Pushwoosh();

  Object.assign(sdk, { data, api });

  return { sdk, api };
}

beforeEach(() => {
  document.title = 'Shoes';
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('PW_SiteOpened', () => {
  it.each([
    ['/Catalog/Shoes/?sort=price#top', '/catalog/shoes/'],
    ['/', '/'],
    ['/каталог/обувь', '/каталог/обувь'],
    ['/a%2Fb/c', '/a/b/c'],
    ['/x%3Fy', '/x?y'],
    ['/100%25', '/100%'],
    ['/a%20b', '/a b'],
    ['/%D7', '/%d7'],
    ['/%E0%A4', '/%e0%a4'],
    ['/%ED%A0%80', '/%ed%a0%80'],
    ['/%C0%AF', '/%c0%af'],
    ['/%ZZ', '/%zz'],
  ])('on %s sends path %s beside the url, title and device type', async (page, path) => {
    window.history.replaceState({}, '', page);
    const { sdk, api } = buildSdk();

    await sdk.sendPostEventVisitedPage();

    expect(api.postEvent).toHaveBeenCalledWith(EVENT_PW_SITE_OPENED, {
      url: window.location.href,
      path,
      title: 'Shoes',
      device_type: 11,
    });
  });

  it('keeps the url encoded, with query and hash', async () => {
    window.history.replaceState({}, '', '/Каталог/?sort=price#top');
    const { sdk, api } = buildSdk();

    await sdk.sendPostEventVisitedPage();

    expect(api.postEvent).toHaveBeenCalledWith(EVENT_PW_SITE_OPENED, expect.objectContaining({
      url: 'http://localhost/%D0%9A%D0%B0%D1%82%D0%B0%D0%BB%D0%BE%D0%B3/?sort=price#top',
      path: '/каталог/',
    }));
  });

  it('sends the url and path of one page when the site navigates while the device type is read', async () => {
    window.history.replaceState({}, '', '/Catalog/');
    const { sdk, api } = buildSdk();
    let releaseDeviceType!: (deviceType: number) => void;
    (<jest.Mock>sdk.data.getDeviceType).mockReturnValue(new Promise((resolve) => {
      releaseDeviceType = resolve;
    }));

    const sent = sdk.sendPostEventVisitedPage();
    window.history.pushState({}, '', '/Checkout/');
    releaseDeviceType(11);
    await sent;

    expect(api.postEvent).toHaveBeenCalledWith(EVENT_PW_SITE_OPENED, expect.objectContaining({
      url: 'http://localhost/Catalog/',
      path: '/catalog/',
    }));
  });
});
