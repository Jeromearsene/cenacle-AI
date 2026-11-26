/// <reference lib="dom" />
import { ipcRenderer, webFrame } from 'electron';

// Preload for service pages (Claude, ChatGPT, Gemini…). It exposes NOTHING to the page: it
// dresses up web notifications with the account's name and color dot, so you can tell which
// account they come from, and it reports the text of the service's usage-limit banner to the
// app (nothing else is read, nothing leaves the machine). This file is self-contained (no local imports): a sandboxed preload
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

// Usage-limit banner (Claude shows one near and at the limit). The page is only observed, never
// modified; the main process parses the text and decides what to show.
//
// The banner has no marker we can count on (its markup is the service's to change), so it is
// recognized by what it says: a short piece of text that names a limit and gives a time of day
// ("Vous n'avez plus de messages gratuits jusqu'à 06:00."). The text of a conversation is never
// sent: only that short block, and only when it looks like this.
const BANNER_SELECTOR = '[data-testid="message-warning"]';
const CLOCK_RE = /\b\d{1,2}\s?[:h]\s?\d{2}\b|\b\d{1,2}\s*[ap]\.?m\b/i;
const LIMIT_RE = /free messages?|messages? gratuits?|usage limit|message limit|limite|limit/i;
const MAX_BANNER_CHARS = 240;

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** The text of the usage banner shown right now, or null. */
function findBanner(): string | null {
  const marked = document.querySelector(BANNER_SELECTOR)?.textContent;
  if (marked) return squash(marked).slice(0, 400);
  if (!document.body) return null;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const own = node.nodeValue ?? '';
    if (own.length > MAX_BANNER_CHARS || !CLOCK_RE.test(own)) continue;
    // The sentence is often cut in several pieces (a link inside it): go up while the block
    // stays short.
    let block = node.parentElement;
    for (let i = 0; i < 3 && block?.parentElement; i++) {
      if ((block.parentElement.textContent ?? '').length > MAX_BANNER_CHARS) break;
      block = block.parentElement;
    }
    const text = squash(block?.textContent ?? own);
    if (text.length <= MAX_BANNER_CHARS && LIMIT_RE.test(text)) return text;
  }
  return null;
}

let lastBanner: string | null = null;
let bannerTimer: ReturnType<typeof setTimeout> | undefined;

function reportBanner(): void {
  bannerTimer = undefined;
  const text = findBanner();
  if (text === lastBanner) return;
  lastBanner = text;
  // A vanished banner says nothing: the limit stays until its reset time.
  if (text) ipcRenderer.send('account:quota-banner', text);
}

function scheduleBannerReport(): void {
  if (bannerTimer === undefined) bannerTimer = setTimeout(reportBanner, 400);
}

document.addEventListener('DOMContentLoaded', () => {
  new MutationObserver(scheduleBannerReport).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  reportBanner();
});
