import path from 'node:path';
import type {
  HandlerDetails,
  IpcMainEvent,
  MenuItemConstructorOptions,
  Rectangle,
  WebContents,
  WindowOpenHandlerResponse,
} from 'electron';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  Notification,
  nativeImage,
  nativeTheme,
  type Session,
  screen,
  session,
  shell,
  systemPreferences,
  WebContentsView,
} from 'electron';
import { name as packageName } from '../../package.json';
import {
  type Area,
  appendFitting,
  computeGrid,
  type Divider,
  type DropZone,
  equalizeAll,
  equalizeSplit,
  isDropZone,
  layoutAllowed,
  leaves,
  placeLeaf,
  removeLeaf,
  resizeSplit,
  syncGrid,
} from '../shared/grid';
import { isLocale, type Locale, resolveLocale, type Translate, translator } from '../shared/i18n';
import { isId } from '../shared/id';
import { computeUsage, type ResourceUsage } from '../shared/metrics';
import { activeFilter } from '../shared/provider-view';
import type { QuotaInfo } from '../shared/quota';
import { MAX_ACCOUNT_SHORTCUTS } from '../shared/shortcuts';
import {
  type Account,
  isTheme,
  type Layout,
  type PersistedState,
  type PublicState,
  type Rect,
} from '../shared/types';
import { dotDataUrl, identityArgument } from './account-notifications';
import { attachContextMenu } from './context-menu';
import { OAUTH_PATH, restorableUrl } from './last-url';
import {
  formatReport,
  parseWebOutcome,
  testNative,
  type WebOutcome,
  webProbeScript,
} from './notification-test';
import { isPermissionAllowed } from './permissions';
import {
  DEFAULT_PROVIDER,
  isAuthHost,
  isProviderId,
  PROVIDERS,
  type Provider,
  providerOf,
} from './providers';
import { createQuotaTracker } from './quota';
import { createShortcutHint, type KeyInput, shortcutModifierFor } from './shortcut-hint';
import { MAX_NAME, makeAccount, readState, writeStateFile } from './state';
import { createUnread } from './unread';
import { checkForUpdates } from './updater';

// ------------------------------------------------------------------ constants

// App icons (resources/ folder at the project root).
const RESOURCES = path.join(__dirname, '../../resources');
const resource = (file: string) => path.join(RESOURCES, file);

const SIDEBAR_W = 220; // sidebar width (px)
const HEADER_H = 32; // height of each cell header (px)
const isMac = process.platform === 'darwin';

// Windows groups and names notifications by this identifier. The installer already uses the same
// value (`appId` in electron-builder.yml); setting it here also names them when run from source.
if (process.platform === 'win32') app.setAppUserModelId('io.github.jeromearsene.cenacle');

// Interface language: the system language by default (English or French, English as the
// fallback), or the user's override (see applyLocale). Tests can force the system language with
// CENACLE_LANG; ignored in a packaged app.
const systemLocale = (): Locale =>
  resolveLocale((!app.isPackaged && process.env.CENACLE_LANG) || app.getLocale());
let locale: Locale = systemLocale();
// Reads `locale` at call time (not when `t` was handed out), so every menu, dialog and context
// menu follows a language change without having to be rebuilt by hand.
const t: Translate = (key, params) => translator(locale)(key, params);

// Window background shown before a page paints (also the "frame" around maximized/resized
// content); kept in sync with the chosen theme by the nativeTheme 'updated' listener below.
// Must match --palette-light-bg / --palette-dark-bg in styles.css by hand: a native window
// background has to be a literal hex string, so it can't reference that CSS variable directly.
const BG_LIGHT = '#f5f4ee';
const BG_DARK = '#1f1e1d';

// Browser identifier. Chromium mis-encodes accents in a User-Agent ("Cénacle" turns into
// "CÃ©nacle"), so the app name appears there without the accent.
const escapeRe = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compactName = app.getName().replace(/\s+/g, '');
const asciiName = compactName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
app.userAgentFallback = app.userAgentFallback.replace(
  new RegExp(`${escapeRe(compactName)}(?=/)`),
  asciiName
);

// "Clean" version (without the "Electron/x" and "app-name/x" tokens): that of a standard
// Chrome. Each service picks 'clean' or 'native' in providers.ts.
const UA_TOKENS = ['Electron', app.getName(), compactName, asciiName, packageName];
const CLEAN_USER_AGENT = app.userAgentFallback.replace(
  new RegExp(`\\s+(?:${[...new Set(UA_TOKENS)].map(escapeRe).join('|')})\\/\\S+`, 'gi'),
  ''
);

// Remote debugging (Playwright / Puppeteer). Off by default, limited to localhost.
const debugPort = Number(process.env.CENACLE_DEBUG_PORT);
if (Number.isInteger(debugPort) && debugPort > 0 && debugPort < 65536) {
  app.commandLine.appendSwitch('remote-debugging-port', String(debugPort));
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
}

