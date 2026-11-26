// Remembering the conversation each account was on, so the next launch reopens it instead of the
// service's home page. Pure functions (no dependency on Electron): testable without launching
// the app.

/** A longer address is not a conversation: it is never kept in state.json. */
export const MAX_URL_LENGTH = 2048;

// Sign-in pages (and the OAuth steps of a popup): never reopened, a session may have ended there.
export const OAUTH_PATH = /\/(oauth|oauth2|authorize|login|signin|sign-in|auth)(\/|$)/i;

/**
 * The address to reopen for an account of the service at `baseUrl`: `candidate` when it is a
 * page of the same site (same origin) and not a sign-in page, otherwise null. Anything else a
 * page can navigate to (another site, `file:`, an error page…) is refused.
 */
export function restorableUrl(candidate: unknown, baseUrl: string): string | null {
  if (typeof candidate !== 'string' || candidate.length > MAX_URL_LENGTH) return null;
  let url: URL;
  let base: URL;
  try {
    url = new URL(candidate);
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.origin !== base.origin || OAUTH_PATH.test(url.pathname)) return null;
  // The fragment is page-internal state, not part of the conversation's address.
  url.hash = '';
  return url.toString();
}
