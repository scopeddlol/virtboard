import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Copy, Ear, Lock, Plus, Power, Trash2, WandSparkles } from 'lucide-react'
import type { VoiceParams, VoicePreset } from '@shared/types'
import { engine } from '@/audio/engine'
import { findConflict } from '@/lib/conflicts'
import { persisted, useStore } from '@/state/store'
import { Kbd, HotkeyInput } from '@/components/HotkeyInput'
import { Meter } from '@/components/Mixer'
import { ColorPicker, EmojiPicker } from '@/components/EmojiPicker'
import { Button, cn, Label, Slider, Switch } from '@/components/ui'

function Spectrum({ active }: { active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current!
    const g = c.getContext('2d')!
    const data = new Uint8Array(256)
    let raf = 0
    const levels = new Float32Array(64)
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) return
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth * dpr
      const h = c.clientHeight * dpr
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
      }
      g.clearRect(0, 0, w, h)
      const a = engine.micAnalyser
      if (a) a.getByteFrequencyData(data)
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      const grad = g.createLinearGradient(0, h, 0, 0)
      grad.addColorStop(0, accent)
      grad.addColorStop(1, '#f0abfc')
      g.fillStyle = grad
      const n = levels.length
      const bw = w / n
      for (let i = 0; i < n; i++) {
        // log-ish bin mapping so voices fill the whole width
        const bin = Math.floor(Math.pow(i / n, 1.6) * 180) + 1
        const v = a ? data[bin] / 255 : 0
        levels[i] = Math.max(v, levels[i] * 0.88)
        const bh = Math.max(3 * dpr, levels[i] * h * 0.92)
        const x = i * bw + bw * 0.2
        const r = Math.min(bw * 0.3, 4 * dpr)
        g.globalAlpha = active ? 0.95 : 0.35
        g.beginPath()
        g.roundRect(x, (h - bh) / 2, bw * 0.6, bh, r)
        g.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [active])
  return (
    <div className="relative h-full w-full">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

type Def = { key: keyof VoiceParams; label: string; min: number; max: number; step: number; fmt: (v: number) => string; centered?: boolean }
const pct = (v: number) => `${Math.round(v * 100)}%`
const GROUPS: { title: string; defs: Def[] }[] = [
  {
    title: 'Pitch & character',
    defs: [
      { key: 'pitch', label: 'Pitch', min: -12, max: 12, step: 0.5, fmt: (v) => `${v > 0 ? '+' : ''}${v} st`, centered: true },
      { key: 'robot', label: 'Robot', min: 0, max: 1, step: 0.01, fmt: pct },
      { key: 'robotFreq', label: 'Robot tone', min: 20, max: 1000, step: 5, fmt: (v) => `${v} Hz` },
      { key: 'distortion', label: 'Distortion', min: 0, max: 1, step: 0.01, fmt: pct },
      { key: 'crushBits', label: 'Bit depth', min: 2, max: 16, step: 1, fmt: (v) => (v >= 16 ? 'off' : `${v}-bit`) },
      { key: 'crushRate', label: 'Downsample', min: 1, max: 20, step: 1, fmt: (v) => (v <= 1 ? 'off' : `÷${v}`) },
      { key: 'tremolo', label: 'Tremolo', min: 0, max: 1, step: 0.01, fmt: pct },
      { key: 'tremoloRate', label: 'Tremolo speed', min: 0.5, max: 15, step: 0.5, fmt: (v) => `${v} Hz` },
    ],
  },
  {
    title: 'Tone',
    defs: [
      { key: 'lowCut', label: 'Low cut', min: 20, max: 1500, step: 10, fmt: (v) => (v <= 20 ? 'off' : `${v} Hz`) },
      { key: 'highCut', label: 'High cut', min: 1500, max: 20000, step: 100, fmt: (v) => (v >= 20000 ? 'off' : `${(v / 1000).toFixed(1)} kHz`) },
      { key: 'bass', label: 'Bass', min: -12, max: 12, step: 0.5, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB`, centered: true },
      { key: 'mid', label: 'Mid', min: -12, max: 12, step: 0.5, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB`, centered: true },
      { key: 'treble', label: 'Treble', min: -12, max: 12, step: 0.5, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB`, centered: true },
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
      { key: 'gate', label: 'Noise gate', min: -100, max: -20, step: 1, fmt: (v) => (v <= -99 ? 'off' : `${v} dB`) },
      { key: 'gain', label: 'Output gain', min: -12, max: 12, step: 0.5, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB`, centered: true },
    ],
  },
]

function tags(p: VoiceParams) {
  const t: string[] = []
  if (p.pitch) t.push(`${p.pitch > 0 ? '+' : ''}${p.pitch} st`)
  if (p.robot > 0) t.push('robot')
  if (p.crushBits < 16 || p.crushRate > 1) t.push('crush')
  if (p.distortion > 0) t.push('drive')
  if (p.lowCut > 20 || p.highCut < 20000) t.push('filter')
  if (p.echoMix > 0) t.push('echo')
  if (p.reverbMix > 0) t.push('reverb')
  if (p.tremolo > 0) t.push('tremolo')
  if (p.gate > -99) t.push('gate')
  return t.length ? t : ['natural']
}

function PresetCard({ p, active, selected, onClick }: { p: VoicePreset; active: boolean; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative flex cursor-pointer flex-col items-start gap-2 overflow-hidden rounded-2xl border p-3.5 text-left transition-colors',
        selected ? 'border-white/25 bg-white/[0.07]' : 'border-white/[0.06] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.045]',
      )}
      style={{ boxShadow: active ? `0 0 0 1.5px ${p.color}, 0 12px 40px -12px ${p.color}` : '0 0 0 0px transparent, 0 0 0 0px transparent' }}
    >
      <div className="absolute inset-0 -z-0 opacity-60" style={{ background: `radial-gradient(90% 80% at 0% 0%, color-mix(in oklab, ${p.color} ${active ? 35 : 14}%, transparent), transparent 70%)` }} />
      <div className="relative flex w-full items-center justify-between">
        <span className="text-[26px] leading-none">{p.emoji}</span>
        {active ? (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: p.color }}>Live</span>
        ) : p.hotkey ? (
          <Kbd accel={p.hotkey} dim />
        ) : p.builtin ? (
          <Lock size={11} className="text-zinc-600" />
        ) : null}
      </div>
      <div className="relative text-[13.5px] font-semibold text-white">{p.name}</div>
      <div className="relative flex flex-wrap gap-1">
        {tags(p.params).slice(0, 3).map((t) => (
          <span key={t} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">{t}</span>
        ))}
      </div>
    </motion.button>
  )
}

