import type { Page } from '@playwright/test';
import type { ContextActions, ContextParams } from '../src/main/context-menu-template';
import { contextMenuTemplate } from '../src/main/context-menu-template';
import { expect, test } from './fixtures';

const noActions: ContextActions = {
  openLink: () => {},
  copyLink: () => {},
  copyImage: () => {},
  replaceMisspelling: () => {},
  addToDictionary: () => {},
  inspect: () => {},
};

const params = (over: Partial<ContextParams> = {}): ContextParams => ({
  isEditable: false,
  selectionText: '',
  linkURL: '',
  mediaType: 'none',
  misspelledWord: '',
  dictionarySuggestions: [],
  editFlags: {
    canUndo: false,
    canRedo: false,
    canCut: false,
    canCopy: false,
    canPaste: true,
    canSelectAll: true,
  },
  ...over,
});

const labels = (p: ContextParams) =>
  contextMenuTemplate(p, noActions).map((i) => (i.type === 'separator' ? '—' : i.label));

test.describe('menu template (without launching the app)', () => {
  test('input field: editing + inspect', () => {
    expect(labels(params({ isEditable: true }))).toEqual([
      'Annuler',
      'Rétablir',
      '—',
      'Couper',
      'Copier',
      'Coller',
      'Coller sans mise en forme',
      'Tout sélectionner',
      '—',
      'Inspecter l’élément',
    ]);
  });

  test('faute d’orthographe : suggestions (5 max) et ajout au dictionnaire', () => {
    const l = labels(
      params({
        isEditable: true,
        misspelledWord: 'bonjoure',
        dictionarySuggestions: ['bonjour', 'bonjours', 'a', 'b', 'c', 'd', 'e'],
      })
    );
    expect(l.slice(0, 6)).toEqual([
      'bonjour',
      'bonjours',
      'a',
      'b',
      'c',
      'Ajouter au dictionnaire',
    ]);
  });

  test('lien : ouvrir et copier l’adresse', () => {
    expect(labels(params({ linkURL: 'https://example.com/' }))).toEqual([
      'Ouvrir le lien dans le navigateur',
      'Copier l’adresse du lien',
      '—',
      'Inspecter l’élément',
    ]);
  });

  test('selected text outside a field: copy', () => {
    expect(labels(params({ selectionText: 'abc' }))).toContain('Copier');
  });

  test('never ends with a separator nor doubles one', () => {
    for (const p of [params(), params({ isEditable: true }), params({ mediaType: 'image' })]) {
      const l = labels(p);
      expect(l.at(-1)).not.toBe('—');
      expect(l.join('|')).not.toContain('—|—');
    }
  });
});

test('clic droit dans une page de service : le menu s’affiche', async ({ launch, service }) => {
  const { app } = await launch();
  // The real display of the menu is replaced by a recording of its entries.
  await app.evaluate(({ Menu }) => {
    const shown: string[][] = [];
    (globalThis as Record<string, unknown>).__menus = shown;
    Menu.prototype.popup = function () {
      shown.push(this.items.map((i) => i.label));
    };
  });
  const lastMenu = () =>
    app.evaluate(() => {
      const shown = (globalThis as Record<string, unknown>).__menus as string[][];
      return shown.at(-1) ?? null;
    });

  const servicePage = () => app.windows().find((p) => p.url().startsWith(service.url));
  await expect.poll(() => servicePage() !== undefined).toBe(true);
  const target = servicePage() as Page;

  await target.locator('#field').click({ button: 'right' });
  await expect.poll(lastMenu).toContain('Coller');

  await target.locator('#lien').click({ button: 'right' });
  await expect.poll(lastMenu).toContain('Ouvrir le lien dans le navigateur');
});