// Tests: MULTI_TEST_URL replaces the address of every service (local server). Ignored in a
// packaged app.
const urlOf = (acc: Account): string =>
  (!app.isPackaged && process.env.MULTI_TEST_URL) || providerOf(acc.provider).url;

// ------------------------------------------------------------------ state

let state: PersistedState;
let win: BrowserWindow | null = null;
const views = new Map<string, WebContentsView>();
let rects: Rect[] = [];
let dividers: Divider[] = [];
// True while the interface drags an account or a resize handle: the service pages are hidden so
// the interface receives every mouse event, and they are placed again when it ends.
let dragging = false;
// True while the Settings dialog is open: the service pages are WebContentsViews, native layers
// stacked above the window's own page, so a dialog drawn in that page (however "big" or
// "centered") can never paint over them on its own. Hiding them is the only way a dialog in the
// window's own page can appear to cover the whole window.
let settingsOpen = false;
let saveTimer: NodeJS.Timeout | null = null;
// Accounts that raised a notification nobody has looked at yet (see unread.ts).
const unread = createUnread(onUnreadChange);

// The "claude-" prefix is historical (the tool only handled Claude): it names the session
// folder of every account, whatever the service. Changing it would lose the sign-ins.
const partitionOf = (id: string) => `persist:claude-${id}`;
const findAccount = (id: string) => state.accounts.find((a) => a.id === id);
const stateFile = () => path.join(app.getPath('userData'), 'state.json');

// First launch: the window fills the usable area of the screen (below the menu bar and the
// Dock). Later launches: last known size, as long as it is still visible on a connected
// screen (an unplugged external display, for example).
function initialBounds(): Rectangle {
  const b = state.bounds;
  if (b) {
    const visible = screen.getAllDisplays().some((d) => {
      const w = d.workArea;
      const overlapW = Math.min(b.x + b.width, w.x + w.width) - Math.max(b.x, w.x);
      const overlapH = Math.min(b.y + b.height, w.y + w.height) - Math.max(b.y, w.y);
      return overlapW >= 200 && overlapH >= 120;
    });
    if (visible) return b;
  }
  return screen.getPrimaryDisplay().workArea;
}

function writeState(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    writeStateFile(stateFile(), state);
  } catch (err) {
    console.error('Could not save the state:', err);
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writeState, 300);
}

// ------------------------------------------------------------------ usage limits

// The service pages report the usage banner they show (see preload/service.ts); the tracker
// turns it into a state per account and wakes up when the limit is reset.
const quota = createQuotaTracker({
  onChange: () => notify(),
  onReset: (id, previous) => notifyQuotaBack(id, previous),
});

// A limit that was reached is back: tell the user, as the service's own notifications do (the
// account name, its color dot). Nothing for the simple "more than 90 %" warning.
function notifyQuotaBack(id: string, previous: QuotaInfo): void {
  const acc = findAccount(id);
  if (!acc || previous.level !== 'reached' || !Notification.isSupported()) return;
  const n = new Notification({
    title: `${acc.name} · ${t('quota.notifyTitle')}`,
    body: t('quota.notifyBody'),
    icon: nativeImage.createFromDataURL(dotDataUrl(acc.color)),
  });
  n.on('click', () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
    selectAccount(id);
  });
  n.show();
}

// ------------------------------------------------------------------ settings (language, theme)

// Recomputes the effective interface language from the current override (or the system
// language). Must run once after `state` is loaded, and again whenever the override changes.
//
// Unlike applyTheme() below, this cannot also react to the OS setting changing while the app is
// running: Electron has no equivalent of nativeTheme's 'updated' event for the system language,
// so "System" only re-reads app.getLocale() the next time the app starts.
function applyLocale(): void {
  locale = state.localeOverride ?? systemLocale();
}

// `nativeTheme.themeSource` is what actually drives the look: Electron matches
// `prefers-color-scheme` in every renderer (this interface and every service page) to it, so our
// CSS (styles.css) and each service's own dark mode follow without further wiring.
function applyTheme(): void {
  nativeTheme.themeSource = state.theme;
}

// Keeps the window's own background in step: on an explicit theme change (above) and whenever
// 'system' tracks the OS and the OS theme itself changes.
nativeTheme.on('updated', () => {
  if (win && !win.isDestroyed())
    win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? BG_DARK : BG_LIGHT);
});

// 'system' resets the override (see applyLocale); it isn't itself a Locale, hence the extra check
// isLocale doesn't cover, unlike isTheme below where 'system' is already one of Theme's members.
function setLocaleOverride(pref: unknown): void {
  if (pref !== 'system' && !isLocale(pref)) return;
  state.localeOverride = pref === 'system' ? null : pref;
  applyLocale();
  refresh({ relayout: false });
}

function setTheme(pref: unknown): void {
  if (!isTheme(pref)) return;
  state.theme = pref;
  applyTheme();
  refresh({ relayout: false });
}