function PresetEditor({ preset }: { preset: VoicePreset }) {
  const updatePreset = useStore((s) => s.updatePreset)
  const updateParams = useStore((s) => s.updatePresetParams)
  const createPreset = useStore((s) => s.createPreset)
  const deletePreset = useStore((s) => s.deletePreset)
  const activate = useStore((s) => s.activatePreset)
  const activeId = useStore((s) => s.settings.activePresetId)
  const voiceOn = useStore((s) => s.settings.voiceEnabled)
  const conflict = useStore((s) => findConflict(persisted(s), preset.hotkey, { presetId: preset.id }))
  const locked = preset.builtin

  return (
    <div className="glass flex h-full min-h-0 flex-col rounded-2xl">
      <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
        {locked ? (
          <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: `color-mix(in oklab, ${preset.color} 30%, transparent)` }}>{preset.emoji}</span>
        ) : (
          <EmojiPicker value={preset.emoji} color={preset.color} onChange={(emoji) => updatePreset(preset.id, { emoji })} />
        )}
        <div className="min-w-0 flex-1">
          {locked ? (
            <div className="font-display text-lg font-semibold text-white">{preset.name}</div>
          ) : (
            <input
              value={preset.name}
              onChange={(e) => updatePreset(preset.id, { name: e.target.value })}
              className="w-full rounded-lg border border-transparent bg-transparent px-1 font-display text-lg font-semibold text-white outline-none hover:border-white/10 focus:border-accent/60"
            />
          )}
          <div className="px-1 text-[11.5px] text-zinc-400">{locked ? 'Built-in preset — make a copy to tweak it' : 'Custom preset — changes apply live'}</div>
        </div>
        {!(activeId === preset.id && voiceOn) && (
          <Button size="sm" variant="primary" onClick={() => activate(preset.id)}>
            <Power size={12} /> Use
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {locked ? (
          <button
            onClick={() => createPreset(preset)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-accent/40 bg-accent/[0.06] p-3 text-left transition-colors hover:bg-accent/10"
          >
            <Copy size={16} className="text-accent" />
            <span className="text-[12.5px] text-zinc-200">Customize a copy of <b>{preset.name}</b></span>
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Color</Label>
              <ColorPicker value={preset.color} onChange={(color) => updatePreset(preset.id, { color })} />
            </div>
          </div>
        )}
        <div>
          <Label>Activation hotkey</Label>
          <HotkeyInput value={preset.hotkey} onChange={(hotkey) => updatePreset(preset.id, { hotkey })} conflict={conflict} placeholder="Optional" />
        </div>
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{g.title}</div>
            <div className="space-y-3.5">
              {g.defs.map((d) => (
                <div key={d.key} className="grid grid-cols-[96px_1fr_64px] items-center gap-3">
                  <span className="text-[12.5px] text-zinc-300">{d.label}</span>
                  <Slider
                    value={preset.params[d.key]}
                    onChange={(v) => updateParams(preset.id, { [d.key]: v })}
                    min={d.min}
                    max={d.max}
                    step={d.step}
                    centered={d.centered}
                    disabled={locked}
                    color={preset.color}
                  />
                  <span className="text-right font-mono text-[11px] tabular-nums text-zinc-400">{d.fmt(preset.params[d.key])}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!locked && (
          <Button variant="danger" className="w-full" onClick={() => deletePreset(preset.id)}>
            <Trash2 size={14} /> Delete preset
          </Button>
        )}
      </div>
    </div>
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

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_380px] gap-5 px-8 pb-6 pt-7">
      <div className="flex min-h-0 flex-col gap-5">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-6">
          <div className="absolute inset-0 opacity-70" style={{ background: `radial-gradient(60% 120% at 100% 0%, color-mix(in oklab, ${active?.color ?? 'var(--accent)'} ${on ? 30 : 8}%, transparent), transparent)` }} />
          <div className="relative flex items-center gap-5">
            <motion.button
              onClick={toggleVoice}
              whileTap={{ scale: 0.94 }}
              className={cn(
                'grid h-[76px] w-[76px] shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-all duration-300',
                on ? 'border-white/30 text-white' : 'border-white/10 bg-white/[0.04] text-zinc-500 hover:text-zinc-200',
              )}
              style={on ? { background: `radial-gradient(circle at 30% 25%, color-mix(in oklab, ${active?.color} 90%, white), ${active?.color})`, boxShadow: `0 0 50px -6px ${active?.color}` } : undefined}
            >
              <Power size={30} strokeWidth={2.4} />
            </motion.button>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Voice changer {on ? 'is on' : 'is off'}</div>
              <div className="mt-1 flex items-center gap-2 font-display text-[28px] font-bold tracking-tight text-white">
                <span>{active?.emoji}</span>
                <span className={cn('truncate', on ? 'text-gradient' : 'text-zinc-500')}>{active?.name}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-zinc-400">
                <span className="flex items-center gap-1.5 whitespace-nowrap">Toggle <Kbd accel={settings.hotkeys.toggleVoice} dim /></span>
                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
                  <Ear size={14} /> Hear myself
                  <Switch checked={settings.monitorVoice} onChange={(monitorVoice) => setSettings({ monitorVoice })} />
                </label>
              </div>
            </div>
            <div className="h-[92px] w-[34%] min-w-[170px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30 px-2">
              <Spectrum active={on} />
            </div>
          </div>
          <Meter source="mic" className="relative mt-5" color={active?.color} />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <WandSparkles size={17} className="text-accent" /> Presets
          </h2>
          <Button size="sm" onClick={() => createPreset()}>
            <Plus size={13} /> New preset
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 pb-2">
            {presets.map((p) => (
              <PresetCard
                key={p.id}
                p={p}
                active={on && p.id === settings.activePresetId}
                selected={p.id === selected.id}
                onClick={() => {
                  select(p.id)
                  activate(p.id)
                }}
              />
            ))}
            <button
              onClick={() => createPreset()}
              className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/10 text-[12px] text-zinc-500 transition-colors hover:border-accent/50 hover:text-zinc-200"
            >
              <Plus size={18} /> Create your own
            </button>
          </div>
        </div>
      </div>
      <PresetEditor key={selected.id} preset={selected} />
    </div>
  )
}
