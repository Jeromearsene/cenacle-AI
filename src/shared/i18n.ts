// Interface translations, shared by the main process (menus, dialogs, context menu) and the
// renderer (sidebar). Shared file: it must not import anything from Node or Electron.
//
// To add a language: add its tag to LOCALES, then add a `Record<MessageKey, string>` below.
// TypeScript refuses a translation that misses a key.

export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

const en = {
  // sidebar
  'sidebar.accounts': 'Accounts',
  'sidebar.addAccount': '+ Add account',
  'account.rename': 'Rename',
  'account.notInGrid': 'Not in the grid: drag it onto the grid to add it',
  'account.delete': 'Delete',
  'account.nameLabel': 'Account name',
  'layout.label': 'Layout',
  'layout.single': 'Single',
  'layout.grid': 'Grid',
  'cell.reload': 'Reload',
  'cell.move': 'Drag to rearrange',
  'cell.remove': 'Remove from the grid',
  'grid.resize': 'Resize',
  'grid.resizeHint': 'Drag, or use the arrow keys; double-click to equalize',
  'grid.equalize': 'Equalize sizes',
  'grid.swap': 'Swap',
  'grid.replace': 'Replace',
  'grid.noRoom': 'Not enough room',
  'quota.pillFull': 'Full',
  'quota.pillWarning': '90%+',
  'quota.back': 'back {time}',
  'quota.backIn': 'back at {time} · in {left}',
  'quota.tooltipFull': '{name} · usage limit reached',
  'quota.tooltipWarning': '{name} · over 90% of the usage limit used',
  'quota.tooltipDetail': '{left} left out of 5 h · resets at {time}',
  'quota.notifyTitle': 'Usage limit is back',
  'quota.notifyBody': 'Your usage limit has been reset. You can resume your conversation.',

  // delete confirmation
  'dialog.deleteTitle': 'Delete “{name}”?',
  'dialog.deleteDetail':
    'This account’s session (sign-in, cookies, local data) will be erased from this app. The account itself, at the service, is not affected.',
  'dialog.delete': 'Delete',
  'dialog.cancel': 'Cancel',

  // application menu
  'menu.file': 'File',
  'menu.accounts': 'Accounts',
  'menu.newAccount': 'New account',
  'menu.nextAccount': 'Next account',
  'menu.previousAccount': 'Previous account',
  'menu.reloadActive': 'Reload the active account',
  'menu.view': 'View',
  'menu.showSingle': 'Show a single account',
  'menu.showGrid': 'Show as a grid',
  'menu.equalizeGrid': 'Equalize cell sizes',
  'menu.resetGrid': 'Reset the grid',
  'menu.zoomIn': 'Zoom in',
  'menu.zoomOut': 'Zoom out',
  'menu.actualSize': 'Actual size',
  'menu.maximizeWindow': 'Maximize window',
  'menu.devTools': 'Developer tools (active account)',

  // right-click menu
  'context.noSuggestion': 'No suggestion',
  'context.addToDictionary': 'Add to dictionary',
  'context.openLink': 'Open link in browser',
  'context.copyLink': 'Copy link address',
  'context.copyImage': 'Copy image',
  'context.undo': 'Undo',
  'context.redo': 'Redo',
  'context.cut': 'Cut',
  'context.copy': 'Copy',
  'context.paste': 'Paste',
  'context.pasteMatchStyle': 'Paste and match style',
  'context.selectAll': 'Select all',
  'context.inspect': 'Inspect element',

  // temporary notification test (see src/main/notification-test.ts)
  'menu.testNotifications': 'Test notifications…',
  'notifTest.title': 'Notification test',
  'notifTest.nativeLabel': 'System notification (app):',
  'notifTest.webLabel': 'Web notification (active account):',
  'notifTest.native.show': 'shown ✓',
  'notifTest.native.timeout': 'no answer after 5 s: check whether a banner appeared',
  'notifTest.native.unsupported': 'not supported on this system',
  'notifTest.nativeFailed': 'refused by the system ({error})',
  'notifTest.web.show': 'shown ✓',
  'notifTest.web.error': 'refused',
  'notifTest.web.timeout': 'no event after 5 s: check whether a banner appeared',
  'notifTest.web.throw': 'could not be created ({error})',
  'notifTest.web.unavailable': 'not available in this page',
  'notifTest.permission': 'permission: {permission}',
  'notifTest.webNone': 'no account page to test',
  'notifTest.hintSigning':
    'On macOS, an unsigned app cannot display notifications. See “Testing notifications on macOS” in CONTRIBUTING.md.',
} as const;

export type MessageKey = keyof typeof en;