// ------------------------------------------------------------------ links and popups

// Sign-in popups (OAuth, GitHub connectors, etc.) must stay in the same session as their
// originating page so the sign-in ends up on the right account. Everything else (links in
// conversations, for example) opens in the default browser.

const makeWindowOpenHandler =
  (provider: Provider) =>
  (details: HandlerDetails): WindowOpenHandlerResponse => {
    let url: URL;
    try {
      url = new URL(details.url);
    } catch {
      return { action: 'deny' };
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      if (url.protocol === 'mailto:') void shell.openExternal(details.url);
      return { action: 'deny' };
    }
    if (
      details.disposition === 'new-window' ||
      isAuthHost(url.hostname, provider) ||
      OAUTH_PATH.test(url.pathname)
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
        },
      };
    }
    void shell.openExternal(url.toString());
    return { action: 'deny' };
  };

// ------------------------------------------------------------------ views (one per account)

const restrictedSessions = new WeakSet<Session>();

/** Limits what service pages may ask for (see permissions.ts). Done once per session. */
function restrictPermissions(ses: Session): void {
  if (restrictedSessions.has(ses)) return;
  restrictedSessions.add(ses);
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    callback(
      isPermissionAllowed({
        permission,
        mediaTypes: 'mediaTypes' in details ? details.mediaTypes : undefined,
        isMainFrame: details.isMainFrame,
      })
    );
  });
  // Synchronous checks (`Notification.permission`, `navigator.permissions.query`).
  ses.setPermissionCheckHandler((_wc, permission, _origin, details) =>
    isPermissionAllowed({
      permission,
      // A device-enumeration check ('unknown') grants no capture: only refuse the camera.
      mediaTypes: 'mediaType' in details && details.mediaType !== 'video' ? ['audio'] : undefined,
      isMainFrame: details.isMainFrame ?? true,
    })
  );
}

// Holding ⌘ / Ctrl shows each account's number in the interface. The focus is usually inside a
// service page, not in the interface, so every view is listened to.
const shortcutHint = createShortcutHint({
  modifier: shortcutModifierFor(process.platform),
  onChange: (visible) => {
    if (win && !win.isDestroyed()) win.webContents.send('shortcut-hint', visible);
  },
});

function trackShortcutHint(wc: WebContents): void {
  wc.on('before-input-event', (_event, input: KeyInput) => shortcutHint.handleInput(input));
  wc.on('blur', () => shortcutHint.reset());
}

function createView(acc: Account, parent: BrowserWindow): WebContentsView {
  const provider = providerOf(acc.provider);
  const partition = partitionOf(acc.id);
  // 'native': leave Electron's identifier as is (see providers.ts).
  restrictPermissions(session.fromPartition(partition));
  if (provider.ua === 'clean') session.fromPartition(partition).setUserAgent(CLEAN_USER_AGENT);

  const view = new WebContentsView({
    webPreferences: {
      partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Exposes nothing to the page: only dresses up its notifications (account name + color dot).
      preload: path.join(__dirname, '../preload/service.js'),
      additionalArguments: [identityArgument({ name: acc.name, icon: dotDataUrl(acc.color) })],
    },
  });
  const wc = view.webContents;
  const onWindowOpen = makeWindowOpenHandler(provider);
  wc.setWindowOpenHandler(onWindowOpen);
  attachContextMenu(wc, t);
  trackShortcutHint(wc);
  wc.on('did-create-window', (child) => {
    child.webContents.setWindowOpenHandler(onWindowOpen);
    attachContextMenu(child.webContents, t);
  });
  wc.on('focus', () => {
    // A hidden view (another account, "single" mode) does not choose the active account: when the
    // app closes, Chromium may give it the focus back and skew the account kept at next launch.
    if (!view.getVisible()) return;
    unread.clear(acc.id);
    if (state.activeId !== acc.id && findAccount(acc.id)) {
      state.activeId = acc.id;
      refresh({ relayout: false });
    }
  });
  // Remember the conversation each account is on (pages of an app change address without
  // reloading: `did-navigate-in-page`).
  const remember = (url: string) => {
    const current = findAccount(acc.id);
    const next = restorableUrl(url, urlOf(acc));
    if (!current || next === null || current.lastUrl === next) return;
    current.lastUrl = next;
    scheduleSave();
  };
  wc.on('did-navigate', (_event, url) => remember(url));
  wc.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) remember(url);
  });
  wc.loadURL(restorableUrl(acc.lastUrl, urlOf(acc)) ?? urlOf(acc)).catch(() => {
    /* offline: Chromium's error page is shown, "reload" tries again */
  });
  parent.contentView.addChildView(view);
  views.set(acc.id, view);
  return view;
}

function destroyView(id: string): void {
  const view = views.get(id);
  if (!view) return;
  views.delete(id);
  if (win && !win.isDestroyed()) win.contentView.removeChildView(view);
  if (!view.webContents.isDestroyed()) view.webContents.close();
}

