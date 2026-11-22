// Types partagés entre le processus principal, le preload et l'interface.
// Uniquement des types : ce fichier ne doit rien importer de Node ni d'Electron.

export type Layout = 'single' | 'columns';

export interface Account {
  id: string;
  name: string;
  color: string;
  /** Identifiant du service (voir providers.ts). */
  provider: string;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ce qui est écrit dans state.json. */
export interface PersistedState {
  version: 2;
  accounts: Account[];
  activeId: string;
  layout: Layout;
  bounds: Bounds | null;
  maximized: boolean;
  fullscreen: boolean;
}

/** Position d'une colonne (en-tête + vue du service), en pixels de la fenêtre. */
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

/** Ce que l'interface reçoit du processus principal. */
export interface PublicState {
  appName: string;
  providers: ProviderInfo[];
  accounts: Account[];
  activeId: string;
  layout: Layout;
  rects: Rect[];
  sidebarW: number;
}

/** API exposée par le preload sous `window.multi`. */
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
}
