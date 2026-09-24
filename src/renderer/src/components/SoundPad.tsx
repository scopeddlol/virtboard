import * as CM from '@radix-ui/react-context-menu'
import { memo, useEffect, useRef, useSyncExternalStore } from 'react'
import { Pencil, Repeat } from 'lucide-react'
import type { Sound } from '@shared/types'
import { engine } from '@/audio/engine'
import { useStore } from '@/state/store'
import { Kbd } from './HotkeyInput'
import { cn } from './ui'

export function usePlaying(id: string) {
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.isPlaying(id),
  )
}

const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)}s`)

function Progress({ id, playing }: { id: string; playing: boolean }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0, engine.progress(id))})`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [playing, id])
  if (!playing) return null
  return (
    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/5">
      <div ref={bar} className="h-full origin-left bg-accent" style={{ transform: 'scaleX(0)' }} />
    </div>
  )
}

const item = 'flex cursor-pointer items-center rounded px-2.5 py-1.5 text-[13px] text-zinc-300 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-white/[0.07] data-[highlighted]:text-zinc-100'
const menu = 'z-50 min-w-[180px] rounded-md border border-line bg-raised p-1 shadow-xl'

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

  return (
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
          data-playing={playing || undefined}
          className={cn(
            'group relative flex h-[88px] cursor-pointer flex-col justify-between overflow-hidden rounded-lg border bg-panel p-3 transition-colors active:bg-raised',
            playing ? 'border-accent/60' : 'border-line hover:border-white/15',
          )}
        >
          <div className="flex items-start gap-2">
            <span className="text-base leading-5">{sound.emoji}</span>
            <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-5 text-zinc-100">{sound.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                editSound(sound.id)
              }}
              title="Edit"
              className="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded text-zinc-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-zinc-200 group-hover:opacity-100"
            >
              <Pencil size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            {sound.hotkey ? (
              <span className={cn(failed && 'line-through opacity-60')} title={failed ? 'Shortcut is in use by another app' : undefined}>
                <Kbd accel={sound.hotkey} />
              </span>
            ) : (
              <span className="text-zinc-600">No key</span>
            )}
            {sound.loop && <Repeat size={11} />}
            <span className="ml-auto tabular-nums">{fmt(len)}</span>
          </div>
          <Progress id={sound.id} playing={playing} />
        </div>
      </CM.Trigger>
      <CM.Portal>
        <CM.Content className={menu}>
          <CM.Item className={item} onSelect={() => engine.play(sound)}>Play</CM.Item>
          <CM.Item className={item} onSelect={() => engine.play(sound, { localOnly: true })}>Preview (only me)</CM.Item>
          <CM.Item className={item} onSelect={() => editSound(sound.id)}>Edit…</CM.Item>
          <CM.Separator className="my-1 h-px bg-line" />
          <CM.Sub>
            <CM.SubTrigger className={item} disabled={!others.length}>Copy to page</CM.SubTrigger>
            <CM.Portal>
              <CM.SubContent className={menu} sideOffset={4}>
                {others.map((p) => (
                  <CM.Item key={p.id} className={item} onSelect={() => copyToPage(sound.id, p.id, false)}>{p.emoji} {p.name}</CM.Item>
                ))}
              </CM.SubContent>
            </CM.Portal>
          </CM.Sub>
          <CM.Sub>
            <CM.SubTrigger className={item} disabled={!others.length}>Move to page</CM.SubTrigger>
            <CM.Portal>
              <CM.SubContent className={menu} sideOffset={4}>
                {others.map((p) => (
                  <CM.Item key={p.id} className={item} onSelect={() => copyToPage(sound.id, p.id, true)}>{p.emoji} {p.name}</CM.Item>
                ))}
              </CM.SubContent>
            </CM.Portal>
          </CM.Sub>
          <CM.Separator className="my-1 h-px bg-line" />
          <CM.Item className={item.replace('text-zinc-300', 'text-red-400').replace('data-[highlighted]:text-zinc-100', 'data-[highlighted]:text-red-300')} onSelect={() => deleteSound(sound.id)}>Delete</CM.Item>
        </CM.Content>
      </CM.Portal>
    </CM.Root>
  )
})
