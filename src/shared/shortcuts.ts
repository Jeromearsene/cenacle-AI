// "Go to account n" shortcuts: ⌘1…⌘9 on macOS, Ctrl+1…9 elsewhere.
// Shared file: it must not import anything from Node or Electron.

/** Number of accounts reachable through a shortcut (the digits 1 to 9). */
export const MAX_ACCOUNT_SHORTCUTS = 9;

/** Shortcut text of the account at position `index` (0 = first), or null if it has none. */
export function accountShortcutLabel(index: number, isMac: boolean): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_ACCOUNT_SHORTCUTS) return null;
  return `${isMac ? '⌘' : 'Ctrl+'}${index + 1}`;
}
