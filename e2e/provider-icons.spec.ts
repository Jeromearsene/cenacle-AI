import fs from 'node:fs';
import path from 'node:path';
import {
  iconCandidates,
  iconSource,
  MAX_ICON_LENGTH,
  parseProviderIcons,
  sniffImageType,
  toIconUrl,
} from '../src/main/provider-icons';
import { addAccount, expect, test } from './fixtures';

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
