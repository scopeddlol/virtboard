import type { AppState, Page, Settings, VoiceParams, VoicePreset } from '@shared/types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const PALETTE = [
  '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#64748b',
]

export const ACCENTS = [
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Magenta', value: '#ec4899' },
  { name: 'Ocean', value: '#06b6d4' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Sunset', value: '#f97316' },
  { name: 'Rose', value: '#f43f5e' },
]

export const EMOJIS = [
  '🔊', '📢', '🎺', '🥁', '🎸', '🎹', '🎵', '🎶', '🎤', '🎧', '📻', '🔔',
  '😂', '🤣', '😱', '😈', '💀', '👻', '🤖', '👽', '🐸', '🐐', '🦆', '🐱',
  '💥', '🔥', '⚡', '💣', '🚨', '🚀', '🏆', '👏', '🙌', '💯', '❌', '✅',
  '🎉', '🎊', '🍕', '☕', '💤', '🫡', '🗿', '🤡', '😎', '🥶', '🤯', '🫠',
]

export const NEUTRAL: VoiceParams = {
  pitch: 0, gate: -100, robot: 0, robotFreq: 90, crushBits: 16, crushRate: 1,
  distortion: 0, lowCut: 20, highCut: 20000, bass: 0, mid: 0, treble: 0,
  echoMix: 0, echoTime: 0.25, echoFeedback: 0.3, reverbMix: 0, reverbSize: 2,
  tremolo: 0, tremoloRate: 5, gain: 0,
}

const preset = (id: string, name: string, emoji: string, color: string, p: Partial<VoiceParams>): VoicePreset => ({
  id, name, emoji, color, builtin: true, hotkey: '', params: { ...NEUTRAL, ...p },
})

export const BUILTIN_PRESETS: VoicePreset[] = [
  preset('clean', 'Clean', '🎙️', '#64748b', { gate: -55 }),
  preset('deep', 'Deep Voice', '🗿', '#6366f1', { pitch: -5, bass: 4, treble: -2 }),
  preset('chipmunk', 'Chipmunk', '🐿️', '#f97316', { pitch: 8, bass: -4, treble: 2 }),
  preset('robot', 'Robot', '🤖', '#06b6d4', { robot: 0.9, robotFreq: 60, echoMix: 0.18, echoTime: 0.03, echoFeedback: 0.45, mid: 3 }),
  preset('radio', 'Radio', '📻', '#eab308', { lowCut: 400, highCut: 3400, distortion: 0.25, mid: 6 }),
  preset('telephone', 'Telephone', '☎️', '#22c55e', { lowCut: 500, highCut: 3000, crushBits: 10, mid: 4 }),
  preset('demon', 'Demon', '😈', '#f43f5e', { pitch: -9, distortion: 0.3, reverbMix: 0.3, reverbSize: 3, bass: 6 }),
  preset('alien', 'Alien', '👽', '#84cc16', { pitch: 3, robot: 0.5, robotFreq: 400, tremolo: 0.4, tremoloRate: 8, echoMix: 0.2 }),
  preset('cave', 'Cave', '🏔️', '#14b8a6', { reverbMix: 0.6, reverbSize: 4, echoMix: 0.3, echoTime: 0.35, echoFeedback: 0.4 }),
  preset('8bit', '8-Bit', '👾', '#a855f7', { crushBits: 5, crushRate: 6, pitch: 2 }),
  preset('megaphone', 'Megaphone', '📢', '#ef4444', { lowCut: 700, highCut: 4500, distortion: 0.55, mid: 8, gain: -4 }),
  preset('ghost', 'Ghost', '👻', '#c4b5fd', { pitch: 2, reverbMix: 0.7, reverbSize: 5, tremolo: 0.5, tremoloRate: 3, echoMix: 0.25 }),
  preset('monster', 'Monster', '🦖', '#16a34a', { pitch: -12, robot: 0.2, robotFreq: 30, bass: 6, reverbMix: 0.2 }),
]

export const DEFAULT_SETTINGS: Settings = {
  inputDeviceId: 'default',
  inputDeviceLabel: '',
  virtualDeviceId: '',
  virtualDeviceLabel: '',
  monitorDeviceId: 'default',
  monitorDeviceLabel: '',
  micVolume: 1,
  soundsVolume: 0.8,
  monitorVolume: 0.7,
  micMuted: false,
  monitorSounds: true,
  monitorVoice: false,
  voiceEnabled: false,
  activePresetId: 'deep',
  noiseSuppression: true,
  echoCancellation: false,
  closeToTray: true,
  startMinimized: false,
  launchOnStartup: false,
  accent: '#8b5cf6',
  hotkeys: {
    stopAll: 'Ctrl+Alt+End',
    toggleMic: 'Ctrl+Alt+M',
    toggleVoice: 'Ctrl+Alt+V',
    nextPage: 'Ctrl+Alt+PageDown',
    prevPage: 'Ctrl+Alt+PageUp',
    toggleWindow: 'Ctrl+Alt+B',
  },
  onboarded: false,
}

export function defaultState(): AppState {
  const page: Page = { id: uid(), name: 'Main', emoji: '🎛️', hotkey: '' }
  return {
    version: 1,
    settings: DEFAULT_SETTINGS,
    pages: [page],
    activePageId: page.id,
    sounds: [],
    presets: BUILTIN_PRESETS,
  }
}

/** Fill in any fields added in newer versions so old state files keep working. */
export function migrate(s: AppState | null): AppState {
  if (!s) return defaultState()
  const base = defaultState()
  const settings = { ...DEFAULT_SETTINGS, ...s.settings, hotkeys: { ...DEFAULT_SETTINGS.hotkeys, ...s.settings?.hotkeys } }
  const pages = s.pages?.length ? s.pages : base.pages
  const custom = (s.presets ?? []).filter((p) => !p.builtin).map((p) => ({ ...p, params: { ...NEUTRAL, ...p.params } }))
  // Built-ins always come from code, but keep any hotkeys the user assigned to them.
  const builtins = BUILTIN_PRESETS.map((b) => ({ ...b, hotkey: s.presets?.find((p) => p.id === b.id)?.hotkey ?? '' }))
  return {
    version: 1,
    settings,
    pages,
    activePageId: pages.some((p) => p.id === s.activePageId) ? s.activePageId : pages[0].id,
    sounds: s.sounds ?? [],
    presets: [...builtins, ...custom],
  }
}
