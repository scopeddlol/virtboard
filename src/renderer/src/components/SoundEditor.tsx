import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import type { PlayMode, Sound } from '@shared/types'
import { engine } from '@/audio/engine'
import { encodeWav } from '@/audio/wav'
import { api } from '@/lib/api'
import { findConflict } from '@/lib/conflicts'
import { persisted, useStore } from '@/state/store'
import { EmojiPicker } from './EmojiPicker'
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
        height: 90,
        peaks: [buf.getChannelData(0)],
        duration: buf.duration,
        waveColor: 'rgba(255,255,255,0.22)',
        progressColor: 'rgba(255,255,255,0.22)',
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
          color: `color-mix(in oklab, ${accent} 18%, transparent)`,
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
    <div>
      <div className="relative rounded-md border border-line bg-base px-2 py-2">
        <div ref={host} className="relative" />
        {!ready && <div className="h-[90px]" />}
        <div ref={head} className="pointer-events-none absolute bottom-2 top-2 w-px bg-white" style={{ opacity: 0 }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => (playing ? engine.stop(draft.id) : engine.play(draft, { localOnly: true }))}>
          {playing ? <Square size={10} fill="currentColor" /> : <Play size={11} />}
          {playing ? 'Stop' : 'Preview'}
        </Button>
        {(['trimStart', 'trimEnd'] as const).map((k) => (
          <div key={k} className="flex items-center rounded-md border border-line text-[12px]">
            <span className="px-2 text-zinc-500">{k === 'trimStart' ? 'Start' : 'End'}</span>
            <button className="cursor-pointer px-1.5 py-1 text-zinc-400 hover:text-zinc-100" onClick={() => nudge(k, -0.05)}>−</button>
            <span className="w-14 text-center tabular-nums text-zinc-200">{t(k === 'trimStart' ? draft.trimStart : end)}</span>
            <button className="cursor-pointer px-1.5 py-1 text-zinc-400 hover:text-zinc-100" onClick={() => nudge(k, 0.05)}>+</button>
          </div>
        ))}
        <span className="text-[12px] tabular-nums text-zinc-500">{(end - draft.trimStart).toFixed(2)}s</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDraft({ trimStart: 0, trimEnd: null, fadeIn: 0, fadeOut: 0 })}>
          Reset
        </Button>
      </div>
    </div>
  )
}

function Toggle({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="block text-[13px] text-zinc-200">{title}</span>
        <span className="block text-[12px] text-zinc-500">{hint}</span>
      </span>
      <Switch checked={checked} onChange={onChange} />
    </label>
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
    <Dialog open onOpenChange={(o) => !o && close()} title="Edit sound" className="w-[min(680px,94vw)]">
      <div className="space-y-4 px-5 pb-5 pt-3">
        <div className="flex gap-2">
          <EmojiPicker value={draft.emoji} onChange={(emoji) => setDraft({ emoji })} />
          <input
            value={draft.name}
            onChange={(e) => setDraft({ name: e.target.value })}
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-base px-2.5 text-[13px] text-zinc-100 outline-none focus:border-accent"
          />
        </div>

        <div>
          <Label>Trim: drag the edges of the highlighted area</Label>
          <Trimmer draft={draft} setDraft={setDraft} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <Label hint={`${Math.round(draft.volume * 100)}%`}>Volume</Label>
            <Slider value={draft.volume} onChange={(volume) => setDraft({ volume })} min={0} max={2} />
          </div>
          <div>
            <Label hint={`${draft.rate.toFixed(2)}×`}>Speed</Label>
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
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4">
          <div>
            <Label>Shortcut on this page</Label>
            <HotkeyInput value={draft.hotkey} onChange={(hotkey) => setDraft({ hotkey })} conflict={conflict} placeholder="None" />
          </div>
          <div>
            <Label>Pressing it again while playing</Label>
            <Segmented<PlayMode>
              value={draft.mode}
              onChange={(mode) => setDraft({ mode })}
              options={[
                { value: 'restart', label: 'Restarts' },
                { value: 'overlap', label: 'Overlaps' },
                { value: 'toggle', label: 'Stops' },
              ]}
            />
          </div>
          <Toggle title="Loop" hint="Repeat until stopped" checked={draft.loop} onChange={(loop) => setDraft({ loop })} />
          <Toggle title="Hear it yourself" hint="Also play on your headphones" checked={draft.localPlayback} onChange={(localPlayback) => setDraft({ localPlayback })} />
        </div>

        <div className="flex items-center gap-2 border-t border-line pt-4">
          <Button variant="danger" onClick={() => deleteSound(draft.id)}>Delete</Button>
          <Button variant="ghost" onClick={exportWav}>Export WAV</Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </div>
      </div>
    </Dialog>
  )
}