const fr: Record<MessageKey, string> = {
  'sidebar.accounts': 'Comptes',
  'sidebar.addAccount': '+ Ajouter un compte',
  'account.rename': 'Renommer',
  'account.notInGrid': 'Hors de la grille : glisse-le sur une case pour l’ajouter',
  'account.delete': 'Supprimer',
  'account.nameLabel': 'Nom du compte',
  'layout.label': 'Mise en page',
  'layout.single': 'Un seul',
  'layout.grid': 'Grille',
  'cell.reload': 'Recharger',
  'cell.move': 'Glisser pour réorganiser',
  'cell.remove': 'Retirer de la grille',
  'grid.resize': 'Redimensionner',
  'grid.resizeHint': 'Glisser, ou flèches du clavier ; double-clic pour égaliser',
  'grid.equalize': 'Égaliser les tailles',
  'grid.swap': 'Échanger',
  'grid.replace': 'Remplacer',
  'grid.noRoom': 'Pas assez de place',
  'quota.pillFull': 'Plein',
  'quota.pillWarning': '90 %+',
  'quota.back': 'retour {time}',
  'quota.backIn': 'retour à {time} · dans {left}',
  'quota.tooltipFull': '{name} · limite d’utilisation atteinte',
  'quota.tooltipWarning': '{name} · plus de 90 % de la limite d’utilisation consommés',
  'quota.tooltipDetail': '{left} restantes sur 5 h · réinitialisation à {time}',
  'quota.notifyTitle': 'Quota de retour',
  'quota.notifyBody':
    'Votre limite d’utilisation a été réinitialisée. Vous pouvez reprendre la conversation.',

  'dialog.deleteTitle': 'Supprimer « {name} » ?',
  'dialog.deleteDetail':
    'La session de ce compte (connexion, cookies, données locales) sera effacée de cet outil. Le compte lui-même, chez le service, n’est pas touché.',
  'dialog.delete': 'Supprimer',
  'dialog.cancel': 'Annuler',

  'menu.file': 'Fichier',
  'menu.accounts': 'Comptes',
  'menu.newAccount': 'Nouveau compte',
  'menu.nextAccount': 'Compte suivant',
  'menu.previousAccount': 'Compte précédent',
  'menu.reloadActive': 'Recharger le compte actif',
  'menu.view': 'Affichage',
  'menu.showSingle': 'Afficher un seul compte',
  'menu.showGrid': 'Afficher en grille',
  'menu.equalizeGrid': 'Égaliser la taille des cases',
  'menu.resetGrid': 'Réinitialiser la grille',
  'menu.zoomIn': 'Zoom avant',
  'menu.zoomOut': 'Zoom arrière',
  'menu.actualSize': 'Taille réelle',
  'menu.maximizeWindow': 'Agrandir la fenêtre',
  'menu.devTools': 'Outils de développement (compte actif)',

  'context.noSuggestion': 'Aucune suggestion',
  'context.addToDictionary': 'Ajouter au dictionnaire',
  'context.openLink': 'Ouvrir le lien dans le navigateur',
  'context.copyLink': 'Copier l’adresse du lien',
  'context.copyImage': 'Copier l’image',
  'context.undo': 'Annuler',
  'context.redo': 'Rétablir',
  'context.cut': 'Couper',
  'context.copy': 'Copier',
  'context.paste': 'Coller',
  'context.pasteMatchStyle': 'Coller sans mise en forme',
  'context.selectAll': 'Tout sélectionner',
  'context.inspect': 'Inspecter l’élément',

  'menu.testNotifications': 'Tester les notifications…',
  'notifTest.title': 'Test des notifications',
  'notifTest.nativeLabel': 'Notification système (app) :',
  'notifTest.webLabel': 'Notification web (compte actif) :',
  'notifTest.native.show': 'affichée ✓',
  'notifTest.native.timeout': 'pas de réponse après 5 s : vérifie si une bannière est apparue',
  'notifTest.native.unsupported': 'non prise en charge sur ce système',
  'notifTest.nativeFailed': 'refusée par le système ({error})',
  'notifTest.web.show': 'affichée ✓',
  'notifTest.web.error': 'refusée',
  'notifTest.web.timeout': 'aucun événement après 5 s : vérifie si une bannière est apparue',
  'notifTest.web.throw': 'impossible à créer ({error})',
  'notifTest.web.unavailable': 'indisponible dans cette page',
  'notifTest.permission': 'permission : {permission}',
  'notifTest.webNone': 'aucune page de compte à tester',
  'notifTest.hintSigning':
    'Sur macOS, une app non signée ne peut pas afficher de notifications. Voir « Testing notifications on macOS » dans CONTRIBUTING.md.',
};

export const messages: Record<Locale, Record<MessageKey, string>> = { en, fr };

/** Picks the interface language from a system language tag ("fr-FR", "en_US"…). */
export function resolveLocale(tag: string | undefined): Locale {
  const base = (tag ?? '').toLowerCase().split(/[-_]/)[0];
  return LOCALES.find((l) => l === base) ?? DEFAULT_LOCALE;
}

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/** A `t(key, { name })` function for a language; `{name}` in a message is replaced. */
export function translator(locale: Locale): Translate {
  const table = messages[locale];
  return (key, params) =>
    table[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
      params && name in params ? String(params[name]) : whole
    );
}
