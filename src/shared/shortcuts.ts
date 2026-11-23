// Raccourcis « aller au compte n » : ⌘1…⌘9 sur macOS, Ctrl+1…9 ailleurs.
// Fichier partagé : il ne doit rien importer de Node ni d'Electron.

/** Nombre de comptes joignables par un raccourci (les chiffres 1 à 9). */
export const MAX_ACCOUNT_SHORTCUTS = 9;

/** Texte du raccourci du compte à la position `index` (0 = premier), ou null s'il n'en a pas. */
export function accountShortcutLabel(index: number, isMac: boolean): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_ACCOUNT_SHORTCUTS) return null;
  return `${isMac ? '⌘' : 'Ctrl+'}${index + 1}`;
}
