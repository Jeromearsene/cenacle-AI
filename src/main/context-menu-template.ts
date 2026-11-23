import type { MenuItemConstructorOptions } from 'electron';

// Template of the right-click menu of service pages. Pure function (no dependency on Electron
// beyond types): testable without launching the app.

export interface ContextParams {
  isEditable: boolean;
  selectionText: string;
  linkURL: string;
  mediaType: string;
  misspelledWord: string;
  dictionarySuggestions: string[];
  editFlags: {
    canUndo: boolean;
    canRedo: boolean;
    canCut: boolean;
    canCopy: boolean;
    canPaste: boolean;
    canSelectAll: boolean;
  };
}

export interface ContextActions {
  openLink(url: string): void;
  copyLink(url: string): void;
  copyImage(): void;
  replaceMisspelling(word: string): void;
  addToDictionary(word: string): void;
  inspect(): void;
}

const SEP: MenuItemConstructorOptions = { type: 'separator' };
const MAX_SUGGESTIONS = 5;

export function contextMenuTemplate(
  p: ContextParams,
  a: ContextActions
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];
  const f = p.editFlags;

  if (p.isEditable && p.misspelledWord) {
    const word = p.misspelledWord;
    const suggestions = p.dictionarySuggestions.slice(0, MAX_SUGGESTIONS);
    if (suggestions.length === 0) items.push({ label: 'Aucune suggestion', enabled: false });
    for (const s of suggestions) items.push({ label: s, click: () => a.replaceMisspelling(s) });
    items.push({ label: 'Ajouter au dictionnaire', click: () => a.addToDictionary(word) }, SEP);
  }

  if (p.linkURL) {
    const url = p.linkURL;
    items.push(
      { label: 'Ouvrir le lien dans le navigateur', click: () => a.openLink(url) },
      { label: 'Copier l’adresse du lien', click: () => a.copyLink(url) },
      SEP
    );
  }

  if (p.mediaType === 'image')
    items.push({ label: 'Copier l’image', click: () => a.copyImage() }, SEP);

  if (p.isEditable) {
    items.push(
      { label: 'Annuler', role: 'undo', enabled: f.canUndo },
      { label: 'Rétablir', role: 'redo', enabled: f.canRedo },
      SEP,
      { label: 'Couper', role: 'cut', enabled: f.canCut },
      { label: 'Copier', role: 'copy', enabled: f.canCopy },
      { label: 'Coller', role: 'paste', enabled: f.canPaste },
      { label: 'Coller sans mise en forme', role: 'pasteAndMatchStyle', enabled: f.canPaste },
      { label: 'Tout sélectionner', role: 'selectAll', enabled: f.canSelectAll }
    );
  } else if (p.selectionText) {
    items.push(
      { label: 'Copier', role: 'copy', enabled: f.canCopy },
      { label: 'Tout sélectionner', role: 'selectAll', enabled: f.canSelectAll }
    );
  }

  if (items.at(-1) !== SEP && items.length > 0) items.push(SEP);
  items.push({ label: 'Inspecter l’élément', click: () => a.inspect() });
  return items;
}
