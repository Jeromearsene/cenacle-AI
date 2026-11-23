import { inflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';
import {
  ARG_PREFIX,
  dotDataUrl,
  dotPng,
  identityArgument,
  notificationTitle,
} from '../src/main/account-notifications';
import { evalIn, expect, serviceIds, test } from './fixtures';

test.describe('pastille et titre des notifications', () => {
  test('le titre commence par le nom du compte', () => {
    expect(notificationTitle('Perso', 'Réponse prête')).toBe('Perso · Réponse prête');
  });

  test('la pastille est un PNG valide de la couleur du compte, fond transparent', () => {
    const png = dotPng('#d97757', 64);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(64); // largeur
    expect(png.readUInt32BE(20)).toBe(64); // hauteur

    // on relit les pixels : le centre est plein et coloré, le coin est transparent
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

  test('refuse une couleur invalide', () => {
    expect(() => dotPng('rouge')).toThrow();
    expect(() => dotPng('#12345')).toThrow();
    expect(dotDataUrl('#6a9bcc')).toMatch(/^data:image\/png;base64,/);
  });

  test('l’identité passe par un argument que le preload sait relire', () => {
    const arg = identityArgument({ name: 'Cénacle « test »', icon: 'data:x' });
    expect(arg.startsWith(ARG_PREFIX)).toBe(true);
    expect(JSON.parse(Buffer.from(arg.slice(ARG_PREFIX.length), 'base64').toString()).name).toBe(
      'Cénacle « test »'
    );
  });
});

const notifTitle = (app: Parameters<typeof evalIn>[0], id: number, title: string) =>
  evalIn<string>(app, id, `new Notification(${JSON.stringify(title)}).title`);

async function addAccount(sidebar: Page, label: string): Promise<void> {
  await sidebar.getByRole('button', { name: '+ Ajouter un compte' }).click();
  await sidebar.getByRole('menuitem', { name: label }).click();
  await sidebar.locator('input.rename').press('Enter');
}

test.describe('notifications des pages de service', () => {
  test('portent le nom du compte et sa pastille, même créées au chargement', async ({
    launch,
    service,
  }) => {
    const { app } = await launch();
    const [id] = await serviceIds(app, new URL(service.url).origin);
    expect(await evalIn<string>(app, id as number, 'window.earlyNotificationTitle')).toBe(
      'Claude 1 · tôt'
    );
    expect(await notifTitle(app, id as number, 'Salut')).toBe('Claude 1 · Salut');
    expect(await evalIn<string>(app, id as number, 'new Notification("x").icon')).toMatch(
      /^data:image\/png;base64,/
    );
  });

  test('rien n’est exposé à la page', async ({ launch, service }) => {
    const { app } = await launch();
    const [id] = await serviceIds(app, new URL(service.url).origin);
    const leaked = await evalIn<string[]>(
      app,
      id as number,
      'Object.keys(window).filter((k) => /cenacle|multi|electron/i.test(k))'
    );
    expect(leaked).toEqual([]);
  });

  test('suivent le renommage du compte', async ({ launch, service }) => {
    const { app, sidebar } = await launch();
    const [id] = await serviceIds(app, new URL(service.url).origin);
    await sidebar.locator('.account .name').dblclick();
    await sidebar.locator('input.rename').fill('Perso');
    await sidebar.locator('input.rename').press('Enter');
    await expect.poll(() => notifTitle(app, id as number, 'Salut')).toBe('Perso · Salut');
  });

  test('un clic sur la notification affiche le compte concerné', async ({ launch, service }) => {
    const { app, sidebar } = await launch();
    await addAccount(sidebar, 'ChatGPT');
    const ids = await serviceIds(app, new URL(service.url).origin);
    expect(ids).toHaveLength(2);

    await sidebar.locator('#accounts .account').first().click();
    await expect(sidebar.locator('.account.active .name')).toHaveText('Claude 1');

    // la page du deuxième compte signale un clic sur l'une de ses notifications
    await evalIn(
      app,
      ids[1] as number,
      "window.dispatchEvent(new CustomEvent('cenacle:notification-click'))"
    );
    await expect(sidebar.locator('.account.active .name')).toHaveText('ChatGPT 1');
  });
});
