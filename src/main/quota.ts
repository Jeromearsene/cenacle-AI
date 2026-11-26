// Keeps the usage-limit state of every account and wakes up when a limit is reset.
// No dependency on Electron: testable without launching the app.
import { parseBanner, type QuotaInfo } from '../shared/quota';

export interface QuotaTracker {
  /** A banner text read in an account's page. Returns true when the state changed. */
  report(id: string, bannerText: string): boolean;
  /** Forgets an account (deleted). */
  forget(id: string): void;
  snapshot(): Record<string, QuotaInfo>;
  dispose(): void;
}

interface Options {
  /** The state changed: the interface must be updated. */
  onChange: () => void;
  /** A limit was reset (`level` is the level it had). */
  onReset: (id: string, previous: QuotaInfo) => void;
  now?: () => number;
}

// setTimeout cannot wait longer than this (about 24.8 days).
const MAX_DELAY = 2 ** 31 - 1;

export function createQuotaTracker({ onChange, onReset, now = Date.now }: Options): QuotaTracker {
  const entries = new Map<string, { info: QuotaInfo; timer: NodeJS.Timeout }>();

  const clear = (id: string) => {
    const entry = entries.get(id);
    if (entry) clearTimeout(entry.timer);
    entries.delete(id);
    return entry?.info;
  };

  return {
    report(id, bannerText) {
      const info = parseBanner(bannerText, now());
      if (!info) return false;
      const current = entries.get(id)?.info;
      if (current && current.level === info.level && current.resetsAt === info.resetsAt) {
        return false;
      }
      clear(id);
      const delay = Math.min(MAX_DELAY, Math.max(0, info.resetsAt - now()));
      const timer = setTimeout(() => {
        const previous = clear(id);
        if (previous) onReset(id, previous);
        onChange();
      }, delay);
      entries.set(id, { info, timer });
      onChange();
      return true;
    },
    forget(id) {
      if (clear(id)) onChange();
    },
    snapshot() {
      return Object.fromEntries([...entries].map(([id, { info }]) => [id, info]));
    },
    dispose() {
      for (const { timer } of entries.values()) clearTimeout(timer);
      entries.clear();
    },
  };
}
