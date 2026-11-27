import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  iconCandidates,
  iconSource,
  MAX_ICON_LENGTH,
  parseProviderIcons,
  readBundledIcons,
  sniffImageType,
  toIconUrl,
} from '../src/main/provider-icons';
import { PROVIDERS } from '../src/main/providers';
import { addAccount, expect, test, waitForServices } from './fixtures';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const PNG_URL = `data:image/png;base64,${PNG.toString('base64')}`;

// These checks do not launch the app.
test.describe('service icons', () => {
  test('an image sent by a service becomes a data URL', () => {
    expect(toIconUrl('image/png', PNG)).toBe(PNG_URL);
    expect(toIconUrl('image/png; charset=binary', PNG)).toBe(PNG_URL);
    expect(toIconUrl('image/svg+xml', Buffer.from('<svg/>'))).toMatch(
      /^data:image\/svg\+xml;base64,/
    );
  });

  test('the bytes decide when a server labels an image badly', () => {
    // an .ico or a .png is often sent as application/octet-stream, or with no type at all
    expect(toIconUrl('application/octet-stream', PNG)).toBe(PNG_URL);
    expect(toIconUrl(null, PNG)).toBe(PNG_URL);
    expect(sniffImageType(new Uint8Array([0, 0, 1, 0, 1, 0, 16, 16]))).toBe('image/x-icon');
    expect(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImageType(Buffer.from('<?xml version="1.0"?>\n<svg xmlns="x"/>'))).toBe(
      'image/svg+xml'
    );
    expect(sniffImageType(Buffer.from('<html><svg></svg></html>'))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  test('anything that is not a reasonable image is refused', () => {
    expect(toIconUrl('text/html', Buffer.from('<script>'))).toBeNull();
    expect(toIconUrl('application/octet-stream', Buffer.from('not an image'))).toBeNull();
    expect(toIconUrl('image/png', new Uint8Array())).toBeNull();
    expect(toIconUrl('image/png', new Uint8Array(MAX_ICON_LENGTH))).toBeNull();
  });

  test('the icons a start page names are found, best first, then /favicon.ico', () => {
    const html = `<head>
      <link rel="apple-touch-icon" href="/touch.png">
      <link rel="stylesheet" href="/app.css">
      <link href='//cdn.example.com/icon.svg?a=1&amp;b=2' rel='shortcut icon'>
      <link rel="mask-icon" href="/mask.svg">
      <link rel=icon href=/plain.png>
    </head>`;
    expect(iconCandidates(html, 'https://chat.example.com/app')).toEqual([
      'https://cdn.example.com/icon.svg?a=1&b=2',
      'https://chat.example.com/plain.png',
      'https://chat.example.com/touch.png',
      'https://chat.example.com/favicon.ico',
    ]);
    expect(iconCandidates('', 'https://chat.example.com/app')).toEqual([
      'https://chat.example.com/favicon.ico',
    ]);
  });

  test('an icon is fetched from the service itself or from a secure address only', () => {
    const service = 'https://claude.ai/';
    expect(iconSource('https://claude.ai/favicon.ico', service)).toBe(
      'https://claude.ai/favicon.ico'
    );
    expect(iconSource('https://cdn.example.com/a.png', service)).toBe(
      'https://cdn.example.com/a.png'
    );
    expect(iconSource(PNG_URL, service)).toBe(PNG_URL);
    // a page cannot make the app look at a local address, a file or a script
    expect(iconSource('http://192.168.1.1/a.png', service)).toBeNull();
    expect(iconSource('file:///etc/passwd', service)).toBeNull();
    expect(iconSource('data:text/html;base64,PHNjcmlwdD4=', service)).toBeNull();
    expect(iconSource('not an address', service)).toBeNull();
    expect(iconSource(42, service)).toBeNull();
    // the fake service of the tests is plain http, on its own address
    expect(iconSource('http://127.0.0.1:5000/favicon.png', 'http://127.0.0.1:5000/')).toBe(
      'http://127.0.0.1:5000/favicon.png'
    );
  });

  test('the icons shipped with the app are read from their files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cenacle-icons-'));
    const known = (id: string) => ['claude', 'chatgpt', 'gemini'].includes(id);
    try {
      fs.writeFileSync(path.join(dir, 'claude.png'), PNG);
      fs.writeFileSync(path.join(dir, 'chatgpt.SVG'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
      fs.writeFileSync(path.join(dir, 'gemini.png'), 'this is not an image');
      fs.writeFileSync(path.join(dir, 'unknown.png'), PNG);
      fs.writeFileSync(path.join(dir, 'README.md'), '# icons');
      fs.writeFileSync(path.join(dir, 'claude.gif.txt'), PNG);
      const icons = readBundledIcons(dir, known);
      expect(Object.keys(icons).sort()).toEqual(['chatgpt', 'claude']);
      expect(icons.claude).toBe(PNG_URL);
      expect(icons.chatgpt).toMatch(/^data:image\/svg\+xml;base64,/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    // no such folder: no icon, no error
    expect(readBundledIcons(path.join(dir, 'missing'), known)).toEqual({});
  });

  test('the app ships an icon for each of its services', () => {
    const dir = path.join(__dirname, '../resources/provider-icons');
    const shipped = readBundledIcons(dir, (id) => Object.hasOwn(PROVIDERS, id));
    expect(Object.keys(shipped).sort()).toEqual(Object.keys(PROVIDERS).sort());
  });

  test('a saved state keeps the valid icons of the known services only', () => {
    const known = (id: string) => id === 'claude' || id === 'gemini';
    expect(
      parseProviderIcons(
        { claude: PNG_URL, gemini: 'https://example.com/a.png', chatgpt: PNG_URL, nope: PNG_URL },
        known
      )
    ).toEqual({ claude: PNG_URL });
    expect(parseProviderIcons('claude', known)).toEqual({});
    expect(parseProviderIcons(null, known)).toEqual({});
  });
});

test('the icon a service announces is shown next to its accounts and kept for the next launch', async ({
  launch,
  userDataDir,
}) => {
  const { app, sidebar } = await launch();
  const logo = sidebar.locator('.account .provider-logo img');
  await expect(logo).toHaveAttribute('src', /^data:image\/png;base64,/);
  await app.close();

  const saved = JSON.parse(fs.readFileSync(path.join(userDataDir, 'state.json'), 'utf8'));
  expect(saved.providerIcons.claude).toMatch(/^data:image\/png;base64,/);
});

test('the icon of a service whose accounts are not shown is found all the same', async ({
  launch,
  userDataDir,
}) => {
  // First launch: a ChatGPT account, then back on the Claude one (only that page stays shown).
  const first = await launch();
  await addAccount(first.sidebar, 'ChatGPT');
  await first.sidebar.locator('.account', { hasText: 'Claude' }).first().click();
  await first.app.close();

  // The saved icons are forgotten: the next launch has to find them again.
  const file = path.join(userDataDir, 'state.json');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  saved.providerIcons = {};
  fs.writeFileSync(file, JSON.stringify(saved));

  const { sidebar } = await launch();
  const chip = sidebar.locator('.provider-filter .chip', { hasText: 'ChatGPT' });
  await expect(chip.locator('.provider-logo img')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/
  );
  // …without ever opening a ChatGPT page
  await expect(sidebar.locator('.account', { hasText: 'ChatGPT' })).toBeVisible();
});

test('an icon shipped with the app is used, and no page replaces it', async ({
  launch,
  service,
}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cenacle-icons-'));
  fs.writeFileSync(
    path.join(dir, 'claude.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="red"/></svg>'
  );
  try {
    const { app, sidebar } = await launch({ env: { CENACLE_ICONS_DIR: dir } });
    const logo = sidebar.locator('.account .provider-logo img');
    await expect(logo).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
    // The fake service announces a PNG favicon: once its page has loaded, the shipped one stays.
    await waitForServices(app, service.url, 1);
    await sidebar.waitForTimeout(500);
    await expect(logo).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
