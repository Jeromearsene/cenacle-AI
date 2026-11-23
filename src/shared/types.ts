// Types shared between the main process, the preload and the interface.
// Types only: this file must not import anything from Node or Electron.

export type Layout = 'single' | 'columns';

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
  version: 2;
  accounts: Account[];
  activeId: string;
  layout: Layout;
  bounds: Bounds | null;
  maximized: boolean;
  fullscreen: boolean;
}

/** Position of a column (header + service view), in window pixels. */
export interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  headerH: number;
  viewY: number;
  viewHeight: number;
}

export interface ProviderInfo {
  id: string;
  label: string;
}

/** What the interface receives from the main process. */
export interface PublicState {
  appName: string;
  providers: ProviderInfo[];
  accounts: Account[];
  activeId: string;
  layout: Layout;
  rects: Rect[];
  sidebarW: number;
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
  reloadAccount(id: string): Promise<void>;
  onState(cb: (state: PublicState) => void): () => void;
  onRenameRequest(cb: (id: string) => void): () => void;
  /** True while the shortcut key (⌘ / Ctrl) is held. */
  onShortcutHint(cb: (visible: boolean) => void): () => void;
}
