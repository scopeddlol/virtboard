import { AudioLines, LayoutGrid, Plus, Settings2 } from 'lucide-react'
import { useStore, type View } from '@/state/store'
import { isVirtualOutput } from '@/lib/devices'
import { cn } from './ui'

const NAV: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'board', label: 'Soundboard', icon: LayoutGrid },
  { id: 'voice', label: 'Voice changer', icon: AudioLines },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

export function Sidebar() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const pages = useStore((s) => s.pages)
  const sounds = useStore((s) => s.sounds)
  const activePageId = useStore((s) => s.activePageId)
  const setActivePage = useStore((s) => s.setActivePage)
  const addPage = useStore((s) => s.addPage)
  const virtualLabel = useStore((s) => s.settings.virtualDeviceLabel)
  const virtualId = useStore((s) => s.settings.virtualDeviceId)
  const cableOk = !!virtualId && isVirtualOutput(virtualLabel)

  const item = (active: boolean) =>
    cn(
      'flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors',
      active ? 'bg-white/[0.07] text-zinc-100' : 'text-zinc-400 hover:bg-white/[0.035] hover:text-zinc-200',
    )

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-base">
      <nav className="space-y-0.5 p-2">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setView(n.id)} className={item(view === n.id)}>
            <n.icon size={15} className={view === n.id ? 'text-accent' : ''} />
            {n.label}
          </button>
        ))}
      </nav>

      <div className="mt-3 flex items-center justify-between px-4 pb-1">
        <span className="text-[11px] font-medium text-zinc-500">Pages</span>
        <button onClick={addPage} title="New page" className="cursor-pointer rounded p-0.5 text-zinc-500 hover:text-zinc-200">
          <Plus size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {pages.map((p) => {
          const active = p.id === activePageId && view === 'board'
          const count = sounds.filter((s) => s.pageId === p.id).length
          return (
            <button
              key={p.id}
              onClick={() => {
                setActivePage(p.id)
                setView('board')
              }}
              className={item(active)}
              title={p.hotkey ? `Switch with ${p.hotkey}` : undefined}
            >
              <span className="w-4 text-center">{p.emoji}</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-[11px] tabular-nums text-zinc-600">{count}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => setView('settings')}
        className="flex cursor-pointer items-center gap-2 border-t border-line px-4 py-3 text-left text-[12px] text-zinc-400 hover:text-zinc-200"
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', cableOk ? 'bg-emerald-500' : 'bg-amber-500')} />
        {cableOk ? 'Virtual mic connected' : 'Virtual mic not set up'}
      </button>
    </aside>
  )
}
