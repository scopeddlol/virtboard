// Types shared between the Electron main process, preload and renderer.

export type PlayMode = 'overlap' | 'restart' | 'toggle'

export interface Sound {
  id: string
  pageId: string
  name: string
  /** File name inside the app's sounds directory. */
  file: string
  emoji: string
  color: string
  /** Electron accelerator, e.g. "Ctrl+Shift+1" or "num5". Empty = none. */
  hotkey: string
  volume: number // 0..2 (1 = 100%)
  /** Non-destructive trim, in seconds. */
  trimStart: number
  trimEnd: number | null
  fadeIn: number
  fadeOut: number
  rate: number // playback speed (0.5..2)
  loop: boolean
  mode: PlayMode
  /** Also play this sound on your own headphones (when monitoring is on). */
  localPlayback: boolean
  duration: number
  /** ~48 normalized peaks for the mini waveform on the pad. */
  peaks: number[]
  createdAt: number
}

export interface Page {
  id: string
  name: string
  emoji: string
  /** Optional global hotkey that jumps straight to this page. */
  hotkey: string
}

export interface VoiceParams {
  pitch: number // semitones -12..12
  gate: number // dB threshold (-100 = off)
  robot: number // ring-mod mix 0..1
  robotFreq: number // Hz
  crushBits: number // 16 = off
  crushRate: number // 1 = off (sample-hold factor)
  distortion: number // 0..1
  lowCut: number // Hz highpass (20 = off)
  highCut: number // Hz lowpass (20000 = off)
  bass: number // dB
  mid: number // dB
  treble: number // dB
  echoMix: number // 0..1
  echoTime: number // seconds
  echoFeedback: number // 0..0.9
  reverbMix: number // 0..1
  reverbSize: number // seconds
  tremolo: number // depth 0..1
  tremoloRate: number // Hz
  gain: number // output dB
}

export interface VoicePreset {
  id: string
  name: string
  emoji: string
  color: string
  builtin: boolean
  hotkey: string
  params: VoiceParams
}

export interface Hotkeys {
  stopAll: string
  toggleMic: string
  toggleVoice: string
  nextPage: string
  prevPage: string
  toggleWindow: string
}

export interface Settings {
  inputDeviceId: string
  inputDeviceLabel: string
  virtualDeviceId: string
  virtualDeviceLabel: string
  monitorDeviceId: string
  monitorDeviceLabel: string
  micVolume: number // 0..2
  soundsVolume: number // 0..2
  monitorVolume: number // 0..2
  micMuted: boolean
  monitorSounds: boolean
  monitorVoice: boolean
  voiceEnabled: boolean
  activePresetId: string
  noiseSuppression: boolean
  echoCancellation: boolean
  closeToTray: boolean
  startMinimized: boolean
  launchOnStartup: boolean
  accent: string
  hotkeys: Hotkeys
  onboarded: boolean
}

export interface AppState {
  version: 1
  settings: Settings
  pages: Page[]
  activePageId: string
  sounds: Sound[]
  presets: VoicePreset[]
}

export type HotkeyAction =
  | { type: 'sound'; id: string }
  | { type: 'page'; id: string }
  | { type: 'preset'; id: string }
  | { type: 'stopAll' }
  | { type: 'toggleMic' }
  | { type: 'toggleVoice' }
  | { type: 'nextPage' }
  | { type: 'prevPage' }

export type TrayAction =
  | HotkeyAction
  | { type: 'show' }
  | { type: 'openSettings' }

export interface HotkeyReport {
  failed: string[]
}

export interface ImportedFile {
  file: string
  name: string
}

export interface VirtboardApi {
  platform: string
  loadState(): Promise<AppState | null>
  saveState(state: AppState): Promise<HotkeyReport>
  importDialog(): Promise<ImportedFile[]>
  importBytes(name: string, bytes: ArrayBuffer): Promise<ImportedFile>
  readSound(file: string): Promise<ArrayBuffer>
  deleteSoundFile(file: string): Promise<void>
  exportWav(suggestedName: string, bytes: ArrayBuffer): Promise<boolean>
  setHotkeysPaused(paused: boolean): Promise<void>
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizedChange(cb: (maximized: boolean) => void): () => void
  }
  onHotkey(cb: (action: HotkeyAction) => void): () => void
  onTrayAction(cb: (action: TrayAction) => void): () => void
  openExternal(url: string): void
  installVirtualCable(): Promise<'started' | 'opened-website' | 'failed'>
  appVersion(): Promise<string>
}
