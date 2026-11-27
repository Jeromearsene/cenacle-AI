// The small icon of each service (its favicon), learned from the service's own pages and shown
// next to its name in the sidebar. Kept as a data URL so that the interface never makes a network
// request, and in state.json so that it is there from the first frame of the next launch.
// Pure functions (no dependency on Electron): testable without launching the app.

/** A longer data URL is not a favicon: it is never kept. */
export const MAX_ICON_LENGTH = 60_000;

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

/** The data URL of an image the service sent, or null if it is not an image we accept. */
export function toIconUrl(contentType: string | null, bytes: Uint8Array): string | null {
  const type = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!IMAGE_TYPES.has(type) || bytes.byteLength === 0) return null;
  const url = `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
  return isIconUrl(url) ? url : null;
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
