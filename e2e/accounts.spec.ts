import type { Page } from '@playwright/test';
import { accountNames, evalIn, expect, serviceIds, test } from './fixtures';

async function addAccount(sidebar: Page, label: string): Promise<void> {
  await sidebar.getByRole('button', { name: '+ Ajouter un compte' }).click();
  await sidebar.getByRole('menuitem', { name: label }).click();
  // Le nouveau compte arrive en mode renommage : on garde le nom proposé.
  await sidebar.locator('input.rename').press('Enter');
}

test('ajoute un compte du service choisi', async ({ launch }) => {
  const { sidebar } = await launch();
  await expect.poll(() => accountNames(sidebar)).toEqual(['Claude 1']);

  await addAccount(sidebar, 'ChatGPT');

  await expect.poll(() => accountNames(sidebar)).toEqual(['Claude 1', 'ChatGPT 1']);
  await expect(sidebar.locator('.account.active .name')).toHaveText('ChatGPT 1');
  await expect(sidebar.locator('.col-head .tag')).toHaveText('ChatGPT');
});

test('renomme un compte par double-clic', async ({ launch }) => {
  const { sidebar } = await launch();
  await sidebar.locator('.account .name').dblclick();
  await sidebar.locator('input.rename').fill('Perso');
  await sidebar.locator('input.rename').press('Enter');
  await expect.poll(() => accountNames(sidebar)).toEqual(['Perso']);
});

test('affiche tous les comptes en colonnes', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'Claude');
  await expect(sidebar.locator('.col-head')).toHaveCount(1);

  await sidebar.getByRole('button', { name: 'Colonnes' }).click();
  await expect(sidebar.locator('.col-head')).toHaveCount(2);

  await sidebar.getByRole('button', { name: 'Un seul' }).click();
  await expect(sidebar.locator('.col-head')).toHaveCount(1);
});

test('isole les cookies et le stockage de chaque compte', async ({ launch, service }) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'Claude');
  await expect.poll(() => serviceIds(app, service.url)).toHaveLength(2);
  const [a, b] = await serviceIds(app, service.url);
  if (a === undefined || b === undefined) throw new Error('vues manquantes');

  await evalIn(app, a, `document.cookie = 'who=A; path=/'; localStorage.setItem('who', 'A')`);

  // Même adresse, même domaine : sans isolation, le compte B verrait le cookie de A.
  expect(await evalIn<string>(app, b, 'document.cookie')).toBe('');
  expect(await evalIn<string | null>(app, b, `localStorage.getItem('who')`)).toBeNull();

  await evalIn(app, b, `document.cookie = 'who=B; path=/'; localStorage.setItem('who', 'B')`);
  expect(await evalIn<string>(app, a, 'document.cookie')).toBe('who=A');
  expect(await evalIn<string | null>(app, a, `localStorage.getItem('who')`)).toBe('A');
});

test('envoie l’identifiant de navigateur prévu pour chaque service', async ({
  launch,
  service,
}) => {
  const { sidebar } = await launch(); // Claude : identifiant « nettoyé »
  await expect.poll(() => service.pageUserAgents).toHaveLength(1);
  await addAccount(sidebar, 'Gemini'); // Gemini : identifiant natif d'Electron
  await expect.poll(() => service.pageUserAgents).toHaveLength(2);

  const [claude, gemini] = service.pageUserAgents;
  expect(claude).toContain('Chrome/');
  expect(claude).not.toMatch(/Electron\//);
  expect(claude).not.toMatch(/c(é|e|%c3%a9)nacle/i); // ni le nom de l'app
  expect(gemini).toMatch(/Electron\//);
  expect(gemini).toMatch(/^[\x20-\x7e]+$/); // ASCII uniquement : les accents du nom de l'app sont mal encodés
});

test('retrouve comptes, noms et sessions après un redémarrage', async ({ launch, service }) => {
  const first = await launch();
  await first.sidebar.locator('.account .name').dblclick();
  await first.sidebar.locator('input.rename').fill('Perso');
  await first.sidebar.locator('input.rename').press('Enter');
  await addAccount(first.sidebar, 'Gemini');
  await expect.poll(() => accountNames(first.sidebar)).toEqual(['Perso', 'Gemini 1']);

  const [claudeView] = await serviceIds(first.app, service.url);
  if (claudeView === undefined) throw new Error('vue manquante');
  await evalIn(first.app, claudeView, `localStorage.setItem('who', 'perso')`);
  await first.app.close();

  const second = await launch();
  await expect.poll(() => accountNames(second.sidebar)).toEqual(['Perso', 'Gemini 1']);
  await expect(second.sidebar.locator('.account.active .name')).toHaveText('Gemini 1');

  // Le compte « Perso » doit retrouver sa propre session.
  await second.sidebar.locator('.account', { hasText: 'Perso' }).click();
  await expect.poll(() => serviceIds(second.app, service.url)).toHaveLength(2);
  // Après un redémarrage, la vue de Gemini (compte actif) est créée en premier : celle de
  // « Perso », ouverte ensuite, est la plus récente.
  const persoView = (await serviceIds(second.app, service.url)).at(-1);
  if (persoView === undefined) throw new Error('vue manquante');
  await expect
    .poll(() => evalIn<string | null>(second.app, persoView, `localStorage.getItem('who')`))
    .toBe('perso');
});
