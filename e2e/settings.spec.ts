import type { ElectronApplication, Page } from '@playwright/test';
import { addAccount, expect, test } from './fixtures';

// The toggle button and the panel are found through the stable `#settings` id, never through
// their accessible name: these tests switch the interface language mid-run, and that name is
// exactly what changes.
async function openSettings(sidebar: Page) {
  await sidebar.locator('#settings > button').click();
  return sidebar.locator('#settings [role="dialog"]');
}

test('System is selected by default for both language and theme', async ({ launch }) => {
  const { sidebar } = await launch();
  const panel = await openSettings(sidebar);
  const language = panel.getByRole('radiogroup', { name: 'Language' });
  const theme = panel.getByRole('radiogroup', { name: 'Theme' });
  await expect(language.getByRole('radio', { name: 'System' })).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await expect(theme.getByRole('radio', { name: 'System' })).toHaveAttribute(
    'aria-checked',
    'true'
  );
});

test('closes on Escape and on an outside click', async ({ launch }) => {
  const { sidebar } = await launch();
  const panel = await openSettings(sidebar);
  // Opening moves focus into the panel; also a sign the Escape listener below is now attached.
  await expect(panel.locator('[role="radio"]').first()).toBeFocused();
  await sidebar.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  await openSettings(sidebar);
  // The dialog is a full-window overlay now, so "outside" means the backdrop behind it, not some
  // other part of the sidebar (which the overlay covers).
  await sidebar.locator('[data-testid="settings-backdrop"]').click({ position: { x: 5, y: 5 } });
  await expect(panel).toBeHidden();
});

test('Tab stays inside the open panel', async ({ launch }) => {
  // Only the selected radio of each group is in the Tab order (roving tabindex), so with the
  // defaults that's three stops: Language/System, Theme/System, then the close button. Opening
  // focuses the first setting directly, not the close button, even though it comes first in the
  // DOM.
  const { sidebar } = await launch();
  const panel = await openSettings(sidebar);
  const languageSystem = panel.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', {
    name: 'System',
  });
  const themeSystem = panel.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', {
    name: 'System',
  });
  const close = panel.getByRole('button', { name: 'Close' });
  await expect(languageSystem).toBeFocused();

  await sidebar.keyboard.press('Tab');
  await expect(themeSystem).toBeFocused();
  await sidebar.keyboard.press('Tab');
  await expect(close).toBeFocused();
  // Wraps back to the first stop instead of leaving the dialog.
  await sidebar.keyboard.press('Tab');
  await expect(languageSystem).toBeFocused();

  // Same the other way around.
  await sidebar.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
});

test('arrow keys move the selection within a group', async ({ launch }) => {
  const { sidebar } = await launch();
  const panel = await openSettings(sidebar);
  const theme = panel.getByRole('radiogroup', { name: 'Theme' });
  // Focus the Theme group directly (the Tab handoff from Language is its own test, above).
  await theme.getByRole('radio', { name: 'System' }).focus();

  // THEMES is ['light', 'dark', 'system']: System (checked, focused) -> ArrowLeft -> Dark.
  await sidebar.keyboard.press('ArrowLeft');
  const dark = theme.getByRole('radio', { name: 'Dark' });
  await expect(dark).toHaveAttribute('aria-checked', 'true');
  await expect(dark).toBeFocused();
  await expect
    .poll(() => sidebar.evaluate(() => document.documentElement.dataset.theme))
    .toBe('dark');

  await sidebar.keyboard.press('ArrowRight');
  const system = theme.getByRole('radio', { name: 'System' });
  await expect(system).toHaveAttribute('aria-checked', 'true');
  await expect(system).toBeFocused();
});

test('picking a language switches the interface immediately, no restart needed', async ({
  launch,
}) => {
  const { sidebar } = await launch(); // English by default
  const panel = await openSettings(sidebar);
  await panel
    .getByRole('radiogroup', { name: 'Language' })
    .getByRole('radio', { name: 'Français' })
    .click();

  await expect(sidebar.getByRole('button', { name: '+ Ajouter un compte' })).toBeVisible();
  await expect(sidebar.locator('html')).toHaveAttribute('lang', 'fr');
  // The panel (found without relying on its, now French, accessible name) stays open, with the
  // new choice marked.
  await expect(
    panel.getByRole('radiogroup', { name: 'Langue' }).getByRole('radio', { name: 'Français' })
  ).toHaveAttribute('aria-checked', 'true');
});

test('picking "System" again drops the override', async ({ launch }) => {
  const { sidebar } = await launch({ lang: 'fr-FR' });
  const panel = await openSettings(sidebar);
  await panel
    .getByRole('radiogroup', { name: 'Langue' })
    .getByRole('radio', { name: 'English' })
    .click();
  await expect(sidebar.locator('html')).toHaveAttribute('lang', 'en');

  await panel
    .getByRole('radiogroup', { name: 'Language' })
    .getByRole('radio', { name: 'System' })
    .click();
  // Back to the system language (French, per the `lang` launch option).
  await expect(sidebar.locator('html')).toHaveAttribute('lang', 'fr');
});

