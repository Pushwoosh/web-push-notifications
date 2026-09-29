// Schemes that run script in the page's own origin; everything else either
// navigates away or is handed to the OS.
const UNSAFE_SCHEME = /^(?:javascript|vbscript|data|blob|file):/i;
const HAS_SCHEME = /^[a-z][a-z\d+\-.]*:/i;

// Browsers ignore whitespace and control characters while resolving a scheme,
// so a tab inside "java<tab>script:" navigates just as `javascript:` does.
function normalize(url: string): string {
  return url
    .split('')
    .filter((char) => char.charCodeAt(0) > 0x20 && char.charCodeAt(0) !== 0x7F)
    .join('');
}

/** True when the url is safe to assign to `location.href`. Relative urls qualify. */
export function isSafeUrl(url: string): boolean {
  return !!url && !UNSAFE_SCHEME.test(normalize(url));
}

/** True when the url carries a scheme and that scheme is safe to navigate to. */
export function isSafeAbsoluteUrl(url: string): boolean {
  const normalized = normalize(url);

  return HAS_SCHEME.test(normalized) && !UNSAFE_SCHEME.test(normalized);
}
