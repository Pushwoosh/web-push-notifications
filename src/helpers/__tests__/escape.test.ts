import { escape } from '../escape';

describe('escape', () => {
  it('escapes every character that can break out of markup', () => {
    expect(escape('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escape('a "b" \'c\' & d')).toBe('a &quot;b&quot; &#39;c&#39; &amp; d');
  });

  it('leaves strings without special characters untouched', () => {
    expect(escape('Order shipped')).toBe('Order shipped');
    expect(escape('')).toBe('');
  });

  it('round-trips with unescape', async () => {
    const { unescape } = await import('../unescape');
    const raw = '<b>a & "b"</b>';

    expect(unescape(escape(raw))).toBe(raw);
  });
});
