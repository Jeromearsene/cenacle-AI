import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

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
  await sidebar.locator('#accounts').click();
  await expect(panel).toBeHidden();
});

test('Tab stays inside the open panel', async ({ launch }) => {
  // Only the selected radio of each group is in the Tab order (roving tabindex), so with the
  // defaults that's exactly two stops: Language/System then Theme/System.
  const { sidebar } = await launch();
  const panel = await openSettings(sidebar);
  const languageSystem = panel.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', {
    name: 'System',
  });
  const themeSystem = panel.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', {
    name: 'System',
  });
  await expect(languageSystem).toBeFocused();

  await sidebar.keyboard.press('Tab');
  await expect(themeSystem).toBeFocused();
  // Wraps back to the first stop instead of leaving the dialog.
  await sidebar.keyboard.press('Tab');
  await expect(languageSystem).toBeFocused();

  // Same the other way around.
  await sidebar.keyboard.press('Shift+Tab');
  await expect(themeSystem).toBeFocused();
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