function activeContents(): WebContents | null {
  const view = views.get(state.activeId);
  return view && !view.webContents.isDestroyed() ? view.webContents : null;
}

// ------------------------------------------------------------------ layout

/** Where the cells are drawn: the window minus the sidebar. */
function contentArea(w: BrowserWindow): Area {
  const [width = 0, height = 0] = w.getContentSize();
  return { x: SIDEBAR_W, y: 0, width: Math.max(0, width - SIDEBAR_W), height };
}

/** Brings the grid in line with the accounts (and, in grid mode, makes the active account one of
 * its cells). Called before every layout so that computing the layout changes nothing. */
function syncGridState(): void {
  if (!win || win.isDestroyed()) return;
  const synced = syncGrid(
    state.grid,
    state.accounts.map((a) => a.id),
    state.activeId,
    contentArea(win)
  );
  state.grid = synced.grid;
  if (state.layout === 'grid') state.activeId = synced.activeId;
}

function computeRects(w: BrowserWindow): { rects: Rect[]; dividers: Divider[] } {
  const area = contentArea(w);
  const toRect = (c: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }): Rect => ({
    ...c,
    headerH: HEADER_H,
  });
  if (state.layout === 'grid') {
    const geometry = computeGrid(state.grid, area);
    return { rects: geometry.cells.map(toRect), dividers: geometry.dividers };
  }
  return { rects: [toRect({ id: state.activeId, ...area })], dividers: [] };
}

/** Puts each service page where its cell is, and hides the ones that have no cell. */
function placeViews(list: Rect[]): void {
  if (!win || win.isDestroyed()) return;
  // Keep every service page hidden while the Settings dialog covers the window (see
  // `settingsOpen`), whatever triggered this call (a resize, a layout change…).
  if (settingsOpen) {
    for (const view of views.values()) view.setVisible(false);
    return;
  }
  const shown = new Set(list.map((r) => r.id));
  for (const r of list) {
    const acc = findAccount(r.id);
    if (!acc) continue;
    const view = views.get(r.id) ?? createView(acc, win);
    view.setBounds({
      x: r.x,
      y: r.y + r.headerH,
      width: r.width,
      height: Math.max(0, r.height - r.headerH),
    });
    view.setVisible(true);
  }
  // Hidden views stay loaded: their conversations keep running in the background.
  for (const [id, view] of views) if (!shown.has(id)) view.setVisible(false);
}

// ------------------------------------------------------------------ transitions

const ANIMATION_MS = 160;
let tween: NodeJS.Timeout | null = null;

/** Off when the system asks for reduced motion. `CENACLE_ANIMATIONS` (0 or 1) overrides the
 * system, which the tests need: the CI machines have their animations switched off. */
function animationsEnabled(): boolean {
  if (process.env.CENACLE_ANIMATIONS === '0') return false;
  if (process.env.CENACLE_ANIMATIONS === '1') return true;
  try {
    return !systemPreferences.getAnimationSettings().prefersReducedMotion;
  } catch {
    return true;
  }
}

function stopTween(): void {
  if (tween) clearInterval(tween);
  tween = null;
}

const lerp = (from: number, to: number, t: number): number => Math.round(from + (to - from) * t);

/** Moves the cells from where they are to where they should be, in a few frames. */
function startTween(from: Rect[], target: { rects: Rect[]; dividers: Divider[] }): void {
  const began = Date.now();
  tween = setInterval(() => {
    const progress = Math.min(1, (Date.now() - began) / ANIMATION_MS);
    const eased = 1 - (1 - progress) ** 3;
    if (progress >= 1) {
      stopTween();
      ({ rects, dividers } = target);
    } else {
      rects = target.rects.map((r) => {
        const start = from.find((f) => f.id === r.id);
        if (!start) return r;
        return {
          ...r,
          x: lerp(start.x, r.x, eased),
          y: lerp(start.y, r.y, eased),
          width: lerp(start.width, r.width, eased),
          height: lerp(start.height, r.height, eased),
        };
      });
      // The resize handles come back when the cells have stopped moving.
      dividers = [];
    }
    placeViews(rects);
    notify();
  }, 16);
}

/** `animate`: glide from the current layout to the new one (user actions, not window resizes). */
function applyLayout({ animate = false } = {}): void {
  if (!win || win.isDestroyed()) return;
  const from = rects;
  const target = computeRects(win);
  stopTween();
  if (animate && !dragging && from.length > 0 && animationsEnabled()) {
    startTween(from, target);
    return;
  }
  ({ rects, dividers } = target);
  // While dragging, the pages stay hidden and are not moved: they are placed once at the end.
  if (!dragging) placeViews(rects);
}

