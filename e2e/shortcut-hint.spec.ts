import { createShortcutHint, shortcutModifierFor } from '../src/main/shortcut-hint';
import { accountShortcutLabel, MAX_ACCOUNT_SHORTCUTS } from '../src/shared/shortcuts';
import { expect, test, waitForServices } from './fixtures';

const key = (type: 'keyDown' | 'keyUp', k: string, isAutoRepeat = false) => ({
  type,
  key: k,
  isAutoRepeat,
});

test.describe('shortcut numbers (⌘ / Ctrl held)', () => {
  test('labels: ⌘n on macOS, Ctrl+n elsewhere, nothing beyond 9', () => {
    expect(accountShortcutLabel(0, true)).toBe('⌘1');
    expect(accountShortcutLabel(8, false)).toBe('Ctrl+9');
    expect(accountShortcutLabel(MAX_ACCOUNT_SHORTCUTS, true)).toBeNull();
    expect(accountShortcutLabel(-1, true)).toBeNull();
    expect(shortcutModifierFor('darwin')).toBe('Meta');
    expect(shortcutModifierFor('win32')).toBe('Control');
    expect(shortcutModifierFor('linux')).toBe('Control');
  });

  test.describe('detecting that the key is held', () => {
    // Fake timer: fired by hand.
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

    test('shows after the delay, hides on release', () => {
      const { hint, changes, elapse } = setup();
      hint.handleInput(key('keyDown', 'Control'));
      expect(changes).toEqual([]);
      elapse();
      expect(changes).toEqual([true]);
      hint.handleInput(key('keyUp', 'Control'));
      expect(changes).toEqual([true, false]);
    });

    test('a quick press (⌘C, ⌘V…) shows nothing', () => {
      const { hint, changes, elapse, pending } = setup();
      hint.handleInput(key('keyDown', 'Control'));
      hint.handleInput(key('keyUp', 'Control'));
      expect(pending()).toBe(0);
      elapse();
      expect(changes).toEqual([]);
    });

    test('ignores other keys and auto-repeat', () => {
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

    test('reset (window loses focus) hides and cancels', () => {
      const { hint, changes, elapse, pending } = setup();
      hint.handleInput(key('keyDown', 'Control'));
      hint.reset();
      expect(pending()).toBe(0);
      hint.handleInput(key('keyDown', 'Control'));
      elapse();
      hint.reset();
      expect(changes).toEqual([true, false]);
      hint.reset(); // no effect: already hidden
      expect(changes).toEqual([true, false]);
    });
  });

  test('the interface shows the numbers while the key is held inside a page', async ({
    launch,
    service,
  }) => {
    const { app, sidebar } = await launch();
    await sidebar.getByRole('button', { name: '+ Ajouter un compte' }).click();
    await sidebar.getByRole('menuitem', { name: 'ChatGPT' }).click();
    await sidebar.locator('input.rename').press('Enter');
    await expect(sidebar.locator('#accounts .account')).toHaveCount(2);

    const modifier = shortcutModifierFor(process.platform);
    const ids = await waitForServices(app, new URL(service.url).origin, 2);
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
    // also in columns mode, above each page
    await sidebar.getByRole('button', { name: 'Colonnes' }).click();
    await expect(sidebar.locator('.col-head .shortcut')).toHaveText([
      label(1) as string,
      label(2) as string,
    ]);

    await send('keyUp');
    await expect(sidebar.locator('.shortcut')).toHaveCount(0);
  });
});
