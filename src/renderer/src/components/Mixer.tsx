import { useEffect, useRef } from 'react'
import { Headphones, Mic, MicOff, Music2, Square } from 'lucide-react'
import { engine } from '@/audio/engine'
import { useStore } from '@/state/store'
import { Kbd } from './HotkeyInput'
import { cn, Slider, Tip } from './ui'

/** Smooth peak meter driven straight from an AnalyserNode (no React re-renders). */
export function Meter({ source, className, color = 'var(--accent)' }: { source: 'mic' | 'sounds'; className?: string; color?: string }) {
  const bar = useRef<HTMLDivElement>(null)
  const peak = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const buf = new Float32Array(512)
    let raf = 0
    let level = 0
    let hold = 0
    let holdT = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) return
      const a = source === 'mic' ? engine.micAnalyser : engine.soundsAnalyser
      const raw = engine.level(a, buf)
      const db = raw > 0 ? 20 * Math.log10(raw) : -90
      const v = Math.max(0, Math.min(1, (db + 60) / 60))
      level = v > level ? v : level * 0.9 + v * 0.1
      if (v >= hold) {
        hold = v
        holdT = 40
      } else if (--holdT < 0) hold = Math.max(0, hold - 0.015)
      if (bar.current) bar.current.style.transform = `scaleX(${level})`
      if (peak.current) peak.current.style.left = `calc(${hold * 100}% - 2px)`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [source])
  return (
    <div className={cn('relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]', className)}>
      <div
        ref={bar}
        className="absolute inset-0 origin-left rounded-full"
        style={{ transform: 'scaleX(0)', background: `linear-gradient(90deg, ${color} 0%, ${color} 65%, #facc15 85%, #ef4444 100%)` }}
      />
      <div ref={peak} className="absolute top-0 h-full w-[3px] rounded-full bg-white/80" style={{ left: '-4px' }} />
    </div>
  )
}

function Channel({
  icon, title, value, onChange, meter, children, className,
}: {
  icon: React.ReactNode; title: string; value: number; onChange: (v: number) => void
  meter?: 'mic' | 'sounds'; children?: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-3', className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11.5px] font-medium text-zinc-300">{title}</span>
          <span className="font-mono text-[10.5px] tabular-nums text-zinc-500">{Math.round(value * 100)}%</span>
        </div>
        <Slider value={value} onChange={onChange} min={0} max={2} step={0.01} />
        {meter && <Meter source={meter} className="mt-1.5" />}
      </div>
      {children}
    </div>
  )
}

export function Mixer() {
  const s = useStore((st) => st.settings)
  const setSettings = useStore((st) => st.setSettings)
  const toggleMic = useStore((st) => st.toggleMic)

  return (
    <footer className="relative z-20 flex h-[84px] shrink-0 items-center gap-6 border-t border-white/[0.05] bg-ink-950/70 px-5 backdrop-blur-xl">
      <Channel
        title="Microphone"
        value={s.micVolume}
        onChange={(v) => setSettings({ micVolume: v })}
        meter="mic"
        icon={
          <Tip label={<span className="flex items-center gap-2">{s.micMuted ? 'Unmute' : 'Mute'} <Kbd accel={s.hotkeys.toggleMic} /></span>}>
            <button
              onClick={toggleMic}
              className={cn(
                'grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border transition-all',
                s.micMuted
                  ? 'border-red-500/40 bg-red-500/15 text-red-300 shadow-[0_0_20px_-6px_rgb(239_68_68)]'
                  : 'border-white/[0.08] bg-white/[0.05] text-zinc-100 hover:bg-white/[0.09]',
              )}
            >
              {s.micMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          </Tip>
        }
      />
      <div className="h-10 w-px bg-white/[0.06]" />
      <Channel
        title="Sounds"
        value={s.soundsVolume}
        onChange={(v) => setSettings({ soundsVolume: v })}
        meter="sounds"
        icon={
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-zinc-100">
            <Music2 size={18} />
          </span>
        }
      />
      <div className="h-10 w-px bg-white/[0.06]" />
      <Channel
        title="Monitor (your headphones)"
        value={s.monitorVolume}
        onChange={(v) => setSettings({ monitorVolume: v })}
        icon={
          <Tip label={s.monitorSounds ? 'Stop hearing sounds yourself' : 'Hear sounds on your headphones'}>
            <button
              onClick={() => setSettings({ monitorSounds: !s.monitorSounds })}
              className={cn(
                'grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border transition-all',
                s.monitorSounds ? 'border-accent/40 bg-accent/15 text-white' : 'border-white/[0.08] bg-white/[0.05] text-zinc-500',
              )}
            >
              <Headphones size={18} />
            </button>
          </Tip>
        }
      />
      <Tip label={<span className="flex items-center gap-2">Stop all sounds <Kbd accel={s.hotkeys.stopAll} /></span>}>
        <button
          onClick={() => engine.stop()}
          className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-red-500/25 bg-gradient-to-b from-red-500/20 to-red-500/10 px-4 text-[13px] font-semibold text-red-200 transition-all hover:from-red-500/30 hover:shadow-[0_0_24px_-6px_rgb(239_68_68)] active:scale-95"
        >
          <Square size={14} fill="currentColor" /> Stop all
        </button>
      </Tip>
    </footer>
  )
}
