/// <reference lib="dom" />
import { ipcRenderer, webFrame } from 'electron';

// Preload for service pages (Claude, ChatGPT, Gemini…). It exposes NOTHING to the page: it only
// dresses up web notifications with the account's name and color dot, so you can tell which
// account they come from. This file is self-contained (no local imports): a sandboxed preload
// cannot load other modules.

const ARG_PREFIX = '--cenacle-notifications=';
const CLICK_EVENT = 'cenacle:notification-click';

interface Identity {
  name: string;
  icon: string;
}

function readIdentity(): Identity {
  const arg = process.argv.find((a) => a.startsWith(ARG_PREFIX));
  if (!arg) return { name: '', icon: '' };
  try {
    const parsed = JSON.parse(atob(arg.slice(ARG_PREFIX.length)));
    return { name: String(parsed.name ?? ''), icon: String(parsed.icon ?? '') };
  } catch {
    return { name: '', icon: '' };
  }
}

// Runs in the page's main world, before its own scripts. Idempotent: a second call (account
// renamed) only updates the name.
const script = (identity: Identity, clickEvent: string) => `(() => {
  const KEY = Symbol.for('cenacle.notifications');
  const w = window;
  if (!Object.hasOwn(w, KEY)) Object.defineProperty(w, KEY, { value: {}, enumerable: false });
  const cfg = w[KEY];
  cfg.name = ${JSON.stringify(identity.name)};
  cfg.icon = ${JSON.stringify(identity.icon)};
  if (cfg.installed) return;
  cfg.installed = true;
  const decorate = (title, options) => [
    cfg.name ? cfg.name + ' · ' + title : String(title),
    cfg.icon ? { ...options, icon: cfg.icon } : options,
  ];
  const Native = w.Notification;
  if (Native) {
    class Notification extends Native {
      constructor(title, options) {
        super(...decorate(title, options));
        this.addEventListener('click', () => w.dispatchEvent(new CustomEvent(${JSON.stringify(clickEvent)})));
      }
    }
    w.Notification = Notification;
  }
  const proto = w.ServiceWorkerRegistration?.prototype;
  const show = proto?.showNotification;
  if (show) {
    proto.showNotification = function (title, options) {
      return show.call(this, ...decorate(title, options));
    };
  }
})();`;

const install = (identity: Identity) => {
  void webFrame.executeJavaScript(script(identity, CLICK_EVENT));
};

install(readIdentity());

// The account was renamed.
ipcRenderer.on('account:renamed', (_event, name: unknown) => {
  if (typeof name === 'string') install({ ...readIdentity(), name });
});

// A click on the notification (triggered by the page): ask the app to show the account.
window.addEventListener(CLICK_EVENT, () => ipcRenderer.send('account:notification-click'));
