import { isSafeAbsoluteUrl, isSafeUrl } from '../url';

const SCRIPT_URLS = [
  'javascript:alert(document.cookie)',
  'JaVaScRiPt:alert(1)',
  '  javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'blob:https://evil/1234',
  'file:///etc/passwd',
];

describe('isSafeUrl', () => {
  it('rejects every scheme that runs script in the page origin', () => {
    SCRIPT_URLS.forEach((url) => {
      expect(isSafeUrl(url)).toBe(false);
    });
  });

  it('accepts ordinary links, including relative ones and deep links', () => {
    ['https://shop/orders', 'http://shop', '/orders', 'orders/42', 'myapp://orders/42', 'mailto:a@b.c']
      .forEach((url) => {
        expect(isSafeUrl(url)).toBe(true);
      });
  });

  it('rejects an empty url', () => {
    expect(isSafeUrl('')).toBe(false);
  });
});

describe('isSafeAbsoluteUrl', () => {
  it('rejects script schemes and schemeless urls alike', () => {
    SCRIPT_URLS.forEach((url) => {
      expect(isSafeAbsoluteUrl(url)).toBe(false);
    });

    expect(isSafeAbsoluteUrl('/orders')).toBe(false);
    expect(isSafeAbsoluteUrl('orders/42')).toBe(false);
  });

  it('accepts a real scheme', () => {
    expect(isSafeAbsoluteUrl('https://shop/1')).toBe(true);
    expect(isSafeAbsoluteUrl('myapp://orders/42')).toBe(true);
  });
});
