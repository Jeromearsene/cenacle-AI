// Which browser permissions the service pages may use. Electron grants every permission by
// default; this app shows third-party websites, so only what a chat service needs is allowed.
// Pure functions (no dependency on Electron): testable without launching the app.

/** Permissions granted to the page of a service. */
const ALLOWED = new Set([
  'notifications',
  'clipboard-sanitized-write', // "copy" buttons
  'clipboard-read', // "paste" buttons
  'fullscreen',
  'speaker-selection', // choose the audio output of voice mode
  'storage-access', // sign-in pages embedded in frames
  'top-level-storage-access',
]);

/** Permissions that only the page itself (not an embedded third-party frame) may use. */
const MAIN_FRAME_ONLY = new Set(['notifications', 'media']);

export interface PermissionContext {
  permission: string;
  /** For `media`: what is being captured ('audio', 'video'). */
  mediaTypes?: readonly string[];
  isMainFrame: boolean;
}

/**
 * Microphone: allowed (voice mode). Camera and screen capture: refused, as is every permission
 * not listed above (geolocation, MIDI, USB, serial, HID, idle detection…).
 */
export function isPermissionAllowed({ permission, mediaTypes, isMainFrame }: PermissionContext) {
  if (MAIN_FRAME_ONLY.has(permission) && !isMainFrame) return false;
  if (permission === 'media') {
    return (
      mediaTypes !== undefined && mediaTypes.length > 0 && mediaTypes.every((t) => t === 'audio')
    );
  }
  return ALLOWED.has(permission);
}
