import * as CM from '@radix-ui/react-context-menu'
import { memo, useEffect, useRef, useSyncExternalStore } from 'react'
import { motion } from 'motion/react'
import { ArrowRightLeft, Copy, Headphones, Pencil, Play, Repeat, Scissors, Trash2 } from 'lucide-react'
import type { Sound } from '@shared/types'
import { engine } from '@/audio/engine'
import { useStore } from '@/state/store'
import { Kbd } from './HotkeyInput'
import { cn, Tip } from './ui'

export function usePlaying(id: string) {
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.isPlaying(id),
  )
}

const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)}s`)

function MiniWave({ sound, playing }: { sound: Sound; playing: boolean }) {
  const fill = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!playing) {
      if (fill.current) fill.current.style.clipPath = 'inset(0 100% 0 0)'
      return
    }
    let raf = 0
    const tick = () => {
      const p = engine.progress(sound.id)
      if (fill.current) fill.current.style.clipPath = `inset(0 ${100 - Math.max(0, p) * 100}% 0 0)`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [playing, sound.id])

  // Only draw the trimmed part of the waveform.
  const n = sound.peaks.length
  const a = sound.duration ? Math.floor((sound.trimStart / sound.duration) * n) : 0
  const b = sound.duration && sound.trimEnd != null ? Math.ceil((sound.trimEnd / sound.duration) * n) : n
  const peaks = sound.peaks.slice(a, Math.max(a + 1, b))
  const bars = (color: string) => (
    <div className="absolute inset-0 flex items-center gap-[2px]">
      {peaks.map((p, i) => (
        <span key={i} className="flex-1 rounded-full" style={{ height: `${Math.max(8, p * 100)}%`, background: color }} />
      ))}
    </div>
  )
  return (
    <div className="relative h-7 w-full">
      {bars('rgb(255 255 255 / 0.14)')}
      <div ref={fill} className="absolute inset-0" style={{ clipPath: 'inset(0 100% 0 0)' }}>
        {bars(sound.color)}
      </div>
    </div>
  )
}

export const SoundPad = memo(function SoundPad({ sound, index }: { sound: Sound; index: number }) {
  const playing = usePlaying(sound.id)
  const pages = useStore((s) => s.pages)
  const editSound = useStore((s) => s.editSound)
  const deleteSound = useStore((s) => s.deleteSound)
  const copyToPage = useStore((s) => s.copySoundToPage)
  const moveSound = useStore((s) => s.moveSound)
  const failed = useStore((s) => !!sound.hotkey && s.failedHotkeys.includes(sound.hotkey))
  const others = pages.filter((p) => p.id !== sound.pageId)
  const len = ((sound.trimEnd ?? sound.duration) - sound.trimStart) / (sound.rate || 1)

  const item = 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-zinc-200 outline-none data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-white'
  const content = 'z-50 min-w-[200px] rounded-xl border border-white/10 bg-ink-800/95 p-1 shadow-2xl backdrop-blur-xl'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, delay: Math.min(index, 20) * 0.02 }}
    >
    <CM.Root>
      <CM.Trigger asChild>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-virtboard-sound', sound.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/x-virtboard-sound')) e.preventDefault()
          }}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('application/x-virtboard-sound')
            if (id && id !== sound.id) {
              e.preventDefault()
              e.stopPropagation()
              moveSound(id, index)
            }
          }}
          onClick={() => engine.play(sound)}
          style={{ '--ring': sound.color } as React.CSSProperties}
          className={cn(
            'group relative flex h-[148px] cursor-pointer flex-col overflow-hidden rounded-2xl p-3.5 transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.97]',
            playing ? 'pulse-ring' : 'hover:-translate-y-0.5',
          )}
        >
          <div
            className="absolute inset-0 -z-10 transition-opacity duration-300"
            style={{
              background: `radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, ${sound.color} ${playing ? 38 : 20}%, transparent), transparent 65%), linear-gradient(180deg, rgb(255 255 255 / 0.05), rgb(255 255 255 / 0.015))`,
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl border transition-colors"
            style={{ borderColor: `color-mix(in oklab, ${sound.color} ${playing ? 70 : 22}%, transparent)` }}
          />

          <div className="flex items-start justify-between gap-2">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl text-[21px] shadow-lg"
              style={{ background: `linear-gradient(145deg, color-mix(in oklab, ${sound.color} 55%, transparent), color-mix(in oklab, ${sound.color} 18%, transparent))` }}
            >
              {sound.emoji}
            </span>
            <div className="flex flex-col items-end gap-1">
              {sound.hotkey ? (
                <span className={cn(failed && 'opacity-50 line-through')}>
                  <Kbd accel={sound.hotkey} />
                </span>
              ) : (
                <span className="text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">no key</span>
              )}
              <div className="flex gap-1">
                {sound.loop && <Repeat size={11} className="text-zinc-400" />}
                {!sound.localPlayback && <Headphones size={11} className="text-zinc-600 line-through" />}
              </div>
            </div>
          </div>

          <div className="mt-2 line-clamp-2 min-h-0 flex-1 text-[13.5px] font-semibold leading-snug text-white">{sound.name}</div>

          <div className="flex items-end gap-2.5">
            <MiniWave sound={sound} playing={playing} />
            <span className="shrink-0 pb-1 font-mono text-[10px] tabular-nums text-zinc-400">{fmt(len)}</span>
          </div>

          <div className="absolute right-2 top-14 flex translate-x-2 flex-col gap-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
            <Tip label="Edit & trim" side="left">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  editSound(sound.id)
                }}
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-black/50 text-zinc-200 backdrop-blur hover:bg-black/70 hover:text-white"
              >
                <Scissors size={13} />
              </button>
            </Tip>
            <Tip label="Preview on headphones only" side="left">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  engine.play(sound, { localOnly: true })
                }}
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg bg-black/50 text-zinc-200 backdrop-blur hover:bg-black/70 hover:text-white"
              >
                <Headphones size={13} />
              </button>
            </Tip>
          </div>
        </div>
      </CM.Trigger>
      <CM.Portal>
        <CM.Content className={content}>
          <CM.Item className={item} onSelect={() => engine.play(sound)}><Play size={14} /> Play</CM.Item>
          <CM.Item className={item} onSelect={() => engine.play(sound, { localOnly: true })}><Headphones size={14} /> Preview locally</CM.Item>
          <CM.Item className={item} onSelect={() => editSound(sound.id)}><Pencil size={14} /> Edit, trim & keybind</CM.Item>
          <CM.Separator className="my-1 h-px bg-white/[0.07]" />
          <CM.Sub>
            <CM.SubTrigger className={item} disabled={!others.length}><Copy size={14} /> Copy to page</CM.SubTrigger>
            <CM.Portal>
              <CM.SubContent className={content} sideOffset={6}>
                {others.map((p) => (
                  <CM.Item key={p.id} className={item} onSelect={() => copyToPage(sound.id, p.id, false)}>{p.emoji} {p.name}</CM.Item>
                ))}
              </CM.SubContent>
            </CM.Portal>
          </CM.Sub>
          <CM.Sub>
            <CM.SubTrigger className={item} disabled={!others.length}><ArrowRightLeft size={14} /> Move to page</CM.SubTrigger>
            <CM.Portal>
              <CM.SubContent className={content} sideOffset={6}>
                {others.map((p) => (
                  <CM.Item key={p.id} className={item} onSelect={() => copyToPage(sound.id, p.id, true)}>{p.emoji} {p.name}</CM.Item>
                ))}
              </CM.SubContent>
            </CM.Portal>
          </CM.Sub>
          <CM.Separator className="my-1 h-px bg-white/[0.07]" />
          <CM.Item className={cn(item, 'text-red-300 data-[highlighted]:bg-red-500/15 data-[highlighted]:text-red-200')} onSelect={() => deleteSound(sound.id)}>
            <Trash2 size={14} /> Delete
          </CM.Item>
        </CM.Content>
      </CM.Portal>
    </CM.Root>
    </motion.div>
  )
})
