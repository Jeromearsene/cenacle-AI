import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { test as base, _electron as electron, expect } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '..');

/** Fake "service": an empty page, and the list of browser identifiers received. */
export interface FakeService {
  url: string;
  /** User-Agent of each load of the "/" page, in order. */
  pageUserAgents: string[];
}

export interface LaunchOptions {
  /** Interface language (tests default to English whatever the machine language is). */
  lang?: string;
  /** Layout changes glide instead of jumping (off in the tests, which look at the end state). */
  animations?: boolean;
  /** More environment variables for the app. */
  env?: Record<string, string>;
}

export interface Launched {
  app: ElectronApplication;
  sidebar: Page;
}

interface Fixtures {
  service: FakeService;
  userDataDir: string;
  /** Launches the app (can be done several times with the same data folder). */
  launch: (options?: LaunchOptions) => Promise<Launched>;
}

/** The "favicon" of the fake service: a 1×1 PNG. */
const FAVICON = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

async function startService(): Promise<{ service: FakeService; close: () => Promise<void> }> {
  const pageUserAgents: string[] = [];
  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.png') {
      res.setHeader('content-type', 'image/png');
      res.end(FAVICON);
      return;
    }
    // Only the pages shown to the user: the app also fetches the start page to find the icon.
    if (req.url === '/' && req.headers['sec-fetch-dest'] !== 'empty') {
      pageUserAgents.push(String(req.headers['user-agent'] ?? ''));
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(
      '<!doctype html><link rel="icon" href="/favicon.png"><title>faux service</title><h1>faux service</h1>' +
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
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured object
  service: async ({}, use) => {
    const { service, close } = await startService();
    await use(service);
    await close();
  },

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured object
  userDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multi-e2e-'));
    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  },

  launch: async ({ service, userDataDir }, use, testInfo) => {
    const launched: Launched[] = [];
    await use(async ({ lang = 'en', animations = false, env = {} }: LaunchOptions = {}) => {
      // On Linux, Chromium's sandbox is refused as root (container) and on GitHub runners
      // (Ubuntu 24.04 restricts user namespaces).
      const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
      const noSandbox = process.platform === 'linux' && (asRoot || Boolean(process.env.CI));
      const app = await electron.launch({
        args: [APP_ROOT, `--user-data-dir=${userDataDir}`, ...(noSandbox ? ['--no-sandbox'] : [])],
        env: {
          ...process.env,
          MULTI_TEST_URL: service.url,
          CENACLE_LANG: lang,
          CENACLE_ANIMATIONS: animations ? '1' : '0',
          // Without the icons shipped with the app, so that the tests see the ones the fake
          // service announces (a test can point to a folder of its own).
          CENACLE_ICONS_DIR: path.join(userDataDir, 'no-icons'),
          ...env,
        },
      });
      const sidebar = await findSidebar(app);
      launched.push({ app, sidebar });
      return { app, sidebar };
    });
    // On failure, a screenshot of the interface helps understand what happened.
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

/** The interface page (sidebar), to tell apart from the service pages. */
async function findSidebar(app: ElectronApplication): Promise<Page> {
  const isSidebar = (p: Page) => p.url().includes('renderer/index.html');
  await expect
    .poll(() => app.windows().some(isSidebar), { message: 'interface window' })
    .toBe(true);
  const page = app.windows().find(isSidebar) as Page;
  await page.waitForSelector('.account');
  return page;
}

/** Web contents of the services (one per account already displayed), in creation order. */
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
 * Waits until at least `count` service pages are loaded, then returns their ids. Prefer it to
 * `serviceIds` alone: on a slow machine (Windows, macOS CI), an account's page does not always
 * have an address yet when it is looked up.
 */
export async function waitForServices(
  app: ElectronApplication,
  origin: string,
  count: number
): Promise<number[]> {
  await expect
    .poll(async () => (await serviceIds(app, origin)).length, {
      message: `at least ${count} service page(s) loaded`,
    })
    .toBeGreaterThanOrEqual(count);
  return serviceIds(app, origin);
}

/** Runs JavaScript in a service page. */
export async function evalIn<T>(app: ElectronApplication, id: number, code: string): Promise<T> {
  return app.evaluate(
    ({ webContents }, { id, code }) => webContents.fromId(id)?.executeJavaScript(code),
    { id, code }
  ) as Promise<T>;
}

/** Adds an account of the given service (by its label) and keeps the proposed name. */
export async function addAccount(sidebar: Page, label: string): Promise<void> {
  await sidebar.getByRole('button', { name: '+ Add account' }).click();
  await sidebar.getByRole('menuitem', { name: label }).click();
  await sidebar.locator('input.rename').press('Enter');
}

export const accountNames = (sidebar: Page): Promise<string[]> =>
  sidebar.locator('#accounts .account .name').allTextContents();