test('picking a theme sets nativeTheme.themeSource, the switch Electron uses app-wide', async ({
  launch,
}) => {
  const { app, sidebar } = await launch();
  const panel = await openSettings(sidebar);

  await panel
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name: 'Dark' })
    .click();
  await expect.poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark');

  await panel
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name: 'Light' })
    .click();
  await expect.poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('light');

  await panel
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name: 'System' })
    .click();
  await expect
    .poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
    .toBe('system');
});

test('an explicit Light/Dark choice repaints the interface on its own', async ({ launch }) => {
  // Not every platform reliably carries nativeTheme's override into this window's own
  // `prefers-color-scheme` (see styles.css); `data-theme` is what actually repaints the sidebar,
  // so this is checked directly rather than assumed from nativeTheme.themeSource alone.
  const { sidebar } = await launch();
  const panel = await openSettings(sidebar);
  const bg = () => sidebar.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const before = await bg();

  await panel
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name: 'Dark' })
    .click();
  await expect(sidebar.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(bg).not.toBe(before);

  await panel
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name: 'Light' })
    .click();
  await expect(sidebar.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(bg).toBe(before);

  await panel
    .getByRole('radiogroup', { name: 'Theme' })
    .getByRole('radio', { name: 'System' })
    .click();
  // 'system' leaves the choice to the OS/prefers-color-scheme: no attribute override.
  await expect(sidebar.locator('html')).not.toHaveAttribute('data-theme');
});

test('language and theme survive a restart', async ({ launch }) => {
  const first = await launch();
  const firstPanel = await openSettings(first.sidebar);
  await firstPanel
    .getByRole('radiogroup', { name: 'Language' })
    .getByRole('radio', { name: 'Français' })
    .click();
  await firstPanel
    .getByRole('radiogroup', { name: 'Thème' })
    .getByRole('radio', { name: 'Sombre' })
    .click();
  await first.app.close();

  const second = await launch();
  await expect(second.sidebar.locator('html')).toHaveAttribute('lang', 'fr');
  await expect
    .poll(() => second.app.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
    .toBe('dark');
  const panel = await openSettings(second.sidebar);
  await expect(
    panel.getByRole('radiogroup', { name: 'Langue' }).getByRole('radio', { name: 'Français' })
  ).toHaveAttribute('aria-checked', 'true');
  await expect(
    panel.getByRole('radiogroup', { name: 'Thème' }).getByRole('radio', { name: 'Sombre' })
  ).toHaveAttribute('aria-checked', 'true');
});

test('reachable from the application menu, under ⌘, / Ctrl,', async ({ launch }) => {
  // The OS-level key binding itself can't be exercised from here (simulating a real ⌘/Ctrl
  // keypress doesn't reach native menu accelerators in this environment, headless or not — a
  // limitation of the test environment, not of the menu), so this drives the menu item directly,
  // the way Electron itself would once the accelerator fires.
  const { app, sidebar } = await launch();
  const found = await app.evaluate(({ Menu }) => {
    for (const item of Menu.getApplicationMenu()?.items ?? []) {
      const hit = item.submenu?.items.find((i) => i.accelerator === 'CmdOrCtrl+,');
      if (hit) return { parent: item.label, label: hit.label };
    }
    return null;
  });
  // macOS: the app's own menu (labeled after the app, not "File"); elsewhere: File.
  const expectedParent =
    process.platform === 'darwin' ? await app.evaluate(({ app }) => app.name) : 'File';
  expect(found).toEqual({ parent: expectedParent, label: 'Settings' });

  await app.evaluate(({ Menu }) => {
    for (const item of Menu.getApplicationMenu()?.items ?? []) {
      const hit = item.submenu?.items.find((i) => i.accelerator === 'CmdOrCtrl+,');
      if (hit) hit.click();
    }
  });
  await expect(sidebar.locator('#settings [role="dialog"]')).toBeVisible();
});

// Native side: the service pages are separate views placed by the main process (see grid.spec.ts),
// stacked above the window's own page — so the dialog, drawn in that page, can only cover them if
// main hides those views while it's open.
const nativeViewsVisible = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) =>
    (BrowserWindow.getAllWindows()[0]?.contentView.children ?? []).map((v) =>
      (v as unknown as { getVisible(): boolean }).getVisible()
    )
  );

test('opening Settings hides the service pages, so the dialog covers them too', async ({
  launch,
}) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'Gemini');
  // Grid layout, so both pages are visible at once (Single only shows the active one).
  await sidebar.getByRole('radio', { name: 'Grid' }).click();
  await expect.poll(() => nativeViewsVisible(app)).toEqual([true, true]);

  const panel = await openSettings(sidebar);
  await expect(panel).toBeVisible();
  await expect.poll(() => nativeViewsVisible(app)).toEqual([false, false]);

  await sidebar.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect.poll(() => nativeViewsVisible(app)).toEqual([true, true]);
});
