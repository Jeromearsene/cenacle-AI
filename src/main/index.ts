import path from 'node:path';
import type {
  HandlerDetails,
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
  nativeImage,
  nativeTheme,
  screen,
  session,
  shell,
  WebContentsView,
} from 'electron';
import { name as packageName } from '../../package.json';
import type { Account, Layout, PersistedState, PublicState, Rect } from '../shared/types';
import { attachContextMenu } from './context-menu';
import {
  DEFAULT_PROVIDER,
  isAuthHost,
  isProviderId,
  PROVIDERS,
  type Provider,
  providerOf,
} from './providers';
import { isId, MAX_NAME, makeAccount, readState, writeStateFile } from './state';
import { checkForUpdates } from './updater';

// ------------------------------------------------------------------ constantes

// Icônes de l'app (dossier resources/ à la racine du projet).
const RESOURCES = path.join(__dirname, '../../resources');
const resource = (file: string) => path.join(RESOURCES, file);

const SIDEBAR_W = 220; // largeur de la barre latérale (px)
const HEADER_H = 32; // hauteur de l'en-tête de chaque colonne (px)
const isMac = process.platform === 'darwin';

// Identifiant de navigateur. Chromium encode mal les accents dans un User-Agent (« Cénacle »
// part en « CÃ©nacle »), donc le nom de l'app y figure sans accent.
const escapeRe = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compactName = app.getName().replace(/\s+/g, '');
const asciiName = compactName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
app.userAgentFallback = app.userAgentFallback.replace(
  new RegExp(`${escapeRe(compactName)}(?=/)`),
  asciiName
);

// Version « nettoyée » (sans les jetons « Electron/x » et « nom-de-l-app/x ») : celle d'un
// Chrome standard. Chaque service choisit 'clean' ou 'native' dans providers.ts.
const UA_TOKENS = ['Electron', app.getName(), compactName, asciiName, packageName];
const CLEAN_USER_AGENT = app.userAgentFallback.replace(
  new RegExp(`\\s+(?:${[...new Set(UA_TOKENS)].map(escapeRe).join('|')})\\/\\S+`, 'gi'),
  ''
);

// Débogage à distance (Playwright / Puppeteer). Désactivé par défaut, limité à localhost.
const debugPort = Number(process.env.CENACLE_DEBUG_PORT);
if (Number.isInteger(debugPort) && debugPort > 0 && debugPort < 65536) {
  app.commandLine.appendSwitch('remote-debugging-port', String(debugPort));
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
}

// Tests : MULTI_TEST_URL remplace l'adresse de tous les services (serveur local). Ignoré
// dans une app empaquetée.
const urlOf = (acc: Account): string =>
  (!app.isPackaged && process.env.MULTI_TEST_URL) || providerOf(acc.provider).url;

// ------------------------------------------------------------------ état

let state: PersistedState;
let win: BrowserWindow | null = null;
const views = new Map<string, WebContentsView>();
let rects: Rect[] = [];
let saveTimer: NodeJS.Timeout | null = null;

// Le préfixe « claude- » est historique (l'outil ne gérait que Claude) : il désigne le dossier de
// session de chaque compte, tous services confondus. Le changer ferait perdre les connexions.
const partitionOf = (id: string) => `persist:claude-${id}`;
const findAccount = (id: string) => state.accounts.find((a) => a.id === id);
const stateFile = () => path.join(app.getPath('userData'), 'state.json');

// Premier lancement : la fenêtre prend toute la zone utile de l'écran (sous la barre de
// menus et le Dock). Lancements suivants : dernière taille connue, à condition qu'elle
// soit encore visible sur un écran branché (écran externe débranché, par exemple).
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
    console.error('Impossible d’enregistrer l’état :', err);
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writeState, 300);
}

// ------------------------------------------------------------------ liens et popups

// Les popups de connexion (OAuth, connecteurs GitHub, etc.) doivent rester dans la même
// session que leur page d'origine pour que la connexion aboutisse sur le bon compte.
// Tout le reste (liens dans les conversations, par exemple) s'ouvre dans le navigateur
// par défaut.
const OAUTH_PATH = /\/(oauth|oauth2|authorize|login|signin|sign-in|auth)(\/|$)/i;

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

// ------------------------------------------------------------------ vues (une par compte)

