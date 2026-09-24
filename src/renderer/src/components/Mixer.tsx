import { useEffect, useRef } from 'react'
import { Headphones, Mic, MicOff, Music2, Square } from 'lucide-react'
import { engine } from '@/audio/engine'
import { useStore } from '@/state/store'
import { cn, Slider, Tip } from './ui'

/** Level meter driven straight from an AnalyserNode (no React re-renders). */
export function Meter({ source, className }: { source: 'mic' | 'sounds'; className?: string }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const buf = new Float32Array(512)
    let raf = 0
    let level = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) return
      const raw = engine.level(source === 'mic' ? engine.micAnalyser : engine.soundsAnalyser, buf)
      const db = raw > 0 ? 20 * Math.log10(raw) : -90
      const v = Math.max(0, Math.min(1, (db + 60) / 60))
      level = v > level ? v : level * 0.9 + v * 0.1
      if (bar.current) bar.current.style.transform = `scaleX(${level})`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [source])
  return (
    <div className={cn('relative h-1 overflow-hidden rounded-full bg-white/[0.06]', className)}>
      <div ref={bar} className="absolute inset-0 origin-left bg-emerald-500/80" style={{ transform: 'scaleX(0)' }} />
    </div>
  )
}

function Channel({
  icon, title, value, onChange, meter,
}: { icon: React.ReactNode; title: string; value: number; onChange: (v: number) => void; meter?: 'mic' | 'sounds' }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex justify-between text-[11.5px]">
          <span className="text-zinc-400">{title}</span>
          <span className="tabular-nums text-zinc-600">{Math.round(value * 100)}%</span>
        </div>
        <Slider value={value} onChange={onChange} min={0} max={2} />
        <Meter source={meter ?? 'sounds'} className={cn('mt-1', !meter && 'invisible')} />
      </div>
    </div>
  )
}

const iconBtn = (on: boolean, warn?: boolean) =>
  cn(
    'grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md transition-colors',
    warn ? 'bg-red-500/15 text-red-400' : on ? 'text-zinc-200 hover:bg-white/[0.06]' : 'text-zinc-600 hover:bg-white/[0.06]',
  )

export function Mixer() {
  const s = useStore((st) => st.settings)
  const setSettings = useStore((st) => st.setSettings)
  const toggleMic = useStore((st) => st.toggleMic)

  return (
    <footer className="flex h-16 shrink-0 items-center gap-6 border-t border-line bg-base px-4">
      <Channel
        title={s.micMuted ? 'Microphone (muted)' : 'Microphone'}
        value={s.micVolume}
        onChange={(v) => setSettings({ micVolume: v })}
        meter="mic"
        icon={
          <Tip label={s.micMuted ? 'Unmute' : 'Mute'}>
            <button onClick={toggleMic} className={iconBtn(true, s.micMuted)}>
              {s.micMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </Tip>
        }
      />
      <Channel
        title="Sounds"
        value={s.soundsVolume}
        onChange={(v) => setSettings({ soundsVolume: v })}
        meter="sounds"
        icon={<span className={iconBtn(true)}><Music2 size={16} /></span>}
      />
      <Channel
        title={s.monitorSounds ? 'Your headphones' : 'Your headphones (off)'}
        value={s.monitorVolume}
        onChange={(v) => setSettings({ monitorVolume: v })}
        icon={
          <Tip label={s.monitorSounds ? 'Stop hearing sounds yourself' : 'Hear sounds yourself'}>
            <button onClick={() => setSettings({ monitorSounds: !s.monitorSounds })} className={iconBtn(s.monitorSounds)}>
              <Headphones size={16} />
            </button>
          </Tip>
        }
      />
      <button
        onClick={() => engine.stop()}
        className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-[12.5px] text-zinc-300 transition-colors hover:bg-white/[0.05]"
      >
        <Square size={11} fill="currentColor" /> Stop all
      </button>
    </footer>
  )
}
