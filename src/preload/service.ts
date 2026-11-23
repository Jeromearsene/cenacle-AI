/// <reference lib="dom" />
import { ipcRenderer, webFrame } from 'electron';

// Preload des pages de service (Claude, ChatGPT, Gemini…). Il n'expose RIEN à la page : il se
// contente d'habiller les notifications web avec le nom et la pastille du compte, pour savoir
// de quel compte elles viennent. Ce fichier est autonome (aucun import local) : un preload
// sandboxé ne peut pas charger d'autres modules.

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

// Exécuté dans le monde principal de la page, avant ses propres scripts. Idempotent : un second
// appel (compte renommé) ne fait que mettre le nom à jour.
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

// Le compte a été renommé.
ipcRenderer.on('account:renamed', (_event, name: unknown) => {
  if (typeof name === 'string') install({ ...readIdentity(), name });
});

// Un clic sur la notification (déclenché par la page) : on demande à l'app d'afficher le compte.
window.addEventListener(CLICK_EVENT, () => ipcRenderer.send('account:notification-click'));