function publicState(): PublicState {
  return {
    appName: app.getName(),
    locale,
    localeOverride: state.localeOverride,
    theme: state.theme,
    providers: Object.values(PROVIDERS).map(({ id, label }) => ({ id, label })),
    accounts: state.accounts,
    activeId: state.activeId,
    unread: unread.ids(),
    layout: state.layout,
    accountView: state.accountView,
    rects,
    dividers,
    grid: state.layout === 'grid' ? state.grid : null,
    area:
      win && !win.isDestroyed() ? contentArea(win) : { x: SIDEBAR_W, y: 0, width: 0, height: 0 },
    sidebarW: SIDEBAR_W,
    fullscreen: win && !win.isDestroyed() ? win.isFullScreen() : false,
    quotas: quota.snapshot(),
  };
}

function notify(): void {
  if (win && !win.isDestroyed()) win.webContents.send('state', publicState());
}

function refresh({ relayout = true, animate = false } = {}): void {
  syncGridState();
  // The saved filter must not outlive the accounts it was set for (one was removed).
  state.accountView.filter = activeFilter(state.accounts, state.accountView.filter);
  if (relayout) applyLayout({ animate });
  buildMenu();
  notify();
  scheduleSave();
}

// ------------------------------------------------------------------ actions

function addAccount(providerId: string): string {
  const acc = makeAccount(state.accounts, providerId);
  state.accounts.push(acc);
  state.activeId = acc.id;
  // A new account joins the grid where there is room (a grid not shown yet will include it).
  if (state.grid && win && !win.isDestroyed()) {
    state.grid = appendFitting(state.grid, acc.id, contentArea(win)) ?? state.grid;
  }
  refresh();
  if (win && !win.isDestroyed()) win.webContents.send('rename-request', acc.id);
  return acc.id;
}

/** The accounts one can switch to: in grid mode, only the ones that are in the grid. */
function selectableIds(): string[] {
  return state.layout === 'grid' ? leaves(state.grid) : state.accounts.map((a) => a.id);
}

function selectAccount(id: string): boolean {
  if (!findAccount(id) || !selectableIds().includes(id)) return false;
  state.activeId = id;
  unread.clear(id);
  refresh();
  activeContents()?.focus();
  return true;
}

function cycleAccount(step: number): void {
  const ids = selectableIds();
  const n = ids.length;
  const next = ids[(ids.indexOf(state.activeId) + step + n) % n];
  if (next) selectAccount(next);
}

function setLayout(mode: Layout): void {
  if (mode !== 'single' && mode !== 'grid') return;
  state.layout = mode;
  refresh();
}

/** Only the sidebar list changes: the pages, the grid and the shortcuts stay as they are. */
function setAccountView(filter: unknown, sort: unknown): void {
  if (filter !== null && !isProviderId(filter)) return;
  if (sort !== 'manual' && sort !== 'provider') return;
  state.accountView = { filter, sort };
  refresh({ relayout: false });
}

/** Drops an account on a cell of the grid, unless a cell would get too small. */
function placeAccount(id: string, targetId: string, zone: DropZone): boolean {
  if (state.layout !== 'grid' || !win || !findAccount(id) || !findAccount(targetId)) return false;
  const next = placeLeaf(state.grid, id, targetId, zone);
  if (!next || next === state.grid || !layoutAllowed(state.grid, next, contentArea(win))) {
    return false;
  }
  state.grid = next;
  state.activeId = id;
  // The drop ends the drag (the interface says so right after): the pages come back by gliding
  // from where they were, which they could not do while the drag was still on.
  dragging = false;
  refresh({ animate: true });
  // The dropped account is the active one: what is typed next goes to it.
  activeContents()?.focus();
  return true;
}

/** Takes an account out of the grid: it stays in the sidebar, session kept. The last one stays. */
function removeFromGrid(id: string): boolean {
  if (state.layout !== 'grid') return false;
  const inGrid = leaves(state.grid);
  if (inGrid.length <= 1 || !inGrid.includes(id)) return false;
  state.grid = removeLeaf(state.grid, id);
  if (state.activeId === id) state.activeId = leaves(state.grid)[0] ?? state.activeId;
  refresh({ animate: true });
  return true;
}

/** Back to every account side by side where they fit, equal sizes (also brings back the ones
 * taken out). */
function resetGrid(): void {
  if (state.layout !== 'grid') return;
  state.grid = null;
  refresh({ animate: true });
}

/** Equal sizes for the whole grid, or for the one split found at `path`. */
function equalizeGrid(path?: number[]): void {
  if (state.layout !== 'grid') return;
  state.grid = path ? equalizeSplit(state.grid, path) : equalizeAll(state.grid);
  refresh({ animate: true });
}

function resizeGrid(path: number[], index: number, size: number): void {
  if (state.layout !== 'grid' || !win || win.isDestroyed()) return;
  state.grid = resizeSplit(state.grid, contentArea(win), path, index, size);
  // Called for every mouse move: only the layout (no menu rebuild).
  applyLayout();
  notify();
  scheduleSave();
}

/** A reloaded or crashed interface cannot finish its drag: show the pages again. */
function stopDragging(): void {
  if (dragging) setDragging(false);
}

