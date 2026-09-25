import type { AppState } from '@shared/types'

const GLOBAL_NAMES: Record<string, string> = {
  stopAll: 'Stop all sounds',
  toggleMic: 'Mute microphone',
  toggleVoice: 'Toggle voice changer',
  nextPage: 'Next page',
  prevPage: 'Previous page',
  toggleWindow: 'Show / hide window',
}

/** Describe what else already uses `accel`, ignoring the thing being edited. */
export function findConflict(
  state: AppState,
  accel: string,
  self: { soundId?: string; pageId?: string; presetId?: string; global?: string; output?: string },
): string | null {
  if (!accel) return null
  const pageId = self.pageId ?? state.activePageId
  const s = state.sounds.find((x) => x.hotkey === accel && x.pageId === pageId && x.id !== self.soundId)
  if (s) return `Already used by “${s.name}” on this page`
  for (const [k, v] of Object.entries(state.settings.hotkeys)) {
    if (v === accel && k !== self.global) return `Already used by “${GLOBAL_NAMES[k] ?? k}”`
  }
  for (const o of state.settings.outputs) {
    for (const key of ['micHotkey', 'soundsHotkey'] as const) {
      if (o[key] === accel && self.output !== `${o.id}:${key}`) return `Already used by ${o.name} ${key === 'micHotkey' ? 'microphone' : 'soundboard'}`
    }
  }
  const p = state.pages.find((x) => x.hotkey === accel && x.id !== self.pageId)
  if (p) return `Already jumps to page “${p.name}”`
  const v = state.presets.find((x) => x.hotkey === accel && x.id !== self.presetId)
  if (v) return `Already activates voice “${v.name}”`
  return null
}
