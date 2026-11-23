// Visual identity of an account's notifications: its name in the title and its color dot as the
// icon. No dependency on Electron: testable without launching the app.
import { deflateSync } from 'node:zlib';

/** "Personal · New message": the account name precedes the title chosen by the service. */
export const notificationTitle = (accountName: string, title: string): string =>
  `${accountName} · ${title}`;

const HEX = /^#[0-9a-f]{6}$/i;

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

/** An RGBA PNG: a solid disc in the account color, smooth edges, transparent background. */
export function dotPng(color: string, size = 128): Buffer {
  if (!HEX.test(color)) throw new Error(`invalid color: ${color}`);
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
  const radius = size / 2 - 1;
  const mid = size / 2;
  // each row: filter byte (0) then `size` RGBA pixels
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x + 0.5 - mid, y + 0.5 - mid);
      const alpha = Math.round(255 * Math.min(1, Math.max(0, radius - dist + 0.5)));
      const o = row + 1 + x * 4;
      raw[o] = r as number;
      raw[o + 1] = g as number;
      raw[o + 2] = b as number;
      raw[o + 3] = alpha;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const dotDataUrl = (color: string): string =>
  `data:image/png;base64,${dotPng(color).toString('base64')}`;

/** What the preload of a service page receives (as a command-line argument). */
export interface NotificationIdentity {
  name: string;
  icon: string;
}

export const ARG_PREFIX = '--cenacle-notifications=';

export const identityArgument = (identity: NotificationIdentity): string =>
  ARG_PREFIX + Buffer.from(JSON.stringify(identity)).toString('base64');