function setDragging(active: boolean): void {
  if (dragging === active) return;
  dragging = active;
  if (active) {
    stopTween();
    for (const view of views.values()) view.setVisible(false);
  } else {
    applyLayout();
  }
}

/** The Settings dialog just opened or closed (see `settingsOpen`). */
function setSettingsOpen(open: boolean): void {
  if (settingsOpen === open) return;
  settingsOpen = open;
  if (open) {
    stopTween();
    for (const view of views.values()) view.setVisible(false);
  } else {
    applyLayout();
  }
}

function renameAccount(id: string, name: unknown): boolean {
  const acc = findAccount(id);
  const clean = typeof name === 'string' ? name.trim().slice(0, MAX_NAME) : '';
  if (!acc || !clean) return false;
  acc.name = clean;
  // This account's notifications carry its name: tell the service page.
  const view = views.get(id);
  if (view && !view.webContents.isDestroyed()) view.webContents.send('account:renamed', clean);
  refresh({ relayout: false });
  return true;
}

async function removeAccount(id: string): Promise<boolean> {
  const acc = findAccount(id);
  if (!acc || state.accounts.length <= 1) return false;
  const options = {
    type: 'warning' as const,
    buttons: [t('dialog.delete'), t('dialog.cancel')],
    defaultId: 1,
    cancelId: 1,
    message: t('dialog.deleteTitle', { name: acc.name }),
    detail: t('dialog.deleteDetail'),
  };
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options);
  if (response !== 0) return false;

  destroyView(id);
  quota.forget(id);
  unread.forget(id);
  const ses = session.fromPartition(partitionOf(id));
  await ses.clearStorageData().catch(() => {});
  await ses.clearCache().catch(() => {});
  state.accounts = state.accounts.filter((a) => a.id !== id);
  if (state.grid) state.grid = removeLeaf(state.grid, id);
  const first = state.accounts[0];
  if (state.activeId === id && first) state.activeId = first.id;
  refresh();
  return true;
}

function reloadAccount(id: string): void {
  const view = views.get(id);
  if (view && !view.webContents.isDestroyed()) view.webContents.reload();
}

// View → Development → Test notifications (see notification-test.ts): raises a system
// notification and a web notification from the active account's page, then tells what happened to
// each.
async function testNotifications(): Promise<void> {
  const title = t('notifTest.title');
  const nativeBody = t('notifTest.nativeLabel');
  const webBody = t('notifTest.webLabel');
  const wc = activeContents();
  const [native, web] = await Promise.all([
    testNative(() => new Notification({ title, body: nativeBody }), Notification.isSupported()),
    wc
      ? wc
          .executeJavaScript(webProbeScript(title, webBody))
          .then((raw): WebOutcome => parseWebOutcome(raw))
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const options = {
    type: 'info' as const,
    message: title,
    detail: formatReport(native, web, t, isMac),
  };
  if (win && !win.isDestroyed()) await dialog.showMessageBox(win, options);
  else await dialog.showMessageBox(options);
}

function zoomActive(delta: number): void {
  const wc = activeContents();
  if (!wc) return;
  wc.setZoomLevel(delta === 0 ? 0 : wc.getZoomLevel() + delta);
}

/** Memory and CPU of each account's page, and of everything that belongs to none of them. */
function resourceUsage(): ResourceUsage {
  const samples = app.getAppMetrics().map((m) => ({
    pid: m.pid,
    cpu: m.cpu.percentCPUUsage,
    memoryKb: m.memory.workingSetSize,
  }));
  // Each account has its own session, hence its own page process. 0 means "not started yet".
  const pids = new Map(
    state.accounts.map((a) => {
      const wc = views.get(a.id)?.webContents;
      return [a.id, wc && !wc.isDestroyed() ? wc.getOSProcessId() || null : null] as const;
    })
  );
  return computeUsage(samples, pids);
}

// ⌘, / Ctrl, (see buildMenu) or the "Settings" menu item: tell the sidebar to open its own
// Settings dialog. Settings' open/closed state is deliberately local, transient UI state, not
// part of PersistedState/PublicState, so this is a one-shot push rather than a state field.
function requestOpenSettings(): void {
  if (win && !win.isDestroyed()) win.webContents.send('open-settings');
}

// ------------------------------------------------------------------ IPC (interface → processus principal)

/** The account and view whose page (main frame only) sent this message. */
function senderAccount(event: IpcMainEvent): { id: string; view: WebContentsView } | null {
  const entry = [...views].find(([, view]) => view.webContents === event.sender);
  if (!entry || event.senderFrame !== event.sender.mainFrame) return null;
  return { id: entry[0], view: entry[1] };
}

// The unread list changed: the interface shows it, and the app icon carries the number of
// accounts concerned (Dock badge on macOS, Unity launcher on Linux; Windows has no equivalent).
function onUnreadChange(ids: string[]): void {
  app.setBadgeCount(ids.length);
  notify();
}

// A service raised a notification. If the user is not looking at that page, mark the account and
// call them back: the Dock icon bounces (macOS) or the taskbar entry flashes (Windows, Linux).
ipcMain.on('account:notification-shown', (event) => {
  const sender = senderAccount(event);
  if (!sender || !win || win.isDestroyed()) return;
  const seen = win.isFocused() && sender.view.getVisible();
  if (!unread.notify(sender.id, seen) || win.isFocused()) return;
  if (isMac) app.dock?.bounce('informational');
  else win.flashFrame(true);
});

// Click on a service notification: show its account and bring the app to the foreground.
ipcMain.on('account:notification-click', (event) => {
  const sender = senderAccount(event);
  if (!sender) return;
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
  selectAccount(sender.id);
});

// The usage banner read in a service page. Only the main frame of a service that has such a
// banner is listened to, and the text is bounded: it is parsed, never displayed or stored.
ipcMain.on('account:quota-banner', (event, text: unknown) => {
  const entry = [...views].find(([, view]) => view.webContents === event.sender);
  if (!entry || event.senderFrame !== event.sender.mainFrame) return;
  const acc = findAccount(entry[0]);
  if (!acc || !providerOf(acc.provider).usageBanner) return;
  if (typeof text !== 'string' || text.length === 0 || text.length > 500) return;
  quota.report(acc.id, text);
});

function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (!win || event.sender !== win.webContents) throw new Error('IPC rejected');
    return fn(...args);
  });
}

