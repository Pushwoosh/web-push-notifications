/** The page path events and page rules use: decoded and lowercased, read anew on every call. */
export function getPagePath(): string {
  const { pathname } = window.location;

  // One malformed escape (cut UTF-8, overlong, surrogate, non-hex) makes the whole decode throw.
  try {
    return decodeURIComponent(pathname).toLowerCase();
  } catch {
    return pathname.toLowerCase();
  }
}
