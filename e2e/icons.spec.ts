import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';

// The icons are generated from resources/icon.svg; check that no format is missing or
// corrupted (which the build would not detect).
const resources = path.resolve(__dirname, '../resources');
const read = (file: string) => fs.readFileSync(path.join(resources, file));

test.describe('app icons', () => {
  test('PNG: valid signature, square, 512 px', () => {
    const png = read('icon.png');
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(512);
  });

  test('macOS PNG: 1024 px (margin included)', () => {
    const png = read('icon-mac.png');
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
  });

  test('ICO (Windows): contains 16 to 256 px', () => {
    const ico = read('icon.ico');
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256);
    expect(sizes).toEqual(expect.arrayContaining([16, 32, 48, 256]));
  });

  test('ICNS (macOS): valid header and consistent size', () => {
    const icns = read('icon.icns');
    expect(icns.subarray(0, 4).toString('ascii')).toBe('icns');
    expect(icns.readUInt32BE(4)).toBe(icns.length);
  });

  test('the vector source is present', () => {
    expect(read('icon.svg').toString()).toContain('<svg');
  });
});