handle('state:get', () => {
  applyLayout();
  return publicState();
});
handle('accounts:add', (providerId) =>
  addAccount(isProviderId(providerId) ? providerId : DEFAULT_PROVIDER)
);
handle('accounts:select', (id) => isId(id) && selectAccount(id));
handle('accounts:rename', (id, name) => isId(id) && renameAccount(id, name));
handle('accounts:remove', (id) => (isId(id) ? removeAccount(id) : false));
handle('layout:set', (mode) => setLayout(mode as Layout));
handle('view:set', (view) => {
  if (typeof view === 'object' && view !== null) {
    const { filter, sort } = view as Record<string, unknown>;
    setAccountView(filter, sort);
  }
});
handle(
  'grid:place',
  (id, targetId, zone) =>
    isId(id) && isId(targetId) && isDropZone(zone) && placeAccount(id, targetId, zone)
);
handle('grid:remove', (id) => isId(id) && removeFromGrid(id));
/** The path of a split in the grid tree, as sent by the interface. */
const isPath = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length <= 8 && v.every((n) => Number.isInteger(n) && n >= 0);
handle('grid:resize', (path, index, size) => {
  if (isPath(path) && Number.isInteger(index) && typeof size === 'number') {
    resizeGrid(path, index as number, size);
  }
});
handle('grid:equalize', (path) => {
  if (path === undefined || isPath(path)) equalizeGrid(path);
});
handle('grid:dragging', (active) => setDragging(active === true));
handle('settings:setLocale', (pref) => setLocaleOverride(pref));
handle('settings:setTheme', (pref) => setTheme(pref));
handle('settings:setOpen', (open) => setSettingsOpen(open === true));
handle('account:reload', (id) => isId(id) && reloadAccount(id));
handle('resource-usage:get', () => resourceUsage());

// ------------------------------------------------------------------ menu

