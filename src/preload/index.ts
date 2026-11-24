import { contextBridge, ipcRenderer } from 'electron';
import type { Layout, MultiApi, PublicState } from '../shared/types';

// Minimal surface exposed to the interface (sidebar). Service pages see none of it: their
// preload (service.ts) exposes nothing.
const api: MultiApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('state:get'),
  addAccount: (providerId: string) => ipcRenderer.invoke('accounts:add', providerId),
  selectAccount: (id: string) => ipcRenderer.invoke('accounts:select', id),
  renameAccount: (id: string, name: string) => ipcRenderer.invoke('accounts:rename', id, name),
  removeAccount: (id: string) => ipcRenderer.invoke('accounts:remove', id),
  setLayout: (mode: Layout) => ipcRenderer.invoke('layout:set', mode),
  placeAccount: (id, targetId, zone) => ipcRenderer.invoke('grid:place', id, targetId, zone),
  equalizeGrid: (path) => ipcRenderer.invoke('grid:equalize', path),
  removeFromGrid: (id) => ipcRenderer.invoke('grid:remove', id),
  resizeGrid: (path, index, size) => ipcRenderer.invoke('grid:resize', path, index, size),
  setDragging: (active) => ipcRenderer.invoke('grid:dragging', active),
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
  onShortcutHint: (cb) => {
    const listener = (_event: unknown, visible: boolean) => cb(visible);
    ipcRenderer.on('shortcut-hint', listener);
    return () => ipcRenderer.removeListener('shortcut-hint', listener);
  },
};

contextBridge.exposeInMainWorld('multi', api);
