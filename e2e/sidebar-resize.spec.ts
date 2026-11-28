import type { ElectronApplication, Page } from '@playwright/test';
import { SIDEBAR_DEFAULT_W, SIDEBAR_MAX_W, SIDEBAR_MIN_W } from '../src/shared/sidebar';
import { expect, test } from './fixtures';

const handleOf = (sidebar: Page) => sidebar.locator('.sidebar-handle');
const asideWidth = async (sidebar: Page) =>
  (await sidebar.locator('aside').boundingBox())?.width ?? 0;

/** Press, move in small steps and release: what a user dragging with the mouse does. The target
 * stays inside the window (a pointer that leaves it does not keep sending clean coordinates), so
 * a `dx` larger than the window is how a test reaches "as far as the handle will go". */
async function dragHandle(sidebar: Page, dx: number): Promise<void> {
  const box = await handleOf(sidebar).boundingBox();
  if (!box) throw new Error('resize handle not visible');
  const windowWidth = await sidebar.evaluate(() => window.innerWidth);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const target = Math.min(Math.max(x + dx, 0), windowWidth - 1);
  await sidebar.mouse.move(x, y);
  await sidebar.mouse.down();
  await sidebar.mouse.move(target, y, { steps: 12 });
  await sidebar.mouse.up();
}

// Native side: the service pages are separate views placed by the main process.
const nativeViews = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) =>
    (BrowserWindow.getAllWindows()[0]?.contentView.children ?? []).map((v) => ({
      x: (v as unknown as { getBounds(): Electron.Rectangle }).getBounds().x,
      visible: (v as unknown as { getVisible(): boolean }).getVisible(),
    }))
  );
const visibleViewX = async (app: ElectronApplication) =>
  (await nativeViews(app)).filter((v) => v.visible).map((v) => v.x);

test('dragging the handle widens or narrows the sidebar, and moves the service page with it', async ({
  launch,
}) => {
  const { app, sidebar } = await launch();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(1200, 800)
  );
  const before = await asideWidth(sidebar);

  await dragHandle(sidebar, 60);
  await expect.poll(() => asideWidth(sidebar)).toBeGreaterThan(before + 40);
  // the service page starts exactly where the sidebar now ends
  const widened = Math.round(await asideWidth(sidebar));
  await expect.poll(() => visibleViewX(app)).toEqual([widened]);

  await dragHandle(sidebar, -120);
  await expect.poll(() => asideWidth(sidebar)).toBeLessThan(before);
});

test('the handle cannot push the sidebar past its minimum or maximum width', async ({ launch }) => {
  const { app, sidebar } = await launch();
  // enough room either side of [SIDEBAR_MIN_W, SIDEBAR_MAX_W] for the handle to actually hit both
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 700)
  );

  await dragHandle(sidebar, -5000);
  await expect.poll(() => asideWidth(sidebar).then(Math.round)).toBe(SIDEBAR_MIN_W);

  await dragHandle(sidebar, 5000);
  await expect.poll(() => asideWidth(sidebar).then(Math.round)).toBe(SIDEBAR_MAX_W);
});

test('while the handle is dragged, the cursor stays a resize cursor and the service pages hide', async ({
  launch,
}) => {
  const { app, sidebar } = await launch();
  const box = (await handleOf(sidebar).boundingBox()) as { x: number; y: number; height: number };
  await sidebar.mouse.move(box.x + 2, box.y + box.height / 2);
  await sidebar.mouse.down();
  await sidebar.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 6 });
  await expect(sidebar.locator('body')).toHaveCSS('cursor', 'col-resize');
  await expect(handleOf(sidebar)).toHaveAttribute('data-grabbed', 'true');
  await expect.poll(() => visibleViewX(app)).toEqual([]); // hidden while dragging
  await sidebar.mouse.up();
  await expect(sidebar.locator('body')).toHaveCSS('cursor', 'auto');
  await expect(handleOf(sidebar)).toHaveAttribute('data-grabbed', 'false');
  await expect.poll(async () => (await visibleViewX(app)).length).toBe(1); // back once dropped
});

test('the arrow keys resize the handle, and a double-click resets it', async ({ launch }) => {
  const { sidebar } = await launch();
  const before = await asideWidth(sidebar);

  await handleOf(sidebar).focus();
  await sidebar.keyboard.press('ArrowRight');
  await sidebar.keyboard.press('ArrowRight');
  await expect.poll(() => asideWidth(sidebar)).toBeGreaterThan(before + 20);
  await sidebar.keyboard.press('ArrowLeft');
  await sidebar.keyboard.press('ArrowLeft');
  await sidebar.keyboard.press('ArrowLeft');
  await expect.poll(() => asideWidth(sidebar)).toBeLessThan(before - 10);

  await handleOf(sidebar).dblclick();
  await expect.poll(() => asideWidth(sidebar).then(Math.round)).toBe(SIDEBAR_DEFAULT_W);
});

test('the sidebar width survives a restart', async ({ launch }) => {
  const { app, sidebar } = await launch();
  await dragHandle(sidebar, 80);
  const widened = Math.round(await asideWidth(sidebar));
  expect(widened).toBeGreaterThan(SIDEBAR_DEFAULT_W);
  await app.close();

  const again = await launch();
  await expect.poll(() => asideWidth(again.sidebar).then(Math.round)).toBe(widened);
});
