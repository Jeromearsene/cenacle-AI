import { createShortcutHint, shortcutModifierFor } from '../src/main/shortcut-hint';
import { accountShortcutLabel, MAX_ACCOUNT_SHORTCUTS } from '../src/shared/shortcuts';
import { expect, serviceIds, test } from './fixtures';

const key = (type: 'keyDown' | 'keyUp', k: string, isAutoRepeat = false) => ({
  type,
  key: k,
  isAutoRepeat,
});

test.describe('numéros des raccourcis (⌘ / Ctrl maintenu)', () => {
  test('libellés : ⌘n sur macOS, Ctrl+n ailleurs, rien au-delà de 9', () => {
    expect(accountShortcutLabel(0, true)).toBe('⌘1');
    expect(accountShortcutLabel(8, false)).toBe('Ctrl+9');
    expect(accountShortcutLabel(MAX_ACCOUNT_SHORTCUTS, true)).toBeNull();
    expect(accountShortcutLabel(-1, true)).toBeNull();
    expect(shortcutModifierFor('darwin')).toBe('Meta');
    expect(shortcutModifierFor('win32')).toBe('Control');
    expect(shortcutModifierFor('linux')).toBe('Control');
  });

  test.describe('détection du maintien de la touche', () => {
    // Minuterie factice : on la déclenche à la main.
    function setup() {
      const changes: boolean[] = [];
      const timers = new Map<number, () => void>();
      let next = 1;
      const hint = createShortcutHint({
        modifier: 'Control',
        onChange: (v) => changes.push(v),
        setTimer: (fn) => {
          timers.set(next, fn);
          return next++;
        },
        clearTimer: (t) => timers.delete(t as number),
      });
      const elapse = () => {
        for (const [id, fn] of [...timers]) {
          timers.delete(id);
          fn();
        }
      };
      return { hint, changes, elapse, pending: () => timers.size };
    }

    test('s’affiche après le délai, disparaît au relâchement', () => {
      const { hint, changes, elapse } = setup();
      hint.handleInput(key('keyDown', 'Control'));
      expect(changes).toEqual([]);
      elapse();
      expect(changes).toEqual([true]);
      hint.handleInput(key('keyUp', 'Control'));
      expect(changes).toEqual([true, false]);
    });

    test('un appui bref (⌘C, ⌘V…) n’affiche rien', () => {
      const { hint, changes, elapse, pending } = setup();
      hint.handleInput(key('keyDown', 'Control'));
      hint.handleInput(key('keyUp', 'Control'));
      expect(pending()).toBe(0);
      elapse();
      expect(changes).toEqual([]);
    });

    test('ignore les autres touches et la répétition automatique', () => {
      const { hint, changes, elapse, pending } = setup();
      hint.handleInput(key('keyDown', 'a'));
      hint.handleInput(key('keyDown', 'Shift'));
      expect(pending()).toBe(0);
      hint.handleInput(key('keyDown', 'Control'));
      hint.handleInput(key('keyDown', 'Control', true));
      expect(pending()).toBe(1);
      elapse();
      hint.handleInput(key('keyDown', 'Control', true));
      expect(changes).toEqual([true]);
    });

    test('reset (fenêtre qui perd le focus) masque et annule', () => {
      const { hint, changes, elapse, pending } = setup();
      hint.handleInput(key('keyDown', 'Control'));
      hint.reset();
      expect(pending()).toBe(0);
      hint.handleInput(key('keyDown', 'Control'));
      elapse();
      hint.reset();
      expect(changes).toEqual([true, false]);
      hint.reset(); // sans effet : déjà masqué
      expect(changes).toEqual([true, false]);
    });
  });

  test('l’interface affiche les numéros tant que la touche est maintenue dans une page', async ({
    launch,
    service,
  }) => {
    const { app, sidebar } = await launch();
    await sidebar.getByRole('button', { name: '+ Ajouter un compte' }).click();
    await sidebar.getByRole('menuitem', { name: 'ChatGPT' }).click();
    await sidebar.locator('input.rename').press('Enter');
    await expect(sidebar.locator('#accounts .account')).toHaveCount(2);

    const modifier = shortcutModifierFor(process.platform);
    const ids = await serviceIds(app, new URL(service.url).origin);
    const send = (type: string) =>
      app.evaluate(
        ({ webContents }, { id, type, modifier }) =>
          webContents
            .fromId(id)
            ?.emit('before-input-event', { preventDefault() {} }, { type, key: modifier }),
        { id: ids[0], type, modifier }
      );

    const label = (n: number) => accountShortcutLabel(n - 1, process.platform === 'darwin');
    await expect(sidebar.locator('#accounts .shortcut')).toHaveCount(0);

    await send('keyDown');
    await expect(sidebar.locator('#accounts .shortcut')).toHaveText([
      label(1) as string,
      label(2) as string,
    ]);
    // en colonnes aussi, au-dessus de chaque page
    await sidebar.getByRole('button', { name: 'Colonnes' }).click();
    await expect(sidebar.locator('.col-head .shortcut')).toHaveText([
      label(1) as string,
      label(2) as string,
    ]);

    await send('keyUp');
    await expect(sidebar.locator('.shortcut')).toHaveCount(0);
  });
});
