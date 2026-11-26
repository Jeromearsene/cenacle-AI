import { useEffect, useState } from 'preact/hooks';
import type { PublicState } from '../shared/types';

export const api = window.multi;

/** The state published by the main process (accounts, layout, cells). */
export function useMultiState(): PublicState | null {
  const [state, setState] = useState<PublicState | null>(null);
  useEffect(() => {
    const off = api.onState(setState);
    void api.getState().then(setState);
    return off;
  }, []);
  return state;
}

/** True while ⌘ (macOS) or Ctrl (Windows, Linux) is held. */
export function useShortcutHint(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => api.onShortcutHint(setVisible), []);
  return visible;
}

/** The main process asks to rename an account (for example right after creating it). */
export function useRenameRequest(onRequest: (id: string) => void): void {
  useEffect(() => api.onRenameRequest(onRequest), [onRequest]);
}
