import type { Page } from '@playwright/test';
import { accountNames, evalIn, expect, test, waitForServices } from './fixtures';

async function addAccount(sidebar: Page, label: string): Promise<void> {
  await sidebar.getByRole('button', { name: '+ Add account' }).click();
  await sidebar.getByRole('menuitem', { name: label }).click();
  // The new account arrives in rename mode: keep the proposed name.
  await sidebar.locator('input.rename').press('Enter');
}

test('adds an account of the chosen service', async ({ launch }) => {
  const { sidebar } = await launch();
  await expect.poll(() => accountNames(sidebar)).toEqual(['Claude 1']);

  await addAccount(sidebar, 'ChatGPT');

  await expect.poll(() => accountNames(sidebar)).toEqual(['Claude 1', 'ChatGPT 1']);
  await expect(sidebar.locator('.account.active .name')).toHaveText('ChatGPT 1');
  await expect(sidebar.locator('.col-head .tag')).toHaveText('ChatGPT');
});

test('renames an account on double click', async ({ launch }) => {
  const { sidebar } = await launch();
  await sidebar.locator('.account .name').dblclick();
  await sidebar.locator('input.rename').fill('Perso');
  await sidebar.locator('input.rename').press('Enter');
  await expect.poll(() => accountNames(sidebar)).toEqual(['Perso']);
});

test('shows all accounts in columns', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'Claude');
  await expect(sidebar.locator('.col-head')).toHaveCount(1);

  await sidebar.getByRole('button', { name: 'Columns' }).click();
  await expect(sidebar.locator('.col-head')).toHaveCount(2);

  await sidebar.getByRole('button', { name: 'Single' }).click();
  await expect(sidebar.locator('.col-head')).toHaveCount(1);
});

test('isolates the cookies and storage of each account', async ({ launch, service }) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'Claude');
  const [a, b] = await waitForServices(app, service.url, 2);
  if (a === undefined || b === undefined) throw new Error('vues manquantes');

  await evalIn(app, a, `document.cookie = 'who=A; path=/'; localStorage.setItem('who', 'A')`);

  // Same address, same domain: without isolation, account B would see A's cookie.
  expect(await evalIn<string>(app, b, 'document.cookie')).toBe('');
  expect(await evalIn<string | null>(app, b, `localStorage.getItem('who')`)).toBeNull();

  await evalIn(app, b, `document.cookie = 'who=B; path=/'; localStorage.setItem('who', 'B')`);
  expect(await evalIn<string>(app, a, 'document.cookie')).toBe('who=A');
  expect(await evalIn<string | null>(app, a, `localStorage.getItem('who')`)).toBe('A');
});

test('sends the intended browser identifier for each service', async ({ launch, service }) => {
  const { sidebar } = await launch(); // Claude: "cleaned" identifier
  await expect.poll(() => service.pageUserAgents).toHaveLength(1);
  await addAccount(sidebar, 'Gemini'); // Gemini: Electron's native identifier
  await expect.poll(() => service.pageUserAgents).toHaveLength(2);

  const [claude, gemini] = service.pageUserAgents;
  expect(claude).toContain('Chrome/');
  expect(claude).not.toMatch(/Electron\//);
  expect(claude).not.toMatch(/c(é|e|%c3%a9)nacle/i); // nor the app name
  expect(gemini).toMatch(/Electron\//);
  expect(gemini).toMatch(/^[\x20-\x7e]+$/); // ASCII only: the accents of the app name are mis-encoded
});

test('restores accounts, names and sessions after a restart', async ({ launch, service }) => {
  const first = await launch();
  await first.sidebar.locator('.account .name').dblclick();
  await first.sidebar.locator('input.rename').fill('Perso');
  await first.sidebar.locator('input.rename').press('Enter');
  await addAccount(first.sidebar, 'Gemini');
  await expect.poll(() => accountNames(first.sidebar)).toEqual(['Perso', 'Gemini 1']);

  const [claudeView] = await waitForServices(first.app, service.url, 1);
  if (claudeView === undefined) throw new Error('vue manquante');
  await evalIn(first.app, claudeView, `localStorage.setItem('who', 'perso')`);
  await first.app.close();

  const second = await launch();
  await expect.poll(() => accountNames(second.sidebar)).toEqual(['Perso', 'Gemini 1']);
  await expect(second.sidebar.locator('.account.active .name')).toHaveText('Gemini 1');

  // The "Perso" account must get its own session back.
  await second.sidebar.locator('.account', { hasText: 'Perso' }).click();
  // After a restart, the Gemini view (active account) is created first: the "Perso" one,
  // opened afterwards, is the most recent.
  const persoView = (await waitForServices(second.app, service.url, 2)).at(-1);
  if (persoView === undefined) throw new Error('vue manquante');
  await expect
    .poll(() => evalIn<string | null>(second.app, persoView, `localStorage.getItem('who')`))
    .toBe('perso');
});

test('a hidden page regaining focus does not change the active account', async ({
  launch,
  service,
}) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'Gemini');
  await expect(sidebar.locator('.account.active .name')).toHaveText('Gemini 1');
  const [claudeView] = await waitForServices(app, service.url, 2);

  // Chromium may give the focus back to a hidden page (for example while closing).
  await app.evaluate(({ webContents }, id) => webContents.fromId(id)?.emit('focus'), claudeView);

  await expect(sidebar.locator('.account.active .name')).toHaveText('Gemini 1');
});
