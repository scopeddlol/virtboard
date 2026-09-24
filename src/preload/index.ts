import { contextBridge, ipcRenderer } from 'electron'
import type { HotkeyAction, TrayAction, VirtboardApi } from '../shared/types'

const toArrayBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

function listen<T>(channel: string, cb: (v: T) => void) {
  const fn = (_e: unknown, v: T) => cb(v)
  ipcRenderer.on(channel, fn)
  return () => {
    ipcRenderer.removeListener(channel, fn)
  }
}

const api: VirtboardApi = {
  platform: process.platform,
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  importDialog: () => ipcRenderer.invoke('sound:import-dialog'),
  importBytes: (name, bytes) => ipcRenderer.invoke('sound:import-bytes', name, new Uint8Array(bytes)),
  readSound: async (file) => toArrayBuffer(await ipcRenderer.invoke('sound:read', file)),
  deleteSoundFile: (file) => ipcRenderer.invoke('sound:delete', file),
  exportWav: (name, bytes) => ipcRenderer.invoke('sound:export-wav', name, new Uint8Array(bytes)),
  setHotkeysPaused: (paused) => ipcRenderer.invoke('hotkeys:pause', paused),
  window: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
    close: () => ipcRenderer.send('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
    onMaximizedChange: (cb) => listen<boolean>('maximized', cb),
  },
  onHotkey: (cb) => listen<HotkeyAction>('hotkey', cb),
  onTrayAction: (cb) => listen<TrayAction>('tray-action', cb),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  installVirtualCable: () => ipcRenderer.invoke('vbcable:install'),
  appVersion: () => ipcRenderer.invoke('app:version'),
}

contextBridge.exposeInMainWorld('virtboard', api)
