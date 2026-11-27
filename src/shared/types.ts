// Types shared between the main process, the preload and the interface.
// Types only: this file must not import anything from Node or Electron.
import type { Area, Divider, DropZone, GridNode } from './grid';
import type { Locale } from './i18n';
import type { ResourceUsage } from './metrics';
import type { QuotaInfo } from './quota';

export type Layout = 'single' | 'grid';

/** 'system' follows the OS light/dark setting. */
export type Theme = 'light' | 'dark' | 'system';

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system';

export interface Account {
  id: string;
  name: string;
  color: string;
  /** Service identifier (see providers.ts). */
  provider: string;
  /** Address of the conversation the account was on, reopened at the next launch. */
  lastUrl?: string;
}

/** `manual`: the order of the accounts as they are (shortcuts follow it). `provider`: grouped by service. */
export type AccountSort = 'manual' | 'provider';

/** How the sidebar lists accounts: kept between launches. */
export interface AccountView {
  /** A service id to list alone, or null for every service. */
  filter: string | null;
  sort: AccountSort;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What is written to state.json. */
export interface PersistedState {
  version: 3;
  accounts: Account[];
  activeId: string;
  layout: Layout;
  accountView: AccountView;
  /** Icon of each service (data URL), learned from the service's pages. */
  providerIcons: Record<string, string>;
  /** The grid mode layout; null until it is first shown (then every account is in it). */
  grid: GridNode | null;
  bounds: Bounds | null;
  maximized: boolean;
  fullscreen: boolean;
  /** Manual language override; null follows the system language. */
  localeOverride: Locale | null;
  theme: Theme;
}

/** Position of a cell (header + service view below it), in window pixels. */
export interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  /** Total height, header included. */
  height: number;
  headerH: number;
}

export interface ProviderInfo {
  id: string;
  label: string;
  /** The service's own icon, once known (a data URL). */
  icon?: string;
}

/** What the interface receives from the main process. */
export interface PublicState {
  appName: string;
  /** Interface language actually in use (the override, or the resolved system language). */
  locale: Locale;
  /** The user's choice: null means "follow the system language". */
  localeOverride: Locale | null;
  theme: Theme;
  providers: ProviderInfo[];
  accounts: Account[];
  activeId: string;
  /** Accounts that raised a notification nobody has looked at yet. */
  unread: string[];
  layout: Layout;
  accountView: AccountView;
  rects: Rect[];
  /** Resize handles between the cells (grid mode only). */
  dividers: Divider[];
  /** The grid tree (grid mode only) and the area its cells are drawn in. */
  grid: GridNode | null;
  area: Area;
  sidebarW: number;
  /** The window is in full screen (on macOS, the window buttons are then hidden). */
  fullscreen: boolean;
  /** Accounts whose usage limit is close or reached, by account id. */
  quotas: Record<string, QuotaInfo>;
}

/** API exposed by the preload as `window.multi`. */
export interface MultiApi {
  platform: string;
  getState(): Promise<PublicState>;
  addAccount(providerId: string): Promise<string>;
  selectAccount(id: string): Promise<boolean>;
  renameAccount(id: string, name: string): Promise<boolean>;
  removeAccount(id: string): Promise<boolean>;
  setLayout(mode: Layout): Promise<void>;
  /** Filters and groups the accounts of the sidebar (kept between launches). */
  setAccountView(view: AccountView): Promise<void>;
  /** Drops an account on a cell of the grid: next to it (an edge) or in its place (center). */
  placeAccount(id: string, targetId: string, zone: DropZone): Promise<void>;
  /** Equal sizes for the whole grid, or for the split found at `path`. */
  equalizeGrid(path?: number[]): Promise<void>;
  /** Takes an account out of the grid (it stays in the sidebar). */
  removeFromGrid(id: string): Promise<void>;
  /** Sets the share of child `index` of the split found at `path`. */
  resizeGrid(path: number[], index: number, size: number): Promise<void>;
  /** True while the interface is dragging or resizing: the service pages are hidden meanwhile. */
  setDragging(active: boolean): Promise<void>;
  setLocale(pref: Locale | 'system'): Promise<void>;
  setTheme(pref: Theme): Promise<void>;
  /** True while the Settings dialog is open: the service pages are hidden meanwhile (see
   * `setDragging` above — same reason: they are native views stacked above this page). */
  setSettingsOpen(open: boolean): Promise<void>;
  reloadAccount(id: string): Promise<void>;
  onState(cb: (state: PublicState) => void): () => void;
  onRenameRequest(cb: (id: string) => void): () => void;
  /** True while the shortcut key (⌘ / Ctrl) is held. */
  onShortcutHint(cb: (visible: boolean) => void): () => void;
  /** Memory and CPU of each account's page (and of everything shared), right now. */
  getResourceUsage(): Promise<ResourceUsage>;
  /** The "Resource usage" menu entry was chosen: show or hide the panel. */
  onResourceUsageToggle(cb: () => void): () => void;
  /** The ⌘, / Ctrl, shortcut or the "Settings" menu item was used. */
  onOpenSettings(cb: () => void): () => void;
}
