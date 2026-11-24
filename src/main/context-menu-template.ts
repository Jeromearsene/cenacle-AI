import type { MenuItemConstructorOptions } from 'electron';
import type { Translate } from '../shared/i18n';

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
  a: ContextActions,
  t: Translate
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];
  const f = p.editFlags;

  if (p.isEditable && p.misspelledWord) {
    const word = p.misspelledWord;
    const suggestions = p.dictionarySuggestions.slice(0, MAX_SUGGESTIONS);
    if (suggestions.length === 0) items.push({ label: t('context.noSuggestion'), enabled: false });
    for (const s of suggestions) items.push({ label: s, click: () => a.replaceMisspelling(s) });
    items.push({ label: t('context.addToDictionary'), click: () => a.addToDictionary(word) }, SEP);
  }

  if (p.linkURL) {
    const url = p.linkURL;
    items.push(
      { label: t('context.openLink'), click: () => a.openLink(url) },
      { label: t('context.copyLink'), click: () => a.copyLink(url) },
      SEP
    );
  }

  if (p.mediaType === 'image')
    items.push({ label: t('context.copyImage'), click: () => a.copyImage() }, SEP);

  if (p.isEditable) {
    items.push(
      { label: t('context.undo'), role: 'undo', enabled: f.canUndo },
      { label: t('context.redo'), role: 'redo', enabled: f.canRedo },
      SEP,
      { label: t('context.cut'), role: 'cut', enabled: f.canCut },
      { label: t('context.copy'), role: 'copy', enabled: f.canCopy },
      { label: t('context.paste'), role: 'paste', enabled: f.canPaste },
      { label: t('context.pasteMatchStyle'), role: 'pasteAndMatchStyle', enabled: f.canPaste },
      { label: t('context.selectAll'), role: 'selectAll', enabled: f.canSelectAll }
    );
  } else if (p.selectionText) {
    items.push(
      { label: t('context.copy'), role: 'copy', enabled: f.canCopy },
      { label: t('context.selectAll'), role: 'selectAll', enabled: f.canSelectAll }
    );
  }

  if (items.at(-1) !== SEP && items.length > 0) items.push(SEP);
  items.push({ label: t('context.inspect'), click: () => a.inspect() });
  return items;
}
