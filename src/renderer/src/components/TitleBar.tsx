import { useEffect, useState } from 'react'
import { Maximize2, Minimize2, Minus, X, Mic, MicOff, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { activePreset, useStore } from '@/state/store'
import { cn, Tip } from './ui'

function WinButton({ onClick, label, children, danger }: { onClick: () => void; label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <Tip label={label} side="bottom">
      <button
        onClick={onClick}
        aria-label={label}
        className={cn(
          'no-drag group grid h-8 w-11 cursor-pointer place-items-center rounded-lg text-zinc-400 transition-all duration-150',
          danger ? 'hover:bg-red-500 hover:text-white hover:shadow-[0_0_18px_-2px_rgb(239_68_68/0.8)]' : 'hover:bg-white/[0.08] hover:text-white',
        )}
      >
        {children}
      </button>
    </Tip>
  )
}

export function TitleBar() {
  const [max, setMax] = useState(false)
  const muted = useStore((s) => s.settings.micMuted)
  const voiceOn = useStore((s) => s.settings.voiceEnabled)
  const preset = useStore(activePreset)
  const toggleMic = useStore((s) => s.toggleMic)
  const toggleVoice = useStore((s) => s.toggleVoice)
  const closeToTray = useStore((s) => s.settings.closeToTray)

  useEffect(() => {
    api.window.isMaximized().then(setMax)
    return api.window.onMaximizedChange(setMax)
  }, [])

  return (
    <header className="drag relative z-30 flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.05] bg-ink-950/60 pl-3.5 pr-1.5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5" onDoubleClick={() => api.window.toggleMaximize()}>
        <img src="./logo.svg" alt="" className="h-6 w-6 drop-shadow-[0_2px_8px_rgb(139_92_246/0.5)]" draggable={false} />
        <span className="font-display text-[14px] font-semibold tracking-tight text-white">Virtboard</span>
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-px font-mono text-[10px] text-zinc-400">v0.1</span>
      </div>

      <div className="flex flex-1 items-center justify-center gap-2" onDoubleClick={() => api.window.toggleMaximize()}>
        <button
          onClick={toggleMic}
          className={cn(
            'no-drag flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
            muted ? 'border-red-500/30 bg-red-500/15 text-red-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
          )}
        >
          {muted ? <MicOff size={12} /> : <Mic size={12} />}
          {muted ? 'Mic muted' : 'Mic live'}
          {!muted && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52_211_153)]" />}
        </button>
        <button
          onClick={toggleVoice}
          className={cn(
            'no-drag flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
            voiceOn ? 'border-accent/40 bg-accent/15 text-white' : 'border-white/10 bg-white/[0.04] text-zinc-400',
          )}
        >
          <Sparkles size={12} className={voiceOn ? 'text-accent' : ''} />
          {voiceOn ? `${preset?.emoji} ${preset?.name}` : 'Voice changer off'}
        </button>
      </div>

      <div className="flex items-center gap-0.5">
        <WinButton label="Minimize" onClick={() => api.window.minimize()}>
          <Minus size={16} strokeWidth={2.2} />
        </WinButton>
        <WinButton label={max ? 'Restore' : 'Fullscreen'} onClick={() => api.window.toggleMaximize()}>
          {max ? <Minimize2 size={14} strokeWidth={2.2} /> : <Maximize2 size={14} strokeWidth={2.2} />}
        </WinButton>
        <WinButton label={closeToTray ? 'Close to tray' : 'Exit'} onClick={() => api.window.close()} danger>
          <X size={17} strokeWidth={2.2} />
        </WinButton>
      </div>
    </header>
  )
}
