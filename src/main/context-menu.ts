import type { WebContents } from 'electron';
import { clipboard, Menu, shell } from 'electron';
import type { Translate } from '../shared/i18n';
import { contextMenuTemplate } from './context-menu-template';

const SAFE_LINK = /^(https?|mailto):/i;

/**
 * Electron shows no right-click menu by default: without this, you can neither paste with
 * the mouse nor copy a link. To be attached to every service page (and its popups).
 *
 * The macOS "AutoFill" submenu (passwords, contacts, cards) is not reachable from Electron:
 * it belongs to Safari and native text fields.
 */
export function attachContextMenu(wc: WebContents, t: Translate): void {
  wc.on('context-menu', (_event, params) => {
    const template = contextMenuTemplate(
      params,
      {
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
      },
      t
    );
    Menu.buildFromTemplate(template).popup();
  });
}
