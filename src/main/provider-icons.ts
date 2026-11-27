// The small icon of each service (its favicon), learned from the service's own pages and shown
// next to its name in the sidebar. Kept as a data URL so that the interface never makes a network
// request, and in state.json so that it is there from the first frame of the next launch.
// Pure functions (no dependency on Electron): testable without launching the app.

/** A longer data URL is not a favicon: it is never kept (a multi-size .ico can be 50 KB or so). */
export const MAX_ICON_LENGTH = 100_000;

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

const ICON_URL =
  /^data:image\/(?:png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Is this a data URL of an image, of a reasonable size? (checked again when read from disk) */
export const isIconUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_ICON_LENGTH && ICON_URL.test(value);

/** The image type given away by the first bytes of a file, or null if it is not an image we accept. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (starts(0x00, 0x00, 0x01, 0x00)) return 'image/x-icon';
  // WebP: "RIFF", four bytes of size, then "WEBP"
  const word = (from: number) => String.fromCharCode(...Array.from(bytes.subarray(from, from + 4)));
  if (word(0) === 'RIFF' && word(8) === 'WEBP') return 'image/webp';
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!doctype[^>]*>\s*)?<svg[\s>]/i.test(head))
    return 'image/svg+xml';
  return null;
}

/**
 * The data URL of an image a service sent, or null if it is not an image we accept. The bytes
 * decide, as a browser would: servers often label an .ico as `application/octet-stream`.
 */
export function toIconUrl(contentType: string | null, bytes: Uint8Array): string | null {
  if (bytes.byteLength === 0) return null;
  const declared = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  const type = sniffImageType(bytes) ?? (IMAGE_TYPES.has(declared) ? declared : null);
  if (!type) return null;
  const url = `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
  return isIconUrl(url) ? url : null;
}

const ATTRIBUTE = (name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');

/**
 * Where a service's page says its icon is (`<link rel="icon">`, then `apple-touch-icon`), as
 * absolute addresses, followed by the conventional `/favicon.ico`.
 */
export function iconCandidates(html: string, pageUrl: string): string[] {
  const found: { url: string; rank: number }[] = [];
  for (const tag of html.slice(0, 300_000).match(/<link\b[^>]*>/gi) ?? []) {
    const rel = ATTRIBUTE('rel').exec(tag);
    const href = ATTRIBUTE('href').exec(tag);
    const kinds = (rel?.[1] ?? rel?.[2] ?? rel?.[3] ?? '').toLowerCase().split(/\s+/);
    const target = href?.[1] ?? href?.[2] ?? href?.[3];
    const rank = kinds.includes('icon') ? 0 : kinds.includes('apple-touch-icon') ? 1 : -1;
    if (!target || rank < 0) continue;
    try {
      found.push({ url: new URL(target.replaceAll('&amp;', '&'), pageUrl).toString(), rank });
    } catch {
      // not an address
    }
  }
  const urls = found.sort((a, b) => a.rank - b.rank).map((f) => f.url);
  try {
    urls.push(new URL('/favicon.ico', pageUrl).toString());
  } catch {
    // not an address
  }
  return [...new Set(urls)].slice(0, 5);
}

/**
 * Where to fetch an icon from: an address the service pointed at, if it is either on the service's
 * own site or secure. Anything else a page can name (a local address, `file:`…) is refused.
 */
export function iconSource(candidate: unknown, serviceUrl: string): string | null {
  if (typeof candidate !== 'string') return null;
  if (candidate.startsWith('data:')) return isIconUrl(candidate) ? candidate : null;
  try {
    const url = new URL(candidate);
    const origin = new URL(serviceUrl).origin;
    if (url.origin === origin || url.protocol === 'https:') return url.toString();
  } catch {
    // not an address
  }
  return null;
}

/** The icons read from state.json: only known services, only valid images. */
export function parseProviderIcons(
  raw: unknown,
  isProvider: (id: string) => boolean
): Record<string, string> {
  const icons: Record<string, string> = {};
  if (typeof raw !== 'object' || raw === null) return icons;
  for (const [id, icon] of Object.entries(raw)) {
    if (isProvider(id) && isIconUrl(icon)) icons[id] = icon;
  }
  return icons;
}