function buildMenu(): void {
  const accountItems: MenuItemConstructorOptions[] = state.accounts
    .slice(0, MAX_ACCOUNT_SHORTCUTS)
    .map((acc, i) => ({
      label: acc.name.replace(/&/g, '&&'),
      type: 'radio',
      checked: acc.id === state.activeId,
      accelerator: `CmdOrCtrl+${i + 1}`,
      click: () => selectAccount(acc.id),
    }));

  // ⌘, / Ctrl, (see t('menu.settings') below): the closest thing to a platform convention for
  // opening an app's settings/preferences — Apple's Human Interface Guidelines mandate Cmd+, on
  // macOS; Windows has no equivalent of its own, but Ctrl+, is the de facto cross-platform
  // convention (VS Code, Slack, Discord, Spotify…), so it's used here too. CmdOrCtrl picks the
  // right one for the current platform automatically.
  const settingsItem: MenuItemConstructorOptions = {
    label: t('menu.settings'),
    accelerator: 'CmdOrCtrl+,',
    click: () => requestOpenSettings(),
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settingsItem,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ] as MenuItemConstructorOptions[],
          },
        ]
      : [
          {
            label: t('menu.file'),
            submenu: [
              settingsItem,
              { type: 'separator' },
              { role: 'quit' },
            ] as MenuItemConstructorOptions[],
          },
        ]),
    { role: 'editMenu' },
    {
      label: t('menu.accounts'),
      submenu: [
        {
          label: t('menu.newAccount'),
          submenu: Object.values(PROVIDERS).map((p) => ({
            label: p.label,
            click: () => addAccount(p.id),
          })),
        },
        { type: 'separator' },
        ...accountItems,
        { type: 'separator' },
        { label: t('menu.nextAccount'), accelerator: 'Ctrl+Tab', click: () => cycleAccount(1) },
        {
          label: t('menu.previousAccount'),
          accelerator: 'Ctrl+Shift+Tab',
          click: () => cycleAccount(-1),
        },
        { type: 'separator' },
        {
          label: t('menu.reloadActive'),
          accelerator: 'CmdOrCtrl+R',
          click: () => reloadAccount(state.activeId),
        },
      ],
    },
    {
      label: t('menu.view'),
      submenu: [
        {
          label: state.layout === 'grid' ? t('menu.showSingle') : t('menu.showGrid'),
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => setLayout(state.layout === 'grid' ? 'single' : 'grid'),
        },
        {
          label: t('menu.equalizeGrid'),
          enabled: state.layout === 'grid' && leaves(state.grid).length > 1,
          click: () => equalizeGrid(),
        },
        { label: t('menu.resetGrid'), enabled: state.layout === 'grid', click: resetGrid },
        { type: 'separator' },
        { label: t('menu.zoomIn'), accelerator: 'CmdOrCtrl+Plus', click: () => zoomActive(0.5) },
        { label: t('menu.zoomOut'), accelerator: 'CmdOrCtrl+-', click: () => zoomActive(-0.5) },
        { label: t('menu.actualSize'), accelerator: 'CmdOrCtrl+0', click: () => zoomActive(0) },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11' },
        ...(isMac
          ? []
          : [
              {
                label: t('menu.maximizeWindow'),
                click: () => win && (win.isMaximized() ? win.unmaximize() : win.maximize()),
              },
            ]),
        { type: 'separator' },
        {
          label: t('menu.development'),
          submenu: [
            {
              label: t('menu.devTools'),
              accelerator: 'CmdOrCtrl+Alt+I',
              click: () => activeContents()?.openDevTools({ mode: 'detach' }),
            },
            {
              id: 'resource-usage',
              label: t('menu.resourceUsage'),
              click: () => {
                if (win && !win.isDestroyed()) win.webContents.send('resource-usage:toggle');
              },
            },
            { type: 'separator' },
            {
              id: 'test-notifications',
              label: t('menu.testNotifications'),
              click: () => void testNotifications(),
            },
          ],
        },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ------------------------------------------------------------------ window

function createWindow(): void {
  const b = initialBounds();
  const w = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    minWidth: 900,
    minHeight: 560,
    resizable: true,
    maximizable: true,
    fullscreenable: true, // green button / ⌃⌘F on macOS
    title: app.getName(),
    // macOS takes the icon from the bundle (or the Dock, see below); Windows prefers .ico, Linux .png
    icon: isMac ? undefined : resource(process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? BG_DARK : BG_LIGHT,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win = w;
  w.webContents.on('did-start-loading', stopDragging);
  w.webContents.on('render-process-gone', stopDragging);

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devUrl) void w.loadURL(devUrl);
  else void w.loadFile(path.join(__dirname, '../renderer/index.html'));

  // The interface itself must never navigate or open a window.
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e) => e.preventDefault());
  w.on('page-title-updated', (e) => e.preventDefault());
  trackShortcutHint(w.webContents);
  w.on('blur', () => shortcutHint.reset());
  // Coming back to the app: the account on screen counts as seen.
  w.on('focus', () => {
    if (views.get(state.activeId)?.getVisible()) unread.clear(state.activeId);
  });

  const relayout = () => {
    applyLayout();
    notify();
  };
  w.on('resize', relayout);
  w.on('maximize', relayout);
  w.on('unmaximize', relayout);
  w.on('enter-full-screen', relayout);
  w.on('leave-full-screen', relayout);

  // Remember the "normal" size (not maximized / full screen) and the maximized state.
  w.on('close', () => {
    state.fullscreen = w.isFullScreen();
    state.maximized = w.isMaximized();
    state.bounds = w.getNormalBounds();
    writeState();
  });

  w.once('ready-to-show', () => {
    if (state.fullscreen) w.setFullScreen(true);
    else if (state.maximized) w.maximize();
    w.show();
  });
  w.on('closed', () => {
    stopTween();
    dragging = false;
    views.clear();
    win = null;
  });

  applyLayout();
}

// ------------------------------------------------------------------ cycle de vie

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  void app.whenReady().then(() => {
    state = readState(stateFile());
    applyLocale();
    applyTheme();
    // Outside a package (yarn dev / start), the Dock shows Electron's icon: set ours.
    if (isMac && !app.isPackaged)
      app.dock?.setIcon(nativeImage.createFromPath(resource('icon-mac.png')));
    buildMenu();
    createWindow();
    checkForUpdates();
  });

  app.on('before-quit', () => {
    if (state) writeState();
    quota.dispose();
  });
  app.on('window-all-closed', () => app.quit());
}
