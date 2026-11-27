import { useEffect, useState } from 'preact/hooks';
import type { ResourceUsage } from '../shared/metrics';
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

/** The "Resource usage" menu entry was chosen. */
export function useResourceUsageToggle(onToggle: () => void): void {
  useEffect(() => api.onResourceUsageToggle(onToggle), [onToggle]);
}

/** Memory and CPU of each account, refreshed while `active` (CPU is measured between two samples). */
export function useResourceUsage(active: boolean, intervalMs = 2000): ResourceUsage | null {
  const [usage, setUsage] = useState<ResourceUsage | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const poll = () =>
      api
        .getResourceUsage()
        .then((u) => !cancelled && setUsage(u))
        .catch(() => {
          /* the next sample tries again */
        });
    void poll();
    const timer = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, intervalMs]);
  return usage;
}

/**
 * A new, distinct value each time the ⌘, / Ctrl, shortcut or the "Settings" menu item is used
 * (null until the first time). Settings watches this to open itself from outside its own button.
 */
export function useOpenSettingsRequest(): number | null {
  const [token, setToken] = useState<number | null>(null);
  useEffect(() => api.onOpenSettings(() => setToken(Date.now())), []);
  return token;
}
