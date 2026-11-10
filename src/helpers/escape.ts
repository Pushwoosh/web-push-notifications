/** Used to map characters to HTML entities. */
const htmlEscapes: { [key: string]: string } = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
};

/** Used to match HTML characters and HTML entities. */
const reUnescapedHtml = /[&<>"']/g;
const reHasUnescapedHtml = RegExp(reUnescapedHtml.source);

/** Converts `&`, `<`, `>`, `"` and `'` to HTML entities. The inverse of `unescape`. */
export function escape(string: string): string {
  return (string && reHasUnescapedHtml.test(string))
    ? string.replace(reUnescapedHtml, (chr) => htmlEscapes[chr])
    : string;
}
