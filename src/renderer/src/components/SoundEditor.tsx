import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { Download, Headphones, Play, RotateCcw, Scissors, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PlayMode, Sound } from '@shared/types'
import { engine } from '@/audio/engine'
import { encodeWav } from '@/audio/wav'
import { api } from '@/lib/api'
import { findConflict } from '@/lib/conflicts'
import { persisted, useStore } from '@/state/store'
import { ColorPicker, EmojiPicker } from './EmojiPicker'
import { HotkeyInput } from './HotkeyInput'
import { usePlaying } from './SoundPad'
import { Button, Dialog, Label, Segmented, Slider, Switch } from './ui'

const t = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`

function Trimmer({ draft, setDraft }: { draft: Sound; setDraft: (p: Partial<Sound>) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const playing = usePlaying(draft.id)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const setRef = useRef(setDraft)
  setRef.current = setDraft
  const regionRef = useRef<ReturnType<ReturnType<typeof RegionsPlugin.create>['addRegion']> | null>(null)

  useEffect(() => {
    let ws: WaveSurfer | null = null
    let alive = true
    engine.getBuffer(draftRef.current).then((buf) => {
      if (!alive || !host.current) return
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b5cf6'
      const regions = RegionsPlugin.create()
      ws = WaveSurfer.create({
        container: host.current,
        height: 150,
        peaks: [buf.getChannelData(0)],
        duration: buf.duration,
        waveColor: 'rgba(255,255,255,0.28)',
        progressColor: 'rgba(255,255,255,0.28)',
        cursorWidth: 0,
        barWidth: 2,
        barGap: 1.5,
        barRadius: 2,
        normalize: true,
        interact: false,
        plugins: [regions],
      })
      ws.on('ready', () => {
        const d = draftRef.current
        regionRef.current = regions.addRegion({
          start: d.trimStart,
          end: d.trimEnd ?? buf.duration,
          color: `color-mix(in oklab, ${accent} 22%, transparent)`,
          drag: true,
          resize: true,
          minLength: 0.05,
        })
        setReady(true)
      })
      regions.on('region-updated', (r) => {
        setRef.current({ trimStart: +r.start.toFixed(3), trimEnd: r.end >= buf.duration - 0.005 ? null : +r.end.toFixed(3) })
      })
    })
    return () => {
      alive = false
      ws?.destroy()
    }
  }, [])

  // Keep the region in sync when trim is changed from the numeric controls.
  useEffect(() => {
    const r = regionRef.current
    if (!r) return
    const end = draft.trimEnd ?? draft.duration
    if (Math.abs(r.start - draft.trimStart) > 0.001 || Math.abs(r.end - end) > 0.001) r.setOptions({ start: draft.trimStart, end })
  }, [draft.trimStart, draft.trimEnd, draft.duration])

  useEffect(() => {
    if (!playing) {
      if (head.current) head.current.style.opacity = '0'
      return
    }
    let raf = 0
    const tick = () => {
      const d = draftRef.current
      const p = engine.progress(d.id)
      const end = d.trimEnd ?? d.duration
      const at = d.trimStart + Math.max(0, p) * (end - d.trimStart)
      if (head.current) {
        head.current.style.opacity = '1'
        head.current.style.left = `${(at / d.duration) * 100}%`
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const end = draft.trimEnd ?? draft.duration
  const nudge = (key: 'trimStart' | 'trimEnd', delta: number) => {
    if (key === 'trimStart') setDraft({ trimStart: Math.max(0, Math.min(end - 0.05, +(draft.trimStart + delta).toFixed(3))) })
    else {
      const v = Math.max(draft.trimStart + 0.05, Math.min(draft.duration, +(end + delta).toFixed(3)))
      setDraft({ trimEnd: v >= draft.duration - 0.005 ? null : v })
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-4">
      <div className="relative">
        <div ref={host} className="relative" />
        {!ready && <div className="h-[150px] animate-pulse rounded-xl bg-white/[0.04]" />}
        <div ref={head} className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white shadow-[0_0_10px_white]" style={{ opacity: 0 }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant={playing ? 'soft' : 'primary'} size="sm" onClick={() => (playing ? engine.stop(draft.id) : engine.play(draft, { localOnly: true }))}>
          {playing ? <Square size={12} fill="currentColor" /> : <Headphones size={13} />}
          {playing ? 'Stop' : 'Preview'}
        </Button>
        <Button size="sm" onClick={() => engine.play(draft)}>
          <Play size={12} /> Play to mic
        </Button>
        {(['trimStart', 'trimEnd'] as const).map((k) => (
          <div key={k} className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-1 py-0.5">
            <span className="px-1.5 text-[10.5px] uppercase tracking-wider text-zinc-500">{k === 'trimStart' ? 'Start' : 'End'}</span>
            <button className="cursor-pointer rounded px-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" onClick={() => nudge(k, -0.05)}>−</button>
            <span className="w-16 text-center font-mono text-[11.5px] tabular-nums text-white">{t(k === 'trimStart' ? draft.trimStart : end)}</span>
            <button className="cursor-pointer rounded px-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" onClick={() => nudge(k, 0.05)}>+</button>
          </div>
        ))}
        <span className="font-mono text-[11.5px] text-zinc-400">
          <Scissors size={12} className="mr-1 inline" />
          {(end - draft.trimStart).toFixed(2)}s of {draft.duration.toFixed(2)}s
        </span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDraft({ trimStart: 0, trimEnd: null, fadeIn: 0, fadeOut: 0 })}>
          <RotateCcw size={12} /> Reset
        </Button>
      </div>
    </div>
  )
}

export function SoundEditor() {
  const id = useStore((s) => s.editingSoundId)
  const sound = useStore((s) => s.sounds.find((x) => x.id === id))
  const editSound = useStore((s) => s.editSound)
  const updateSound = useStore((s) => s.updateSound)
  const deleteSound = useStore((s) => s.deleteSound)
  const [draft, setDraftState] = useState<Sound | null>(null)

  useEffect(() => setDraftState(sound ?? null), [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!sound || !draft) return null
  const setDraft = (p: Partial<Sound>) => setDraftState((d) => (d ? { ...d, ...p } : d))
  const conflict = findConflict(persisted(useStore.getState()), draft.hotkey, { soundId: draft.id, pageId: draft.pageId })
  const close = () => {
    engine.stop(draft.id)
    editSound(null)
  }
  const save = () => {
    updateSound(draft.id, draft)
    close()
    toast.success(`Saved “${draft.name}”`)
  }
  const exportWav = async () => {
    try {
      const rendered = await engine.renderTrimmed(draft)
      if (await api.exportWav(draft.name, encodeWav(rendered))) toast.success('Exported WAV')
    } catch (e) {
      toast.error('Export failed', { description: String(e) })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title="Edit sound"
      description="Trim, fade, set a keybind and choose how it plays."
      className="w-[min(860px,94vw)]"
      icon={<span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent"><Scissors size={18} /></span>}
    >
      <div className="space-y-5 p-6">
        <div className="flex items-center gap-3">
          <EmojiPicker value={draft.emoji} color={draft.color} onChange={(emoji) => setDraft({ emoji })} />
          <input
            value={draft.name}
            onChange={(e) => setDraft({ name: e.target.value })}
            className="h-12 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 font-display text-lg font-semibold text-white outline-none focus:border-accent/60"
          />
          <ColorPicker value={draft.color} onChange={(color) => setDraft({ color })} />
        </div>

        <Trimmer draft={draft} setDraft={setDraft} />

        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <div>
            <Label hint={`${Math.round(draft.volume * 100)}%`}>Volume</Label>
            <Slider value={draft.volume} onChange={(volume) => setDraft({ volume })} min={0} max={2} />
          </div>
          <div>
            <Label hint={`${draft.rate.toFixed(2)}×`}>Speed & pitch</Label>
            <Slider value={draft.rate} onChange={(rate) => setDraft({ rate: +rate.toFixed(2) })} min={0.5} max={2} step={0.05} />
          </div>
          <div>
            <Label hint={`${draft.fadeIn.toFixed(2)}s`}>Fade in</Label>
            <Slider value={draft.fadeIn} onChange={(fadeIn) => setDraft({ fadeIn })} min={0} max={3} step={0.05} />
          </div>
          <div>
            <Label hint={`${draft.fadeOut.toFixed(2)}s`}>Fade out</Label>
            <Slider value={draft.fadeOut} onChange={(fadeOut) => setDraft({ fadeOut })} min={0} max={3} step={0.05} />
          </div>
          <div>
            <Label>Keybind on this page</Label>
            <HotkeyInput value={draft.hotkey} onChange={(hotkey) => setDraft({ hotkey })} conflict={conflict} />
          </div>
          <div>
            <Label>When pressed while playing</Label>
            <Segmented<PlayMode>
              value={draft.mode}
              onChange={(mode) => setDraft({ mode })}
              options={[
                { value: 'restart', label: 'Restart' },
                { value: 'overlap', label: 'Overlap' },
                { value: 'toggle', label: 'Stop' },
              ]}
            />
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <span>
              <span className="block text-[13px] font-medium text-white">Loop</span>
              <span className="block text-[11.5px] text-zinc-400">Repeat the trimmed part until stopped</span>
            </span>
            <Switch checked={draft.loop} onChange={(loop) => setDraft({ loop })} />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <span>
              <span className="block text-[13px] font-medium text-white">Play on my headphones</span>
              <span className="block text-[11.5px] text-zinc-400">Hear it yourself as well as your listeners</span>
            </span>
            <Switch checked={draft.localPlayback} onChange={(localPlayback) => setDraft({ localPlayback })} />
          </label>
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.06] pt-5">
          <Button variant="danger" onClick={() => deleteSound(draft.id)}>
            <Trash2 size={14} /> Delete
          </Button>
          <Button variant="outline" onClick={exportWav}>
            <Download size={14} /> Export WAV
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save changes</Button>
        </div>
      </div>
    </Dialog>
  )
}
