import { globalShortcut } from 'electron'
import type { AppState, HotkeyAction } from '../shared/types'

let paused = false
let lastState: AppState | null = null
let emit: (action: HotkeyAction) => void = () => {}

export function onHotkey(fn: (action: HotkeyAction) => void) {
  emit = fn
}

/** Collect every accelerator that should be live for the given state. First binding wins. */
function bindings(state: AppState) {
  const map = new Map<string, HotkeyAction>()
  const add = (accel: string, action: HotkeyAction) => {
    const key = accel.trim()
    if (key && !map.has(key)) map.set(key, action)
  }
  // Sounds on the active page get priority: the same key can mean something else on another page.
  for (const s of state.sounds) if (s.pageId === state.activePageId) add(s.hotkey, { type: 'sound', id: s.id })
  const h = state.settings.hotkeys
  add(h.stopAll, { type: 'stopAll' })
  add(h.toggleMic, { type: 'toggleMic' })
  add(h.toggleVoice, { type: 'toggleVoice' })
  add(h.nextPage, { type: 'nextPage' })
  add(h.prevPage, { type: 'prevPage' })
  for (const p of state.pages) add(p.hotkey, { type: 'page', id: p.id })
  for (const p of state.presets) add(p.hotkey, { type: 'preset', id: p.id })
  return map
}

let toggleWindow: () => void = () => {}
export function onToggleWindow(fn: () => void) {
  toggleWindow = fn
}

/** Re-register all global shortcuts. Returns accelerators that could not be registered. */
export function applyHotkeys(state: AppState | null = lastState): string[] {
  lastState = state
  globalShortcut.unregisterAll()
  if (!state || paused) return []
  const failed: string[] = []
  const tryRegister = (accel: string, fn: () => void) => {
    try {
      if (!globalShortcut.register(accel, fn)) failed.push(accel)
    } catch {
      failed.push(accel)
    }
  }
  const win = state.settings.hotkeys.toggleWindow
  if (win) tryRegister(win, () => toggleWindow())
  for (const [accel, action] of bindings(state)) {
    if (accel === win) continue
    tryRegister(accel, () => emit(action))
  }
  return failed
}

export function setPaused(value: boolean) {
  paused = value
  applyHotkeys()
}
