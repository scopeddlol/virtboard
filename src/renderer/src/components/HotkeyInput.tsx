import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
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
            'min-w-[18px] rounded border border-line px-1 text-center text-[10.5px] leading-4',
            dim ? 'text-zinc-500' : 'bg-white/[0.04] text-zinc-300',
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
          'flex h-8 min-w-[140px] flex-1 cursor-pointer items-center gap-2 rounded-md border bg-panel px-2.5 text-[13px] outline-none transition-colors',
          capturing ? 'border-accent text-zinc-100' : 'border-line text-zinc-300 hover:border-white/15',
        )}
      >
        {capturing ? (
          <span className="text-zinc-400">Press keys… (Esc to cancel)</span>
        ) : value ? (
          <Kbd accel={value} />
        ) : (
          <span className="text-zinc-500">{placeholder}</span>
        )}
      </button>
      {warning && (
        <Tip label={<span className="block max-w-60">{warning}</span>}>
          <AlertTriangle size={14} className={failed || conflict ? 'text-amber-400' : 'text-zinc-500'} />
        </Tip>
      )}
      {value && !capturing && (
        <Tip label="Clear">
          <button onClick={() => onChange('')} className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
            <X size={14} />
          </button>
        </Tip>
      )}
    </div>
  )
}
