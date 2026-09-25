import { useEffect, useState } from 'react'
import { Copy, Minus, Square, X, ZoomIn, ZoomOut } from 'lucide-react'
import { api } from '@/lib/api'
import { useStore } from '@/state/store'
import { cn } from './ui'

function WinButton({ onClick, label, children, danger }: { onClick: () => void; label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'no-drag grid h-9 w-11 cursor-pointer place-items-center text-zinc-400 transition-colors',
        danger ? 'hover:bg-red-600 hover:text-white' : 'hover:bg-white/[0.07] hover:text-zinc-100',
      )}
    >
      {children}
    </button>
  )
}

export function TitleBar() {
  const [max, setMax] = useState(false)
  const zoom = useStore((s) => s.settings.zoomFactor)
  const setSettings = useStore((s) => s.setSettings)
  const closeToTray = useStore((s) => s.settings.closeToTray)

  useEffect(() => {
    api.window.isMaximized().then(setMax)
    return api.window.onMaximizedChange(setMax)
  }, [])

  return (
    <header
      className="drag flex h-9 shrink-0 items-center border-b border-line bg-base pl-3"
      onDoubleClick={() => api.window.toggleMaximize()}
    >
      <img src="./logo.svg" alt="" className="h-4 w-4" draggable={false} />
      <span className="ml-2 text-[12.5px] font-medium text-zinc-400">Virtboard</span>
      <div className="flex-1" />
      <div className="no-drag flex items-center" onDoubleClick={(e) => e.stopPropagation()}>
        <WinButton label="Zoom out (Ctrl+-)" onClick={() => setSettings({ zoomFactor: Math.max(0.5, Math.round((zoom - 0.1) * 100) / 100) })}><ZoomOut size={14} /></WinButton>
        <button className="w-12 cursor-pointer text-[11px] text-zinc-400" aria-label="Reset zoom (Ctrl+0)" title="Reset zoom (Ctrl+0)" onClick={() => setSettings({ zoomFactor: 1 })}>{Math.round(zoom * 100)}%</button>
        <WinButton label="Zoom in (Ctrl++)" onClick={() => setSettings({ zoomFactor: Math.min(1.5, Math.round((zoom + 0.1) * 100) / 100) })}><ZoomIn size={14} /></WinButton>
      </div>
      <WinButton label="Minimize" onClick={() => api.window.minimize()}>
        <Minus size={15} />
      </WinButton>
      <WinButton label={max ? 'Restore' : 'Fullscreen'} onClick={() => api.window.toggleMaximize()}>
        {max ? <Copy size={12} className="-scale-x-100" /> : <Square size={12} />}
      </WinButton>
      <WinButton label={closeToTray ? 'Close to tray' : 'Exit'} onClick={() => api.window.close()} danger>
        <X size={16} />
      </WinButton>
    </header>
  )
}
