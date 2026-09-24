import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { EMOJIS, PALETTE } from '@/lib/defaults'
import { cn } from './ui'

export function EmojiPicker({ value, onChange, color }: { value: string; onChange: (e: string) => void; color?: string }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/10 text-2xl transition-transform hover:scale-105"
          style={{ background: `linear-gradient(145deg, color-mix(in oklab, ${color ?? 'var(--accent)'} 45%, transparent), color-mix(in oklab, ${color ?? 'var(--accent)'} 12%, transparent))` }}
        >
          {value}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content sideOffset={8} align="start" className="z-[60] grid w-[312px] grid-cols-8 gap-1 rounded-2xl border border-white/10 bg-ink-800/95 p-2 shadow-2xl backdrop-blur-xl">
          {EMOJIS.map((e) => (
            <Dropdown.Item
              key={e}
              onSelect={() => onChange(e)}
              className={cn(
                'grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-lg outline-none data-[highlighted]:bg-white/10',
                e === value && 'bg-accent/25',
              )}
            >
              {e}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={c}
          className={cn(
            'h-7 w-7 cursor-pointer rounded-full border-2 transition-transform hover:scale-110',
            c === value ? 'scale-110 border-white' : 'border-transparent',
          )}
          style={{ background: c, boxShadow: c === value ? `0 0 14px ${c}` : undefined }}
        />
      ))}
    </div>
  )
}
