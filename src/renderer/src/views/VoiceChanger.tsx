import { Check, Copy, Plus } from 'lucide-react'
import type { VoiceParams, VoicePreset } from '@shared/types'
import { findConflict } from '@/lib/conflicts'
import { persisted, useStore } from '@/state/store'
import { HotkeyInput, Kbd } from '@/components/HotkeyInput'
import { Meter } from '@/components/Mixer'
import { EmojiPicker } from '@/components/EmojiPicker'
import { Button, cn, Label, Slider, Switch } from '@/components/ui'

type Def = { key: keyof VoiceParams; label: string; min: number; max: number; step: number; fmt: (v: number) => string; centered?: boolean }
const pct = (v: number) => `${Math.round(v * 100)}%`
const signed = (unit: string) => (v: number) => `${v > 0 ? '+' : ''}${v} ${unit}`
const GROUPS: { title: string; defs: Def[] }[] = [
  {
    title: 'Pitch & character',
    defs: [
      { key: 'pitch', label: 'Pitch', min: -12, max: 12, step: 0.5, fmt: signed('st'), centered: true },
      { key: 'robot', label: 'Robot', min: 0, max: 1, step: 0.01, fmt: pct },
      { key: 'robotFreq', label: 'Robot tone', min: 20, max: 1000, step: 5, fmt: (v) => `${v} Hz` },
      { key: 'distortion', label: 'Distortion', min: 0, max: 1, step: 0.01, fmt: pct },
      { key: 'crushBits', label: 'Bit depth', min: 2, max: 16, step: 1, fmt: (v) => (v >= 16 ? 'Off' : `${v}-bit`) },
      { key: 'crushRate', label: 'Downsample', min: 1, max: 20, step: 1, fmt: (v) => (v <= 1 ? 'Off' : `÷${v}`) },
      { key: 'tremolo', label: 'Tremolo', min: 0, max: 1, step: 0.01, fmt: pct },
      { key: 'tremoloRate', label: 'Tremolo speed', min: 0.5, max: 15, step: 0.5, fmt: (v) => `${v} Hz` },
    ],
  },
  {
    title: 'Tone',
    defs: [
      { key: 'lowCut', label: 'Low cut', min: 20, max: 1500, step: 10, fmt: (v) => (v <= 20 ? 'Off' : `${v} Hz`) },
      { key: 'highCut', label: 'High cut', min: 1500, max: 20000, step: 100, fmt: (v) => (v >= 20000 ? 'Off' : `${(v / 1000).toFixed(1)} kHz`) },
      { key: 'bass', label: 'Bass', min: -12, max: 12, step: 0.5, fmt: signed('dB'), centered: true },
      { key: 'mid', label: 'Mid', min: -12, max: 12, step: 0.5, fmt: signed('dB'), centered: true },
      { key: 'treble', label: 'Treble', min: -12, max: 12, step: 0.5, fmt: signed('dB'), centered: true },
    ],
  },
  {
    title: 'Space',
    defs: [
      { key: 'echoMix', label: 'Echo', min: 0, max: 1, step: 0.01, fmt: pct },
      { key: 'echoTime', label: 'Echo time', min: 0.02, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 1000)} ms` },
      { key: 'echoFeedback', label: 'Echo repeats', min: 0, max: 0.9, step: 0.01, fmt: pct },
      { key: 'reverbMix', label: 'Reverb', min: 0, max: 1, step: 0.01, fmt: pct },
      { key: 'reverbSize', label: 'Room size', min: 0.3, max: 6, step: 0.1, fmt: (v) => `${v.toFixed(1)} s` },
    ],
  },
  {
    title: 'Output',
    defs: [
      { key: 'gate', label: 'Noise gate', min: -100, max: -20, step: 1, fmt: (v) => (v <= -99 ? 'Off' : `${v} dB`) },
      { key: 'gain', label: 'Volume', min: -12, max: 12, step: 0.5, fmt: signed('dB'), centered: true },
    ],
  },
]

function PresetEditor({ preset }: { preset: VoicePreset }) {
  const updatePreset = useStore((s) => s.updatePreset)
  const updateParams = useStore((s) => s.updatePresetParams)
  const createPreset = useStore((s) => s.createPreset)
  const deletePreset = useStore((s) => s.deletePreset)
  const conflict = useStore((s) => findConflict(persisted(s), preset.hotkey, { presetId: preset.id }))
  const locked = preset.builtin

  return (
    <div className="min-h-0 overflow-y-auto px-6 py-5">
      <div className="flex items-center gap-2">
        {locked ? (
          <>
            <span className="text-base">{preset.emoji}</span>
            <h2 className="text-[15px] font-semibold text-zinc-100">{preset.name}</h2>
          </>
        ) : (
          <>
            <EmojiPicker value={preset.emoji} onChange={(emoji) => updatePreset(preset.id, { emoji })} />
            <input
              value={preset.name}
              onChange={(e) => updatePreset(preset.id, { name: e.target.value })}
              className="h-8 min-w-0 flex-1 rounded-md border border-line bg-panel px-2.5 text-[13px] text-zinc-100 outline-none focus:border-accent"
            />
          </>
        )}
      </div>

      {locked && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-[12.5px] text-zinc-400">
          Built-in presets can't be changed.
          <Button size="sm" onClick={() => createPreset(preset)}>
            <Copy size={12} /> Duplicate to edit
          </Button>
        </div>
      )}

      <div className="mt-5 max-w-sm">
        <Label>Shortcut to switch to this voice</Label>
        <HotkeyInput value={preset.hotkey} onChange={(hotkey) => updatePreset(preset.id, { hotkey })} conflict={conflict} placeholder="None" />
      </div>

      {GROUPS.map((g) => (
        <section key={g.title} className="mt-6">
          <h3 className="mb-2 text-[12px] font-medium text-zinc-500">{g.title}</h3>
          <div className="space-y-2.5">
            {g.defs.map((d) => (
              <div key={d.key} className="grid grid-cols-[110px_1fr_70px] items-center gap-3">
                <span className="text-[13px] text-zinc-300">{d.label}</span>
                <Slider
                  value={preset.params[d.key]}
                  onChange={(v) => updateParams(preset.id, { [d.key]: v })}
                  min={d.min}
                  max={d.max}
                  step={d.step}
                  centered={d.centered}
                  disabled={locked}
                />
                <span className="text-right text-[12px] tabular-nums text-zinc-500">{d.fmt(preset.params[d.key])}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      {!locked && (
        <Button variant="danger" className="mt-6" onClick={() => deletePreset(preset.id)}>
          Delete preset
        </Button>
      )}
    </div>
  )
}

function PresetRow({ p, active, selected, onClick }: { p: VoicePreset; active: boolean; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors',
        selected ? 'bg-white/[0.07] text-zinc-100' : 'text-zinc-400 hover:bg-white/[0.035] hover:text-zinc-200',
      )}
    >
      <span className="w-4 text-center">{p.emoji}</span>
      <span className="min-w-0 flex-1 truncate">{p.name}</span>
      {p.hotkey && <Kbd accel={p.hotkey} dim />}
      {active && <Check size={14} className="text-accent" />}
    </button>
  )
}

export function VoiceChanger() {
  const presets = useStore((s) => s.presets)
  const settings = useStore((s) => s.settings)
  const selectedId = useStore((s) => s.selectedPresetId)
  const select = useStore((s) => s.selectPreset)
  const activate = useStore((s) => s.activatePreset)
  const toggleVoice = useStore((s) => s.toggleVoice)
  const setSettings = useStore((s) => s.setSettings)
  const createPreset = useStore((s) => s.createPreset)
  const active = presets.find((p) => p.id === settings.activePresetId)
  const selected = presets.find((p) => p.id === selectedId) ?? active ?? presets[0]
  const on = settings.voiceEnabled
  const builtins = presets.filter((p) => p.builtin)
  const custom = presets.filter((p) => !p.builtin)
  const row = (p: VoicePreset) => (
    <PresetRow
      key={p.id}
      p={p}
      active={on && p.id === settings.activePresetId}
      selected={p.id === selected.id}
      onClick={() => {
        select(p.id)
        activate(p.id)
      }}
    />
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-6 border-b border-line px-6 py-4">
        <label className="flex cursor-pointer items-center gap-3">
          <Switch checked={on} onChange={toggleVoice} />
          <span>
            <span className="block text-[14px] font-medium text-zinc-100">Voice changer {on ? 'on' : 'off'}</span>
            <span className="block text-[12px] text-zinc-500">
              {on ? `Using ${active?.name}` : 'Your normal voice is being sent'}
              {settings.hotkeys.toggleVoice && <> · toggle with <Kbd accel={settings.hotkeys.toggleVoice} dim /></>}
            </span>
          </span>
        </label>
        <div className="flex-1" />
        <div className="w-40">
          <div className="mb-1 text-[11.5px] text-zinc-500">Mic level</div>
          <Meter source="mic" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-300">
          Hear myself
          <Switch checked={settings.monitorVoice} onChange={(monitorVoice) => setSettings({ monitorVoice })} />
        </label>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto border-r border-line p-2">
          <div className="px-2.5 pb-1 pt-1 text-[11px] font-medium text-zinc-500">Presets</div>
          <div className="space-y-0.5">{builtins.map(row)}</div>
          <div className="px-2.5 pb-1 pt-4 text-[11px] font-medium text-zinc-500">Your presets</div>
          <div className="space-y-0.5">{custom.map(row)}</div>
          <button
            onClick={() => createPreset()}
            className="mt-0.5 flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200"
          >
            <Plus size={14} /> New preset
          </button>
        </div>
        <PresetEditor key={selected.id} preset={selected} />
      </div>
    </div>
  )
}
