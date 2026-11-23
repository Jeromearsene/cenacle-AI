// Détecte « la touche des raccourcis est maintenue » (⌘ sur macOS, Ctrl ailleurs) pour que
// l'interface affiche le numéro de chaque compte, comme Slack. Sans dépendance à Electron :
// la logique est testable sans lancer l'app.

export type ShortcutModifier = 'Meta' | 'Control';

export const shortcutModifierFor = (platform: string): ShortcutModifier =>
  platform === 'darwin' ? 'Meta' : 'Control';

/** Le strict nécessaire d'un événement `before-input-event` d'Electron. */
export interface KeyInput {
  type: string;
  key: string;
  isAutoRepeat?: boolean;
}

export interface ShortcutHint {
  handleInput(input: KeyInput): void;
  /** À appeler quand la fenêtre perd le focus : le relâchement de la touche ne nous parviendrait pas. */
  reset(): void;
}

interface Options {
  modifier: ShortcutModifier;
  onChange: (visible: boolean) => void;
  /** Délai de maintien avant l'affichage : évite un clignotement sur ⌘C, ⌘V… */
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
