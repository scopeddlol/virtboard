import { motion } from 'motion/react'
import { AudioLines, Cable, CheckCircle2, LayoutGrid, Plus, Settings2, WandSparkles } from 'lucide-react'
import { useStore, type View } from '@/state/store'
import { isVirtualOutput } from '@/lib/devices'
import { Kbd } from './HotkeyInput'
import { cn, Tip } from './ui'

const NAV: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'board', label: 'Soundboard', icon: LayoutGrid },
  { id: 'voice', label: 'Voice Changer', icon: WandSparkles },
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

  return (
    <aside className="flex w-[244px] shrink-0 flex-col border-r border-white/[0.05] bg-ink-950/40 backdrop-blur-xl">
      <nav className="flex flex-col gap-1 p-3">
        {NAV.map((n) => {
          const active = view === n.id
          return (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={cn(
                'relative flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors',
                active ? 'text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-white/[0.08] bg-gradient-to-r from-accent/25 to-accent/5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <n.icon size={17} className={cn('relative', active && 'text-accent')} />
              <span className="relative">{n.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mx-3 mb-2 mt-3 flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Sound pages</span>
        <Tip label="New page">
          <button onClick={addPage} className="cursor-pointer rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-white">
            <Plus size={15} />
          </button>
        </Tip>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {pages.map((p) => {
          const active = p.id === activePageId
          const count = sounds.filter((s) => s.pageId === p.id).length
          return (
            <button
              key={p.id}
              onClick={() => {
                setActivePage(p.id)
                setView('board')
              }}
              className={cn(
                'group relative flex h-12 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-left transition-colors',
                active ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/[0.035] hover:text-zinc-100',
              )}
            >
              {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />}
              <span className={cn('grid h-7 w-7 place-items-center rounded-lg text-[15px]', active ? 'bg-accent/20' : 'bg-white/[0.04]')}>{p.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{p.name}</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap text-[10.5px] text-zinc-500">
                  {count} sound{count === 1 ? '' : 's'}
                  {p.hotkey && <Kbd accel={p.hotkey} dim className="scale-90 origin-left" />}
                </span>
              </span>
            </button>
          )
        })}
        <button
          onClick={addPage}
          className="mt-1 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 text-[12.5px] text-zinc-500 transition-colors hover:border-accent/50 hover:text-zinc-200"
        >
          <Plus size={14} /> Add page
        </button>
      </div>

      <button
        onClick={() => setView('settings')}
        className={cn(
          'mx-3 mb-3 flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors',
          cableOk ? 'border-emerald-500/20 bg-emerald-500/[0.06] hover:bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/[0.07] hover:bg-amber-500/10',
        )}
      >
        <span className={cn('grid h-8 w-8 place-items-center rounded-lg', cableOk ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
          {cableOk ? <CheckCircle2 size={16} /> : <Cable size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-zinc-100">{cableOk ? 'Virtual mic ready' : 'Set up virtual mic'}</span>
          <span className="block truncate text-[10.5px] text-zinc-400">
            {cableOk ? virtualLabel.replace(/\s*\(.*\)$/, '') : 'Route sounds into Discord & games'}
          </span>
        </span>
        <AudioLines size={14} className="text-zinc-500" />
      </button>
    </aside>
  )
}
