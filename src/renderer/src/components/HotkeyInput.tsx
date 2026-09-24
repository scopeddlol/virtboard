import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Keyboard, X } from 'lucide-react'
import { blocksTyping, eventToAccelerator, prettyParts } from '@/lib/hotkeys'
import { api } from '@/lib/api'
import { useStore } from '@/state/store'
import { cn, Tip } from './ui'

export function Kbd({ accel, className, dim }: { accel: string; className?: string; dim?: boolean }) {
  const parts = prettyParts(accel)
  if (!parts.length) return null
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {parts.map((p, i) => (
        <kbd
          key={i}
          className={cn(
            'min-w-[20px] rounded-md border px-1.5 py-[1px] text-center font-mono text-[10.5px] font-semibold leading-4 shadow-[inset_0_-1px_0_rgb(0_0_0/0.4)]',
            dim ? 'border-white/10 bg-white/[0.05] text-zinc-300' : 'border-white/15 bg-black/35 text-white',
          )}
        >
          {p}
        </kbd>
      ))}
    </span>
  )
}

/** Click, then press a key combo. Esc cancels, Backspace/Delete clears. */
export function HotkeyInput({
  value, onChange, conflict, placeholder = 'Click to bind', className,
}: { value: string; onChange: (v: string) => void; conflict?: string | null; placeholder?: string; className?: string }) {
  const [capturing, setCapturing] = useState(false)
  const failed = useStore((s) => s.failedHotkeys.includes(value))
  const setGlobalCapturing = useStore((s) => s.setCapturing)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!capturing) return
    api.setHotkeysPaused(true)
    setGlobalCapturing(true)
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) return setCapturing(false)
      if ((e.code === 'Backspace' || e.code === 'Delete') && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        onChangeRef.current('')
        return setCapturing(false)
      }
      const accel = eventToAccelerator(e)
      if (accel) {
        onChangeRef.current(accel)
        setCapturing(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      api.setHotkeysPaused(false)
      setGlobalCapturing(false)
    }
  }, [capturing, setGlobalCapturing])

  const warning = failed
    ? 'Another app already uses this shortcut'
    : conflict
      ? conflict
      : value && blocksTyping(value)
        ? 'Single keys block typing that key in other apps — consider adding a modifier or using the numpad'
        : null

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={() => setCapturing((c) => !c)}
        onBlur={() => setCapturing(false)}
        className={cn(
          'group flex h-10 min-w-[150px] flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13px] outline-none transition-all',
          capturing
            ? 'border-accent bg-accent/10 text-white shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_20%,transparent)]'
            : 'border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:border-white/15',
        )}
      >
        <Keyboard size={15} className={capturing ? 'text-accent' : 'text-zinc-500'} />
        {capturing ? (
          <span className="animate-pulse text-accent">Press a key combo…</span>
        ) : value ? (
          <Kbd accel={value} />
        ) : (
          <span className="text-zinc-500">{placeholder}</span>
        )}
      </button>
      {warning && (
        <Tip label={<span className="block max-w-60">{warning}</span>}>
          <AlertTriangle size={16} className={failed || conflict ? 'text-amber-400' : 'text-zinc-500'} />
        </Tip>
      )}
      {value && !capturing && (
        <Tip label="Clear">
          <button onClick={() => onChange('')} className="cursor-pointer rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
            <X size={14} />
          </button>
        </Tip>
      )}
    </div>
  )
}
