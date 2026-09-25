import { create } from 'zustand'
import type { AppState, ImportedFile, Page, Settings, Sound, VoiceParams, VoicePreset, VirtualOutput } from '@shared/types'
import { api } from '@/lib/api'
import { defaultState, migrate, NEUTRAL, PALETTE, uid } from '@/lib/defaults'

export type View = 'board' | 'voice' | 'settings'

interface UiState {
  loaded: boolean
  view: View
  search: string
  editingSoundId: string | null
  selectedPresetId: string | null
  failedHotkeys: string[]
  capturing: boolean
}

interface Actions {
  init(): Promise<void>
  setView(v: View): void
  setSearch(s: string): void
  setSettings(p: Partial<Settings>): void
  setHotkey(key: keyof Settings['hotkeys'], accel: string): void
  updateOutput(id: string, patch: Partial<VirtualOutput>): void
  toggleOutput(id: string, channel: 'micMuted' | 'soundsMuted'): void
  // pages
  addPage(): string
  updatePage(id: string, p: Partial<Page>): void
  deletePage(id: string): void
  setActivePage(id: string): void
  cyclePage(dir: 1 | -1): void
  // sounds
  addSounds(files: (ImportedFile & { duration: number; peaks: number[] })[]): void
  updateSound(id: string, p: Partial<Sound>): void
  deleteSound(id: string): void
  copySoundToPage(id: string, pageId: string, move: boolean): void
  moveSound(id: string, toIndex: number): void
  editSound(id: string | null): void
  // presets
  selectPreset(id: string | null): void
  activatePreset(id: string): void
  createPreset(from?: VoicePreset): string
  updatePreset(id: string, p: Partial<Omit<VoicePreset, 'params'>>): void
  updatePresetParams(id: string, p: Partial<VoiceParams>): void
  deletePreset(id: string): void
  toggleVoice(): void
  toggleMic(): void
  setCapturing(v: boolean): void
}

export type Store = AppState & UiState & Actions

const initial = defaultState()

