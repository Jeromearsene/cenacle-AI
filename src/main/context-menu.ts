import type { WebContents } from 'electron';
import { clipboard, Menu, shell } from 'electron';
import { contextMenuTemplate } from './context-menu-template';

const SAFE_LINK = /^(https?|mailto):/i;

/**
 * Electron n'affiche aucun menu clic droit par défaut : sans ceci, on ne peut ni coller avec
 * la souris, ni copier un lien. À brancher sur chaque page de service (et ses popups).
 *
 * Le sous-menu « Remplir » de macOS (mots de passe, contacts, cartes) n'est pas accessible
 * depuis Electron : il appartient à Safari et aux champs de texte natifs.
 */
export function attachContextMenu(wc: WebContents): void {
  wc.on('context-menu', (_event, params) => {
    const template = contextMenuTemplate(params, {
      openLink: (url) => {
        if (SAFE_LINK.test(url)) void shell.openExternal(url);
      },
      copyLink: (url) => clipboard.writeText(url),
      copyImage: () => wc.copyImageAt(params.x, params.y),
      replaceMisspelling: (word) => wc.replaceMisspelling(word),
      addToDictionary: (word) => wc.session.addWordToSpellCheckerDictionary(word),
      inspect: () => {
        wc.inspectElement(params.x, params.y);
        wc.devToolsWebContents?.focus();
      },
    });
    Menu.buildFromTemplate(template).popup();
  });
}
