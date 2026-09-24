import { Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import type { AppState, TrayAction } from '../shared/types'

let tray: Tray | null = null
let muted: boolean | null = null

export function createTray(resDir: string, onAction: (a: TrayAction) => void, onClick: () => void) {
  const icon = nativeImage.createFromPath(join(resDir, process.platform === 'win32' ? 'icon.ico' : 'tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('Virtboard')
  tray.on('click', onClick)
  tray.on('double-click', onClick)
  updateTray(null, resDir, onAction)
  return tray
}

export function updateTray(state: AppState | null, resDir: string, onAction: (a: TrayAction) => void) {
  if (!tray) return
  const s = state?.settings
  if (s && muted !== s.micMuted) {
    muted = s.micMuted
    const name = process.platform === 'win32' ? (muted ? 'tray-muted.ico' : 'icon.ico') : muted ? 'tray-muted.png' : 'tray.png'
    tray.setImage(nativeImage.createFromPath(join(resDir, name)))
  }
  const preset = state?.presets.find((p) => p.id === s?.activePresetId)
  tray.setToolTip(
    s
      ? `Virtboard — ${s.micMuted ? 'mic muted' : 'mic live'} · ${s.voiceEnabled ? `voice: ${preset?.name ?? 'custom'}` : 'voice changer off'}`
      : 'Virtboard',
  )
  const menu = Menu.buildFromTemplate([
    { label: 'Show Virtboard', click: () => onAction({ type: 'show' }) },
    { type: 'separator' },
    {
      label: 'Voice changer',
      type: 'checkbox',
      checked: !!s?.voiceEnabled,
      click: () => onAction({ type: 'toggleVoice' }),
    },
    {
      label: 'Voice preset',
      enabled: !!state?.presets.length,
      submenu: (state?.presets ?? []).map((p) => ({
        label: `${p.emoji}  ${p.name}`,
        type: 'radio' as const,
        checked: p.id === s?.activePresetId,
        click: () => onAction({ type: 'preset', id: p.id }),
      })),
    },
    {
      label: 'Sound page',
      enabled: !!state?.pages.length,
      submenu: (state?.pages ?? []).map((p) => ({
        label: `${p.emoji}  ${p.name}`,
        type: 'radio' as const,
        checked: p.id === state?.activePageId,
        click: () => onAction({ type: 'page', id: p.id }),
      })),
    },
    { type: 'separator' },
    { label: 'Mute microphone', type: 'checkbox', checked: !!s?.micMuted, click: () => onAction({ type: 'toggleMic' }) },
    { label: 'Stop all sounds', click: () => onAction({ type: 'stopAll' }) },
    { type: 'separator' },
    { label: 'Settings…', click: () => onAction({ type: 'openSettings' }) },
    { label: 'Quit Virtboard', role: 'quit' },
  ])
  tray.setContextMenu(menu)
}
