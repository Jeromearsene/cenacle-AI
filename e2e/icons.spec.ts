import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';

// Les icônes sont générées à partir de resources/icon.svg ; on vérifie qu'aucun format ne manque
// ou n'est corrompu (ce que le build ne détecterait pas).
const resources = path.resolve(__dirname, '../resources');
const read = (file: string) => fs.readFileSync(path.join(resources, file));

test.describe('icônes de l’app', () => {
  test('PNG : signature valide, carré, 512 px', () => {
    const png = read('icon.png');
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(512);
  });

  test('PNG macOS : 1024 px (marge comprise)', () => {
    const png = read('icon-mac.png');
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
  });

  test('ICO (Windows) : contient de 16 à 256 px', () => {
    const ico = read('icon.ico');
    expect(ico.readUInt16LE(0)).toBe(0); // réservé
    expect(ico.readUInt16LE(2)).toBe(1); // type : icône
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256);
    expect(sizes).toEqual(expect.arrayContaining([16, 32, 48, 256]));
  });

  test('ICNS (macOS) : en-tête valide et taille cohérente', () => {
    const icns = read('icon.icns');
    expect(icns.subarray(0, 4).toString('ascii')).toBe('icns');
    expect(icns.readUInt32BE(4)).toBe(icns.length);
  });

  test('la source vectorielle est présente', () => {
    expect(read('icon.svg').toString()).toContain('<svg');
  });
});
