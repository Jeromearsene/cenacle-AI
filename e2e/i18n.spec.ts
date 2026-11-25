import { LOCALES, messages, resolveLocale, translator } from '../src/shared/i18n';
import { expect, test } from './fixtures';

test.describe('interface language (without launching the app)', () => {
  test('follows the system language, with English as the fallback', () => {
    expect(resolveLocale('fr')).toBe('fr');
    expect(resolveLocale('fr-FR')).toBe('fr');
    expect(resolveLocale('fr_CA')).toBe('fr');
    expect(resolveLocale('EN-us')).toBe('en');
    expect(resolveLocale('de-DE')).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  test('every language defines exactly the same messages, none empty', () => {
    const reference = Object.keys(messages.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(messages[locale]).sort(), locale).toEqual(reference);
      for (const [key, text] of Object.entries(messages[locale])) {
        expect(text.trim(), `${locale}:${key}`).not.toBe('');
      }
    }
  });

  test('every language keeps the same placeholders', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const locale of LOCALES) {
      for (const [key, text] of Object.entries(messages[locale])) {
        expect(placeholders(text), `${locale}:${key}`).toEqual(
          placeholders(messages.en[key as keyof typeof messages.en])
        );
      }
    }
  });

  test('replaces the placeholders and leaves unknown ones untouched', () => {
    expect(translator('en')('dialog.deleteTitle', { name: 'Work' })).toBe('Delete “Work”?');
    expect(translator('fr')('dialog.deleteTitle', { name: 'Perso' })).toBe('Supprimer « Perso » ?');
    expect(translator('en')('dialog.deleteTitle')).toContain('{name}');
  });
});

test('English interface by default', async ({ launch }) => {
  const { app, sidebar } = await launch();
  await expect(sidebar.getByRole('button', { name: '+ Add account' })).toBeVisible();
  await expect(sidebar.getByRole('radio', { name: 'Grid' })).toBeVisible();
  await expect(sidebar.locator('html')).toHaveAttribute('lang', 'en');
  const labels = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()?.items.map((item) => item.label)
  );
  expect(labels).toContain('Accounts');
});

test('French interface when the system language is French', async ({ launch }) => {
  const { app, sidebar } = await launch({ lang: 'fr-FR' });
  await expect(sidebar.getByRole('button', { name: '+ Ajouter un compte' })).toBeVisible();
  await expect(sidebar.getByRole('radio', { name: 'Grille' })).toBeVisible();
  await expect(sidebar.getByRole('radio', { name: 'Un seul' })).toBeVisible();
  await expect(sidebar.locator('html')).toHaveAttribute('lang', 'fr');
  const labels = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()?.items.map((item) => item.label)
  );
  expect(labels).toContain('Comptes');
});
