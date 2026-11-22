import { contextBridge, ipcRenderer } from 'electron';
import type { Layout, MultiApi, PublicState } from '../shared/types';

// Surface minimale exposée à l'interface (barre latérale). Les pages des services,
// elles, n'ont aucun preload et ne voient rien de tout cela.
const api: MultiApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('state:get'),
  addAccount: (providerId: string) => ipcRenderer.invoke('accounts:add', providerId),
  selectAccount: (id: string) => ipcRenderer.invoke('accounts:select', id),
  renameAccount: (id: string, name: string) => ipcRenderer.invoke('accounts:rename', id, name),
  removeAccount: (id: string) => ipcRenderer.invoke('accounts:remove', id),
  setLayout: (mode: Layout) => ipcRenderer.invoke('layout:set', mode),
  reloadAccount: (id: string) => ipcRenderer.invoke('account:reload', id),
  onState: (cb) => {
    const listener = (_event: unknown, s: PublicState) => cb(s);
    ipcRenderer.on('state', listener);
    return () => ipcRenderer.removeListener('state', listener);
  },
  onRenameRequest: (cb) => {
    const listener = (_event: unknown, id: string) => cb(id);
    ipcRenderer.on('rename-request', listener);
    return () => ipcRenderer.removeListener('rename-request', listener);
  },
};

contextBridge.exposeInMainWorld('multi', api);