function createView(acc: Account, parent: BrowserWindow): WebContentsView {
  const provider = providerOf(acc.provider);
  const partition = partitionOf(acc.id);
  // 'native' : on laisse l'identifiant d'Electron tel quel (voir providers.ts).
  if (provider.ua === 'clean') session.fromPartition(partition).setUserAgent(CLEAN_USER_AGENT);

  const view = new WebContentsView({
    webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const wc = view.webContents;
  const onWindowOpen = makeWindowOpenHandler(provider);
  wc.setWindowOpenHandler(onWindowOpen);
  attachContextMenu(wc);
  wc.on('did-create-window', (child) => {
    child.webContents.setWindowOpenHandler(onWindowOpen);
    attachContextMenu(child.webContents);
  });
  wc.on('focus', () => {
    // Une vue masquée (autre compte, mode « un seul ») ne choisit pas le compte actif : au moment
    // de fermer l'app, Chromium peut lui rendre le focus et fausser le compte retenu au redémarrage.
    if (!view.getVisible()) return;
    if (state.activeId !== acc.id && findAccount(acc.id)) {
      state.activeId = acc.id;
      refresh({ relayout: false });
    }
  });
  wc.loadURL(urlOf(acc)).catch(() => {
    /* hors ligne : la page d'erreur de Chromium s'affiche, « recharger » réessaie */
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

// ------------------------------------------------------------------ mise en page

function computeRects(w: BrowserWindow): Rect[] {
  const [width = 0, height = 0] = w.getContentSize();
  const areaX = SIDEBAR_W;
  const areaW = Math.max(0, width - SIDEBAR_W);
  const shown =
    state.layout === 'columns'
      ? state.accounts
      : state.accounts.filter((a) => a.id === state.activeId);
  const n = Math.max(1, shown.length);
  const colW = Math.floor(areaW / n);
  return shown.map((acc, i) => {
    const left = areaX + i * colW;
    const right = i === n - 1 ? areaX + areaW : left + colW;
    const gap = i > 0 ? 1 : 0; // 1 px de séparation entre colonnes
    return {
      id: acc.id,
      x: left + gap,
      y: 0,
      width: right - left - gap,
      headerH: HEADER_H,
      viewY: HEADER_H,
      viewHeight: Math.max(0, height - HEADER_H),
    };
  });
}

function applyLayout(): void {
  if (!win || win.isDestroyed()) return;
  rects = computeRects(win);
  const shown = new Set(rects.map((r) => r.id));
  for (const r of rects) {
    const acc = findAccount(r.id);
    if (!acc) continue;
    const view = views.get(r.id) ?? createView(acc, win);
    view.setBounds({ x: r.x, y: r.viewY, width: r.width, height: r.viewHeight });
    view.setVisible(true);
  }
  // Les vues masquées restent chargées : leurs conversations continuent en arrière-plan.
  for (const [id, view] of views) if (!shown.has(id)) view.setVisible(false);
}

function publicState(): PublicState {
  return {
    appName: app.getName(),
    providers: Object.values(PROVIDERS).map(({ id, label }) => ({ id, label })),
    accounts: state.accounts,
    activeId: state.activeId,
    layout: state.layout,
    rects,
    sidebarW: SIDEBAR_W,
  };
}

function notify(): void {
  if (win && !win.isDestroyed()) win.webContents.send('state', publicState());
}

function refresh({ relayout = true } = {}): void {
  if (relayout) applyLayout();
  buildMenu();
  notify();
  scheduleSave();
}

// ------------------------------------------------------------------ actions

function addAccount(providerId: string): string {
  const acc = makeAccount(state.accounts, providerId);
  state.accounts.push(acc);
  state.activeId = acc.id;
  refresh();
  if (win && !win.isDestroyed()) win.webContents.send('rename-request', acc.id);
  return acc.id;
}

function selectAccount(id: string): boolean {
  if (!findAccount(id)) return false;
  state.activeId = id;
  refresh();
  activeContents()?.focus();
  return true;
}

function cycleAccount(step: number): void {
  const n = state.accounts.length;
  const i = state.accounts.findIndex((a) => a.id === state.activeId);
  const next = state.accounts[(i + step + n) % n];
  if (next) selectAccount(next.id);
}

function setLayout(mode: Layout): void {
  if (mode !== 'single' && mode !== 'columns') return;
  state.layout = mode;
  refresh();
}

function renameAccount(id: string, name: unknown): boolean {
  const acc = findAccount(id);
  const clean = typeof name === 'string' ? name.trim().slice(0, MAX_NAME) : '';
  if (!acc || !clean) return false;
  acc.name = clean;
  refresh({ relayout: false });
  return true;
}

async function removeAccount(id: string): Promise<boolean> {
  const acc = findAccount(id);
  if (!acc || state.accounts.length <= 1) return false;
  const options = {
    type: 'warning' as const,
    buttons: ['Supprimer', 'Annuler'],
    defaultId: 1,
    cancelId: 1,
    message: `Supprimer « ${acc.name} » ?`,
    detail:
      'La session de ce compte (connexion, cookies, données locales) sera effacée de cet outil. Le compte lui-même, chez le service, n’est pas touché.',
  };
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options);
  if (response !== 0) return false;

  destroyView(id);
  const ses = session.fromPartition(partitionOf(id));
  await ses.clearStorageData().catch(() => {});
  await ses.clearCache().catch(() => {});
  state.accounts = state.accounts.filter((a) => a.id !== id);
  const first = state.accounts[0];
  if (state.activeId === id && first) state.activeId = first.id;
  refresh();
  return true;
}

function reloadAccount(id: string): void {
  const view = views.get(id);
  if (view && !view.webContents.isDestroyed()) view.webContents.reload();
}

function zoomActive(delta: number): void {
  const wc = activeContents();
  if (!wc) return;
  wc.setZoomLevel(delta === 0 ? 0 : wc.getZoomLevel() + delta);
}

// ------------------------------------------------------------------ IPC (interface → processus principal)

function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (!win || event.sender !== win.webContents) throw new Error('IPC refusé');
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
handle('account:reload', (id) => isId(id) && reloadAccount(id));

// ------------------------------------------------------------------ menu

function buildMenu(): void {
  const accountItems: MenuItemConstructorOptions[] = state.accounts.slice(0, 9).map((acc, i) => ({
    label: acc.name.replace(/&/g, '&&'),
    type: 'radio',
    checked: acc.id === state.activeId,
    accelerator: `CmdOrCtrl+${i + 1}`,
    click: () => selectAccount(acc.id),
  }));

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' } as const]
      : [{ label: 'Fichier', submenu: [{ role: 'quit' } as const] }]),
    { role: 'editMenu' },
    {
      label: 'Comptes',
      submenu: [
        {
          label: 'Nouveau compte',
          submenu: Object.values(PROVIDERS).map((p) => ({
            label: p.label,
            click: () => addAccount(p.id),
          })),
        },
        { type: 'separator' },
        ...accountItems,
        { type: 'separator' },
        { label: 'Compte suivant', accelerator: 'Ctrl+Tab', click: () => cycleAccount(1) },
        { label: 'Compte précédent', accelerator: 'Ctrl+Shift+Tab', click: () => cycleAccount(-1) },
        { type: 'separator' },
        {
          label: 'Recharger le compte actif',
          accelerator: 'CmdOrCtrl+R',
          click: () => reloadAccount(state.activeId),
        },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        {
          label: state.layout === 'columns' ? 'Afficher un seul compte' : 'Afficher en colonnes',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => setLayout(state.layout === 'columns' ? 'single' : 'columns'),
        },
        { type: 'separator' },
        { label: 'Zoom avant', accelerator: 'CmdOrCtrl+Plus', click: () => zoomActive(0.5) },
        { label: 'Zoom arrière', accelerator: 'CmdOrCtrl+-', click: () => zoomActive(-0.5) },
        { label: 'Taille réelle', accelerator: 'CmdOrCtrl+0', click: () => zoomActive(0) },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11' },
        ...(isMac
          ? []
          : [
              {
                label: 'Agrandir la fenêtre',
                click: () => win && (win.isMaximized() ? win.unmaximize() : win.maximize()),
              },
            ]),
        {
          label: 'Outils de développement (compte actif)',
          accelerator: 'CmdOrCtrl+Alt+I',
          click: () => activeContents()?.openDevTools({ mode: 'detach' }),
        },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ------------------------------------------------------------------ fenêtre

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
    fullscreenable: true, // bouton vert / ⌃⌘F sur macOS
    title: app.getName(),
    // macOS prend l'icône du bundle (ou du Dock, voir plus bas) ; Windows préfère .ico, Linux .png
    icon: isMac ? undefined : resource(process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f1e1d' : '#f5f4ee',
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

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devUrl) void w.loadURL(devUrl);
  else void w.loadFile(path.join(__dirname, '../renderer/index.html'));

  // L'interface elle-même ne doit jamais naviguer ni ouvrir de fenêtre.
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e) => e.preventDefault());
  w.on('page-title-updated', (e) => e.preventDefault());

  const relayout = () => {
    applyLayout();
    notify();
  };
  w.on('resize', relayout);
  w.on('maximize', relayout);
  w.on('unmaximize', relayout);
  w.on('enter-full-screen', relayout);
  w.on('leave-full-screen', relayout);

  // On retient la taille « normale » (hors agrandie / plein écran) et l'état agrandi.
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
    // Hors paquet (yarn dev / start), le Dock affiche l'icône d'Electron : on met la nôtre.
    if (isMac && !app.isPackaged)
      app.dock?.setIcon(nativeImage.createFromPath(resource('icon-mac.png')));
    buildMenu();
    createWindow();
    checkForUpdates();
  });

  app.on('before-quit', () => {
    if (state) writeState();
  });
  app.on('window-all-closed', () => app.quit());
}
