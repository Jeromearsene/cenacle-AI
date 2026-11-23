// Detects that the shortcut key (⌘ on macOS, Ctrl elsewhere) is being held, so the interface can
// show each account's number, as Slack does. No dependency on Electron: the logic can be tested
// without launching the app.

export type ShortcutModifier = 'Meta' | 'Control';

export const shortcutModifierFor = (platform: string): ShortcutModifier =>
  platform === 'darwin' ? 'Meta' : 'Control';

/** The bare minimum of an Electron `before-input-event` event. */
export interface KeyInput {
  type: string;
  key: string;
  isAutoRepeat?: boolean;
}

export interface ShortcutHint {
  handleInput(input: KeyInput): void;
  /** Call when the window loses focus: the key release would never reach us. */
  reset(): void;
}

interface Options {
  modifier: ShortcutModifier;
  onChange: (visible: boolean) => void;
  /** Hold time before showing the hint: avoids a flash on ⌘C, ⌘V… */
  delayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export function createShortcutHint({
  modifier,
  onChange,
  delayMs = 250,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
}: Options): ShortcutHint {
  let visible = false;
  let timer: unknown = null;

  const reset = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    if (visible) {
      visible = false;
      onChange(false);
    }
  };

  return {
    reset,
    handleInput(input) {
      if (input.key !== modifier) return;
      if (input.type === 'keyUp') {
        reset();
      } else if (input.type === 'keyDown' && !input.isAutoRepeat && !visible && timer === null) {
        timer = setTimer(() => {
          timer = null;
          visible = true;
          onChange(true);
        }, delayMs);
      }
    },
  };
}
