import { useEffect, useState } from 'preact/hooks';
import type { PublicState } from '../shared/types';

export const api = window.multi;

/** L'état publié par le processus principal (comptes, mise en page, colonnes). */
export function useMultiState(): PublicState | null {
  const [state, setState] = useState<PublicState | null>(null);
  useEffect(() => {
    const off = api.onState(setState);
    void api.getState().then(setState);
    return off;
  }, []);
  return state;
}

/** Vrai tant que ⌘ (macOS) ou Ctrl (Windows, Linux) est maintenu. */
export function useShortcutHint(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => api.onShortcutHint(setVisible), []);
  return visible;
}

/** Le processus principal demande de renommer un compte (par exemple juste après sa création). */
export function useRenameRequest(onRequest: (id: string) => void): void {
  useEffect(() => api.onRenameRequest(onRequest), [onRequest]);
}
