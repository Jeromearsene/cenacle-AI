import { inflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';
import {
  ARG_PREFIX,
  dotDataUrl,
  dotPng,
  identityArgument,
  notificationTitle,
} from '../src/main/account-notifications';
import { evalIn, expect, test, waitForServices } from './fixtures';

test.describe('notification dot and title', () => {
  test('the title starts with the account name', () => {
    expect(notificationTitle('Personal', 'Reply ready')).toBe('Personal · Reply ready');
  });

  test('the dot is a valid PNG in the account color with a transparent background', () => {
    const png = dotPng('#d97757', 64);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(64); // largeur
    expect(png.readUInt32BE(20)).toBe(64); // hauteur

    // read the pixels back: the center is solid and colored, the corner is transparent
    const idatStart = png.indexOf('IDAT') + 4;
    const idatLen = png.readUInt32BE(png.indexOf('IDAT') - 4);
    const raw = inflateSync(png.subarray(idatStart, idatStart + idatLen));
    const pixel = (x: number, y: number) => {
      const o = y * (1 + 64 * 4) + 1 + x * 4;
      return [...raw.subarray(o, o + 4)];
    };
    expect(pixel(32, 32)).toEqual([0xd9, 0x77, 0x57, 255]);
    expect(pixel(0, 0)[3]).toBe(0);
  });

  test('rejects an invalid color', () => {
    expect(() => dotPng('rouge')).toThrow();
    expect(() => dotPng('#12345')).toThrow();
    expect(dotDataUrl('#6a9bcc')).toMatch(/^data:image\/png;base64,/);
  });

  test('the identity goes through an argument the preload can read back', () => {
    const arg = identityArgument({ name: 'Cénacle “test”', icon: 'data:x' });
    expect(arg.startsWith(ARG_PREFIX)).toBe(true);
    expect(JSON.parse(Buffer.from(arg.slice(ARG_PREFIX.length), 'base64').toString()).name).toBe(
      'Cénacle “test”'
    );
  });
});

const notifTitle = (app: Parameters<typeof evalIn>[0], id: number, title: string) =>
  evalIn<string>(app, id, `new Notification(${JSON.stringify(title)}).title`);

async function addAccount(sidebar: Page, label: string): Promise<void> {
  await sidebar.getByRole('button', { name: '+ Add account' }).click();
  await sidebar.getByRole('menuitem', { name: label }).click();
  await sidebar.locator('input.rename').press('Enter');
}

test.describe('service page notifications', () => {
  test('carry the account name and color dot, even when created at load', async ({
    launch,
    service,
  }) => {
    const { app } = await launch();
    const [id] = await waitForServices(app, new URL(service.url).origin, 1);
    // the page may not have finished running: wait for the result instead of reading it once
    await expect
      .poll(() => evalIn<string>(app, id as number, 'window.earlyNotificationTitle'))
      .toBe('Claude 1 · early');
    await expect.poll(() => notifTitle(app, id as number, 'Salut')).toBe('Claude 1 · Salut');
    await expect
      .poll(() => evalIn<string>(app, id as number, 'new Notification("x").icon'))
      .toMatch(/^data:image\/png;base64,/);
  });

  test('nothing is exposed to the page', async ({ launch, service }) => {
    const { app } = await launch();
    const [id] = await waitForServices(app, new URL(service.url).origin, 1);
    const leaked = await evalIn<string[]>(
      app,
      id as number,
      'Object.keys(window).filter((k) => /cenacle|multi|electron/i.test(k))'
    );
    expect(leaked).toEqual([]);
  });

  test('follow the account being renamed', async ({ launch, service }) => {
    const { app, sidebar } = await launch();
    const [id] = await waitForServices(app, new URL(service.url).origin, 1);
    await sidebar.locator('.account .name').dblclick();
    await sidebar.locator('input.rename').fill('Perso');
    await sidebar.locator('input.rename').press('Enter');
    await expect.poll(() => notifTitle(app, id as number, 'Salut')).toBe('Perso · Salut');
  });

  test('clicking the notification shows the matching account', async ({ launch, service }) => {
    const { app, sidebar } = await launch();
    await addAccount(sidebar, 'ChatGPT');
    const ids = await waitForServices(app, new URL(service.url).origin, 2);

    await sidebar.locator('#accounts .account').first().click();
    await expect(sidebar.locator('.account.active .name')).toHaveText('Claude 1');

    // the second account's page reports a click on one of its notifications
    await evalIn(
      app,
      ids[1] as number,
      "window.dispatchEvent(new CustomEvent('cenacle:notification-click'))"
    );
    await expect(sidebar.locator('.account.active .name')).toHaveText('ChatGPT 1');
  });
});
