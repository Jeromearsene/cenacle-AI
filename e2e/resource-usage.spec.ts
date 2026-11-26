import type { ElectronApplication } from '@playwright/test';
import { computeUsage, formatCpu, formatMemory } from '../src/shared/metrics';
import { addAccount, expect, test, waitForServices } from './fixtures';

test.describe('resource usage maths (without launching the app)', () => {
  const samples = [
    { pid: 1, cpu: 2, memoryKb: 100_000 }, // main process
    { pid: 2, cpu: 3, memoryKb: 50_000 }, // GPU
    { pid: 10, cpu: 12, memoryKb: 400_000 }, // account a
    { pid: 11, cpu: 30, memoryKb: 800_000 }, // account b
    { pid: 12, cpu: 1, memoryKb: 20_000 }, // frame of another site
  ];

  test('gives each account its own process, the rest is shared', () => {
    const usage = computeUsage(
      samples,
      new Map([
        ['a', 10],
        ['b', 11],
      ])
    );
    expect(usage.accounts).toEqual([
      { id: 'a', usage: { cpu: 12, memoryKb: 400_000 } },
      { id: 'b', usage: { cpu: 30, memoryKb: 800_000 } },
    ]);
    expect(usage.shared).toEqual({ cpu: 6, memoryKb: 170_000 });
    expect(usage.total).toEqual({ cpu: 48, memoryKb: 1_370_000 });
  });

  test('an account that is not loaded has no figures, and keeps its place in the list', () => {
    const usage = computeUsage(
      samples,
      new Map<string, number | null>([
        ['a', null],
        ['b', 11],
      ])
    );
    expect(usage.accounts.map((a) => a.id)).toEqual(['a', 'b']);
    expect(usage.accounts[0]?.usage).toBeNull();
    // process 10 is claimed by nobody now, so it counts as shared
    expect(usage.shared.memoryKb).toBe(570_000);
  });

  test('a process that has disappeared since is not an error', () => {
    const usage = computeUsage(samples, new Map([['a', 999]]));
    expect(usage.accounts).toEqual([{ id: 'a', usage: null }]);
    expect(usage.total.memoryKb).toBe(1_370_000);
  });

  test('two accounts in one process: counted once in the shared part and the total', () => {
    const usage = computeUsage(
      samples,
      new Map([
        ['a', 10],
        ['b', 10],
      ])
    );
    expect(usage.accounts[0]?.usage).toEqual(usage.accounts[1]?.usage);
    expect(usage.shared.memoryKb).toBe(970_000);
    expect(usage.total.memoryKb).toBe(1_370_000);
  });

  test('no process at all', () => {
    expect(computeUsage([], new Map([['a', 10]]))).toEqual({
      accounts: [{ id: 'a', usage: null }],
      shared: { cpu: 0, memoryKb: 0 },
      total: { cpu: 0, memoryKb: 0 },
    });
  });

  test('memory is shown in MB, then in GB, in the language of the interface', () => {
    const plain = (text: string) => text.replace(/\s/g, ' '); // some languages use a no-break space
    expect(plain(formatMemory(512 * 1024, 'en'))).toBe('512 MB');
    expect(plain(formatMemory(1.25 * 1024 * 1024, 'en'))).toBe('1.3 GB');
    expect(plain(formatMemory(512 * 1024, 'fr'))).toBe('512 Mo');
    expect(plain(formatMemory(1.5 * 1024 * 1024, 'fr'))).toBe('1,5 Go');
    expect(plain(formatCpu(12.4, 'en'))).toBe('12%');
    expect(plain(formatCpu(12.4, 'fr'))).toBe('12 %');
    expect(plain(formatCpu(130, 'en'))).toBe('130%');
  });
});

/** Chooses View → Development → Resource usage. */
const chooseUsage = (app: ElectronApplication) =>
  app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('resource-usage')?.click());

test('View → Development → Resource usage shows the memory and CPU of each account, and closes again', async ({
  launch,
  service,
}) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await waitForServices(app, new URL(service.url).origin, 2);
  const panel = sidebar.getByRole('region', { name: 'Resource usage' });
  await expect(panel).toBeHidden();

  await chooseUsage(app);
  await expect(panel).toBeVisible();
  const row = (name: string) => panel.locator('tbody tr', { hasText: name });
  await expect(row('Claude 1').locator('td')).toHaveText([/^\d+ [MG]B$/, /^\d+%$/]);
  await expect(row('ChatGPT 1').locator('td')).toHaveText([/^\d+ [MG]B$/, /^\d+%$/]);
  // the pages are only part of the total
  await expect(panel.locator('[data-row=shared] td')).toHaveText([/^\d+ [MG]B$/, /^\d+%$/]);
  await expect(panel.locator('[data-row=total] td')).toHaveText([/^\d+(\.\d)? [MG]B$/, /^\d+%$/]);
  // the panel stays in the sidebar, where nothing hides it
  const box = await panel.boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(220);

  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toBeHidden();
  await chooseUsage(app);
  await expect(panel).toBeVisible();
  await chooseUsage(app); // the menu entry toggles
  await expect(panel).toBeHidden();
});

test('an account whose page is not loaded yet shows a dash instead of figures', async ({
  launch,
  service,
}) => {
  const first = await launch();
  await addAccount(first.sidebar, 'ChatGPT'); // the new account becomes the active one
  await first.app.close();

  // Single mode only loads the active account's page at startup.
  const { app, sidebar } = await launch();
  await waitForServices(app, new URL(service.url).origin, 1);
  await chooseUsage(app);
  const panel = sidebar.getByRole('region', { name: 'Resource usage' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('tbody tr', { hasText: 'ChatGPT 1' }).locator('td')).toHaveText([
    /^\d+ [MG]B$/,
    /^\d+%$/,
  ]);
  await expect(panel.locator('tbody tr', { hasText: 'Claude 1' }).locator('td')).toHaveText('–');
});

test('the panel is translated', async ({ launch }) => {
  const { app, sidebar } = await launch({ lang: 'fr-FR' });
  await chooseUsage(app);
  await expect(sidebar.getByRole('region', { name: 'Utilisation des ressources' })).toBeVisible();
  await expect(sidebar.getByRole('columnheader', { name: 'Mémoire' })).toBeVisible();
  const labels = await app.evaluate(
    ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('resource-usage')?.label
  );
  expect(labels).toBe('Utilisation des ressources');
});
