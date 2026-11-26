// Types shared between the main process, the preload and the interface.
// Types only: this file must not import anything from Node or Electron.
import type { Area, Divider, DropZone, GridNode } from './grid';
import type { Locale } from './i18n';
import type { ResourceUsage } from './metrics';
import type { QuotaInfo } from './quota';

export type Layout = 'single' | 'grid';

export interface Account {
  id: string;
  name: string;
  color: string;
  /** Service identifier (see providers.ts). */
  provider: string;
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
  /** The grid mode layout; null until it is first shown (then every account is in it). */
  grid: GridNode | null;
  bounds: Bounds | null;
  maximized: boolean;
  fullscreen: boolean;
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
}

/** What the interface receives from the main process. */
export interface PublicState {
  appName: string;
  locale: Locale;
  providers: ProviderInfo[];
  accounts: Account[];
  activeId: string;
  layout: Layout;
  rects: Rect[];
  /** Resize handles between the cells (grid mode only). */
  dividers: Divider[];
  /** The grid tree (grid mode only) and the area its cells are drawn in. */
  grid: GridNode | null;
  area: Area;
  sidebarW: number;
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
  reloadAccount(id: string): Promise<void>;
  onState(cb: (state: PublicState) => void): () => void;
  onRenameRequest(cb: (id: string) => void): () => void;
  /** True while the shortcut key (⌘ / Ctrl) is held. */
  onShortcutHint(cb: (visible: boolean) => void): () => void;
  /** Memory and CPU of each account's page (and of everything shared), right now. */
  getResourceUsage(): Promise<ResourceUsage>;
  /** The "Resource usage" menu entry was chosen: show or hide the panel. */
  onResourceUsageToggle(cb: () => void): () => void;
}
