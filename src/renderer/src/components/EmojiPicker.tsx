import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { EMOJIS } from '@/lib/defaults'
import { cn } from './ui'

export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button title="Choose icon" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border border-line bg-panel text-base hover:border-white/15">
          {value}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content sideOffset={4} align="start" className="z-[60] grid w-[292px] grid-cols-8 gap-0.5 rounded-md border border-line bg-raised p-1.5 shadow-xl">
          {EMOJIS.map((e) => (
            <Dropdown.Item
              key={e}
              onSelect={() => onChange(e)}
              className={cn('grid h-8 w-8 cursor-pointer place-items-center rounded text-base outline-none data-[highlighted]:bg-white/10', e === value && 'bg-white/10')}
            >
              {e}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
