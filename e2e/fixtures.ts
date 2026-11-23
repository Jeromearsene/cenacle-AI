import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { test as base, _electron as electron, expect } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '..');

/** Faux « service » : une page vide, et la liste des identifiants de navigateur reçus. */
export interface FakeService {
  url: string;
  /** User-Agent de chaque chargement de la page « / », dans l'ordre. */
  pageUserAgents: string[];
}

export interface Launched {
  app: ElectronApplication;
  sidebar: Page;
}

interface Fixtures {
  service: FakeService;
  userDataDir: string;
  /** Lance l'app (plusieurs fois possible avec le même dossier de données). */
  launch: () => Promise<Launched>;
}

async function startService(): Promise<{ service: FakeService; close: () => Promise<void> }> {
  const pageUserAgents: string[] = [];
  const server = http.createServer((req, res) => {
    if (req.url === '/') pageUserAgents.push(String(req.headers['user-agent'] ?? ''));
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(
      '<!doctype html><title>faux service</title><h1>faux service</h1>' +
        '<input id="field" value="bonjour"> <a id="lien" href="https://example.com/">un lien</a>' +
        // a notification created at load time: the dressing must already be in place
        "<script>window.earlyNotificationTitle = new Notification('early').title</script>"
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    service: { url: `http://127.0.0.1:${port}/`, pageUserAgents },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export const test = base.extend<Fixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright exige un objet déstructuré
  service: async ({}, use) => {
    const { service, close } = await startService();
    await use(service);
    await close();
  },

  // biome-ignore lint/correctness/noEmptyPattern: Playwright exige un objet déstructuré
  userDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multi-e2e-'));
    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  },

  launch: async ({ service, userDataDir }, use, testInfo) => {
    const launched: Launched[] = [];
    await use(async () => {
      // Sous Linux, le bac à sable de Chromium est refusé en root (conteneur) et sur les
      // runners GitHub (Ubuntu 24.04 restreint les espaces de noms utilisateur).
      const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
      const noSandbox = process.platform === 'linux' && (asRoot || Boolean(process.env.CI));
      const app = await electron.launch({
        args: [APP_ROOT, `--user-data-dir=${userDataDir}`, ...(noSandbox ? ['--no-sandbox'] : [])],
        env: { ...process.env, MULTI_TEST_URL: service.url },
      });
      const sidebar = await findSidebar(app);
      launched.push({ app, sidebar });
      return { app, sidebar };
    });
    // En cas d'échec, une capture de l'interface aide à comprendre ce qui s'est passé.
    if (testInfo.status !== testInfo.expectedStatus) {
      for (const [i, { sidebar }] of launched.entries()) {
        await sidebar
          .screenshot({ path: testInfo.outputPath(`interface-${i}.png`) })
          .catch(() => {});
      }
    }
    for (const { app } of launched) await app.close().catch(() => {});
  },
});

export { expect };

/** La page de l'interface (barre latérale), à distinguer des pages des services. */
async function findSidebar(app: ElectronApplication): Promise<Page> {
  const isSidebar = (p: Page) => p.url().includes('renderer/index.html');
  await expect
    .poll(() => app.windows().some(isSidebar), { message: 'fenêtre de l’interface' })
    .toBe(true);
  const page = app.windows().find(isSidebar) as Page;
  await page.waitForSelector('.account');
  return page;
}

/** Contenus web des services (un par compte déjà affiché), dans l'ordre de création. */
export async function serviceIds(app: ElectronApplication, origin: string): Promise<number[]> {
  const ids = await app.evaluate(
    ({ webContents }, o) =>
      webContents
        .getAllWebContents()
        .filter((wc) => wc.getURL().startsWith(o))
        .map((wc) => wc.id),
    origin
  );
  return ids.sort((a, b) => a - b);
}

/**
 * Attend qu'au moins `count` pages de service soient chargées, puis rend leurs identifiants. À préférer à
 * `serviceIds` seul : sur une machine lente (CI Windows, macOS), la page d'un compte n'a pas
 * toujours d'adresse au moment où on la cherche.
 */
export async function waitForServices(
  app: ElectronApplication,
  origin: string,
  count: number
): Promise<number[]> {
  await expect
    .poll(async () => (await serviceIds(app, origin)).length, {
      message: `au moins ${count} page(s) de service chargée(s)`,
    })
    .toBeGreaterThanOrEqual(count);
  return serviceIds(app, origin);
}

/** Exécute du JavaScript dans la page d'un service. */
export async function evalIn<T>(app: ElectronApplication, id: number, code: string): Promise<T> {
  return app.evaluate(
    ({ webContents }, { id, code }) => webContents.fromId(id)?.executeJavaScript(code),
    { id, code }
  ) as Promise<T>;
}

export const accountNames = (sidebar: Page): Promise<string[]> =>
  sidebar.locator('#accounts .account .name').allTextContents();
