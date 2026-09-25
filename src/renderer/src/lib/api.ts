import type { AppState, VirtboardApi } from '@shared/types'

declare global {
  interface Window {
    virtboard?: VirtboardApi
  }
}

/** Browser fallback so the UI can be developed with plain `vite` (no Electron). */
function createBrowserApi(): VirtboardApi {
  const files = new Map<string, ArrayBuffer>()
  const noop = () => () => {}
  const pick = () =>
    new Promise<File[]>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = 'audio/*'
      input.onchange = () => resolve([...(input.files ?? [])])
      input.click()
    })
  const api: VirtboardApi = {
    platform: 'web',
    async loadState() {
      try {
        return JSON.parse(localStorage.getItem('virtboard-state') ?? 'null') as AppState | null
      } catch {
        return null
      }
    },
    async saveState(state) {
      try {
        localStorage.setItem('virtboard-state', JSON.stringify(state))
      } catch {
        /* storage may be unavailable */
      }
      return { failed: [] }
    },
    async importDialog() {
      const picked = await pick()
      return Promise.all(picked.map(async (f) => api.importBytes(f.name, await f.arrayBuffer())))
    },
    async importBytes(name, bytes) {
      const file = `${crypto.randomUUID()}${name.slice(name.lastIndexOf('.'))}`
      files.set(file, bytes)
      return { file, name: name.replace(/\.[^.]+$/, '') }
    },
    async readSound(file) {
      const mem = files.get(file)
      if (mem) return mem.slice(0)
      const res = await fetch(`demo/${file}`)
      if (!res.ok) throw new Error('Sound not found')
      return res.arrayBuffer()
    },
    async deleteSoundFile(file) {
      files.delete(file)
    },
    async exportWav(name, bytes) {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
      a.download = `${name}.wav`
      a.click()
      return true
    },
    async setHotkeysPaused() {},
    window: {
      minimize() {},
      toggleMaximize() {},
      close() {},
      isMaximized: async () => false,
      onMaximizedChange: noop,
      setZoom: (factor) => { document.documentElement.style.zoom = String(factor) },
      onZoomChange: noop,
    },
    onHotkey: noop,
    onTrayAction: noop,
    openExternal: (url) => window.open(url, '_blank'),
    installVirtualCable: async () => {
      window.open('https://vb-audio.com/Cable/', '_blank')
      return 'opened-website'
    },
    appVersion: async () => '0.2.0',
  }
  return api
}

export const api: VirtboardApi = window.virtboard ?? createBrowserApi()
export const isElectron = !!window.virtboard