export const useStore = create<Store>()((set, get) => ({
  ...initial,
  loaded: false,
  view: 'board',
  search: '',
  editingSoundId: null,
  selectedPresetId: null,
  failedHotkeys: [],
  capturing: false,

  async init() {
    const loaded = migrate(await api.loadState())
    set({ ...loaded, loaded: true, selectedPresetId: loaded.settings.activePresetId })
  },
  setView: (view) => set({ view }),
  setSearch: (search) => set({ search }),
  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  setHotkey: (key, accel) => set((s) => ({ settings: { ...s.settings, hotkeys: { ...s.settings.hotkeys, [key]: accel } } })),
  updateOutput: (id, patch) => set((s) => ({ settings: { ...s.settings, outputs: s.settings.outputs.map((o) => o.id === id ? { ...o, ...patch } : o) } })),
  toggleOutput: (id, channel) => set((s) => ({ settings: { ...s.settings, outputs: s.settings.outputs.map((o) => o.id === id ? { ...o, [channel]: !o[channel] } : o) } })),

  addPage() {
    const page: Page = { id: uid(), name: `Page ${get().pages.length + 1}`, emoji: '📁', hotkey: '', defaultMode: 'restart' }
    set((s) => ({ pages: [...s.pages, page], activePageId: page.id, view: 'board' }))
    return page.id
  },
  updatePage: (id, p) => set((s) => ({ pages: s.pages.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  deletePage(id) {
    const s = get()
    if (s.pages.length <= 1) return
    const doomed = s.sounds.filter((x) => x.pageId === id)
    const pages = s.pages.filter((p) => p.id !== id)
    const sounds = s.sounds.filter((x) => x.pageId !== id)
    set({ pages, sounds, activePageId: s.activePageId === id ? pages[0].id : s.activePageId })
    for (const d of doomed) if (!sounds.some((x) => x.file === d.file)) api.deleteSoundFile(d.file)
  },
  setActivePage: (id) => set({ activePageId: id }),
  cyclePage(dir) {
    const { pages, activePageId } = get()
    const i = pages.findIndex((p) => p.id === activePageId)
    set({ activePageId: pages[(i + dir + pages.length) % pages.length].id })
  },

  addSounds(files) {
    const s = get()
    const base = s.sounds.filter((x) => x.pageId === s.activePageId).length
    const added: Sound[] = files.map((f, i) => ({
      id: uid(),
      pageId: s.activePageId,
      name: f.name.slice(0, 40),
      file: f.file,
      emoji: '🔊',
      color: PALETTE[(base + i) % PALETTE.length],
      hotkey: '',
      volume: 1,
      trimStart: 0,
      trimEnd: null,
      fadeIn: 0,
      fadeOut: 0,
      rate: 1,
      loop: false,
      mode: s.pages.find((p) => p.id === s.activePageId)?.defaultMode ?? 'restart',
      localPlayback: true,
      duration: f.duration,
      peaks: f.peaks,
      createdAt: Date.now(),
    }))
    set({ sounds: [...s.sounds, ...added] })
  },
  updateSound: (id, p) => set((s) => ({ sounds: s.sounds.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  deleteSound(id) {
    const s = get()
    const doomed = s.sounds.find((x) => x.id === id)
    const sounds = s.sounds.filter((x) => x.id !== id)
    set({ sounds, editingSoundId: s.editingSoundId === id ? null : s.editingSoundId })
    if (doomed && !sounds.some((x) => x.file === doomed.file)) api.deleteSoundFile(doomed.file)
  },
  copySoundToPage(id, pageId, move) {
    const s = get()
    const src = s.sounds.find((x) => x.id === id)
    if (!src) return
    if (move) set({ sounds: s.sounds.map((x) => (x.id === id ? { ...x, pageId } : x)) })
    else set({ sounds: [...s.sounds, { ...src, id: uid(), pageId, createdAt: Date.now() }] })
  },
  moveSound(id, toIndex) {
    const s = get()
    const page = s.sounds.filter((x) => x.pageId === s.activePageId)
    const others = s.sounds.filter((x) => x.pageId !== s.activePageId)
    const from = page.findIndex((x) => x.id === id)
    if (from < 0) return
    const [item] = page.splice(from, 1)
    page.splice(Math.max(0, Math.min(page.length, toIndex)), 0, item)
    set({ sounds: [...others, ...page] })
  },
  editSound: (id) => set({ editingSoundId: id }),

  selectPreset: (id) => set({ selectedPresetId: id }),
  activatePreset: (id) =>
    set((s) => ({ settings: { ...s.settings, activePresetId: id, voiceEnabled: true }, selectedPresetId: id })),
  createPreset(from) {
    const p: VoicePreset = {
      id: uid(),
      name: from ? `${from.name} (custom)` : 'My Voice',
      emoji: from?.emoji ?? '✨',
      color: from?.color ?? PALETTE[get().presets.length % PALETTE.length],
      builtin: false,
      hotkey: '',
      params: { ...(from?.params ?? NEUTRAL) },
    }
    set((s) => ({
      presets: [...s.presets, p],
      selectedPresetId: p.id,
      settings: { ...s.settings, activePresetId: p.id, voiceEnabled: true },
    }))
    return p.id
  },
  updatePreset: (id, p) => set((s) => ({ presets: s.presets.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  updatePresetParams: (id, p) =>
    set((s) => ({ presets: s.presets.map((x) => (x.id === id && !x.builtin ? { ...x, params: { ...x.params, ...p } } : x)) })),
  deletePreset(id) {
    const s = get()
    const target = s.presets.find((p) => p.id === id)
    if (!target || target.builtin) return
    const presets = s.presets.filter((p) => p.id !== id)
    set({
      presets,
      selectedPresetId: s.selectedPresetId === id ? presets[0].id : s.selectedPresetId,
      settings: s.settings.activePresetId === id ? { ...s.settings, activePresetId: presets[0].id } : s.settings,
    })
  },
  toggleVoice: () => set((s) => ({ settings: { ...s.settings, voiceEnabled: !s.settings.voiceEnabled } })),
  toggleMic: () => set((s) => ({ settings: { ...s.settings, micMuted: !s.settings.micMuted } })),
  setCapturing: (capturing) => set({ capturing }),
}))

export const persisted = (s: Store): AppState => ({
  version: 1,
  settings: s.settings,
  pages: s.pages,
  activePageId: s.activePageId,
  sounds: s.sounds,
  presets: s.presets,
})

/** Debounced persistence + hotkey (re)registration in the main process. */
export function startPersistence() {
  let timer: ReturnType<typeof setTimeout> | undefined
  let last: AppState | null = null
  const flush = async () => {
    const s = useStore.getState()
    const snapshot = persisted(s)
    const report = await api.saveState(snapshot)
    useStore.setState({ failedHotkeys: report.failed })
  }
  useStore.subscribe((s) => {
    if (!s.loaded) return
    const snap = persisted(s)
    if (
      last &&
      last.settings === snap.settings &&
      last.pages === snap.pages &&
      last.sounds === snap.sounds &&
      last.presets === snap.presets &&
      last.activePageId === snap.activePageId
    )
      return
    const immediate = !last || last.activePageId !== snap.activePageId
    last = snap
    clearTimeout(timer)
    // Page switches re-register hotkeys, so apply them right away.
    timer = setTimeout(flush, immediate ? 0 : 250)
  })
}

export const activePreset = (s: Store) => s.presets.find((p) => p.id === s.settings.activePresetId) ?? s.presets[0]
