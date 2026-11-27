import fs from 'node:fs';
import path from 'node:path';
import {
  iconSource,
  MAX_ICON_LENGTH,
  parseProviderIcons,
  toIconUrl,
} from '../src/main/provider-icons';
import { expect, test } from './fixtures';

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

  test('anything that is not a reasonable image is refused', () => {
    expect(toIconUrl('text/html', Buffer.from('<script>'))).toBeNull();
    expect(toIconUrl('application/octet-stream', PNG)).toBeNull();
    expect(toIconUrl(null, PNG)).toBeNull();
    expect(toIconUrl('image/png', new Uint8Array())).toBeNull();
    expect(toIconUrl('image/png', new Uint8Array(MAX_ICON_LENGTH))).toBeNull();
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
