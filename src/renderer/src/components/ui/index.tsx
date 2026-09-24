import * as RSlider from '@radix-ui/react-slider'
import * as RSwitch from '@radix-ui/react-switch'
import * as RTooltip from '@radix-ui/react-tooltip'
import * as RSelect from '@radix-ui/react-select'
import * as RDialog from '@radix-ui/react-dialog'
import { clsx } from 'clsx'
import { Check, ChevronDown, X } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const cn = clsx

// ------------------------------------------------------------------ Button

type Variant = 'primary' | 'ghost' | 'soft' | 'danger' | 'outline'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-110',
  ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]',
  soft: 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.09]',
  danger: 'text-red-400 hover:bg-red-500/10',
  outline: 'border border-line text-zinc-300 hover:bg-white/[0.04]',
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'icon' }
>(({ variant = 'soft', size = 'md', className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-40',
      size === 'md' && 'h-8 px-3 text-[13px]',
      size === 'sm' && 'h-7 px-2.5 text-xs',
      size === 'icon' && 'h-8 w-8',
      variants[variant],
      className,
    )}
    {...props}
  />
))

// ------------------------------------------------------------------ Tooltip

export function Tip({ label, children, side = 'top' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Root delayDuration={500}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} className="z-50 rounded-md border border-line bg-raised px-2 py-1 text-xs text-zinc-200 shadow-lg">
          {label}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
export const TooltipProvider = RTooltip.Provider

// ------------------------------------------------------------------ Slider

export function Slider({
  value, onChange, min = 0, max = 1, step = 0.01, className, disabled, centered,
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
  className?: string; disabled?: boolean; centered?: boolean
}) {
  const pct = ((value - min) / (max - min)) * 100
  const zero = centered ? ((0 - min) / (max - min)) * 100 : 0
  return (
    <RSlider.Root
      className={cn('relative flex h-4 w-full touch-none items-center select-none', disabled && 'opacity-40', className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(v) => onChange(v[0])}
      onDoubleClick={() => centered && onChange(0)}
    >
      <RSlider.Track className="relative h-1 grow overflow-hidden rounded-full bg-white/10">
        {centered ? (
          <div className="absolute h-full bg-accent" style={{ left: `${Math.min(pct, zero)}%`, width: `${Math.abs(pct - zero)}%` }} />
        ) : (
          <RSlider.Range className="absolute h-full bg-accent" />
        )}
      </RSlider.Track>
      <RSlider.Thumb className="block h-3.5 w-3.5 cursor-pointer rounded-full bg-zinc-100 shadow outline-none focus-visible:ring-2 focus-visible:ring-accent/50" aria-label="value" />
    </RSlider.Root>
  )
}

// ------------------------------------------------------------------ Switch

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className={cn(
        'relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-white/15',
      )}
    >
      <RSwitch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[18px]" />
    </RSwitch.Root>
  )
}

// ------------------------------------------------------------------ Select

export function Select({
  value, onChange, options, placeholder, className,
}: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string; hint?: string }[]
  placeholder?: string; className?: string
}) {
  return (
    <RSelect.Root value={value || undefined} onValueChange={onChange}>
      <RSelect.Trigger
        className={cn(
          'inline-flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-line bg-panel px-2.5 text-[13px] text-zinc-200 outline-none hover:border-white/15 focus-visible:ring-2 focus-visible:ring-accent/50',
          className,
        )}
      >
        <span className="truncate"><RSelect.Value placeholder={placeholder ?? 'Select…'} /></span>
        <RSelect.Icon><ChevronDown size={14} className="text-zinc-500" /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content position="popper" sideOffset={4} className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-raised p-1 shadow-xl">
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer items-center rounded py-1.5 pl-7 pr-2.5 text-[13px] text-zinc-300 outline-none data-[highlighted]:bg-white/[0.07] data-[highlighted]:text-white"
              >
                <RSelect.ItemIndicator className="absolute left-2"><Check size={13} /></RSelect.ItemIndicator>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                {o.hint && <span className="ml-auto pl-3 text-[11px] text-zinc-500">{o.hint}</span>}
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

// ------------------------------------------------------------------ Dialog

export function Dialog({
  open, onOpenChange, title, description, children, className,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode
  children: ReactNode; className?: string; icon?: ReactNode
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <RDialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(640px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-panel shadow-2xl',
            className,
          )}
        >
          <div className="flex items-start gap-3 px-5 pb-1 pt-4">
            <div className="min-w-0 flex-1">
              <RDialog.Title className="text-[15px] font-semibold text-zinc-100">{title}</RDialog.Title>
              {description && <RDialog.Description className="mt-0.5 text-[12.5px] text-zinc-500">{description}</RDialog.Description>}
            </div>
            <RDialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close"><X size={15} /></Button>
            </RDialog.Close>
          </div>
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

// ------------------------------------------------------------------ Misc

export function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-md border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between text-[12px] text-zinc-400">
      <span>{children}</span>
      {hint && <span className="tabular-nums text-zinc-500">{hint}</span>}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-lg border border-line bg-panel', className)}>{children}</div>
}
