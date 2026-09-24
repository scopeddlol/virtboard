import * as RSlider from '@radix-ui/react-slider'
import * as RSwitch from '@radix-ui/react-switch'
import * as RTooltip from '@radix-ui/react-tooltip'
import * as RSelect from '@radix-ui/react-select'
import * as RDialog from '@radix-ui/react-dialog'
import { clsx } from 'clsx'
import { Check, ChevronDown, X } from 'lucide-react'
import { motion } from 'motion/react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const cn = clsx

// ------------------------------------------------------------------ Button

type Variant = 'primary' | 'ghost' | 'soft' | 'danger' | 'outline'
const variants: Record<Variant, string> = {
  primary:
    'text-white bg-gradient-to-b from-accent to-[color-mix(in_oklab,var(--accent)_75%,black)] shadow-[0_6px_20px_-6px_var(--accent),inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-110',
  ghost: 'text-zinc-300 hover:text-white hover:bg-white/[0.06]',
  soft: 'text-zinc-100 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06]',
  danger: 'text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20',
  outline: 'text-zinc-200 border border-white/10 hover:border-white/20 hover:bg-white/[0.04]',
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'icon' }
>(({ variant = 'soft', size = 'md', className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
      size === 'md' && 'h-9 px-3.5 text-[13px]',
      size === 'sm' && 'h-7 px-2.5 text-xs rounded-lg',
      size === 'icon' && 'h-8 w-8 text-sm',
      variants[variant],
      className,
    )}
    {...props}
  />
))

// ------------------------------------------------------------------ Tooltip

export function Tip({ label, children, side = 'top' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Root delayDuration={350}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-lg bg-ink-700/95 px-2.5 py-1.5 text-xs text-zinc-100 shadow-xl border border-white/10 backdrop-blur data-[state=delayed-open]:animate-in"
        >
          {label}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
export const TooltipProvider = RTooltip.Provider

// ------------------------------------------------------------------ Slider

export function Slider({
  value, onChange, min = 0, max = 1, step = 0.01, className, color, disabled, centered,
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
  className?: string; color?: string; disabled?: boolean; centered?: boolean
}) {
  const pct = ((value - min) / (max - min)) * 100
  const zero = centered ? ((0 - min) / (max - min)) * 100 : 0
  return (
    <RSlider.Root
      className={cn('relative flex h-5 w-full touch-none items-center select-none', disabled && 'opacity-40', className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(v) => onChange(v[0])}
      onDoubleClick={() => centered && onChange(0)}
    >
      <RSlider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-white/[0.08]">
        {centered ? (
          <div
            className="absolute h-full rounded-full"
            style={{
              left: `${Math.min(pct, zero)}%`,
              width: `${Math.abs(pct - zero)}%`,
              background: color ?? 'var(--accent)',
            }}
          />
        ) : (
          <RSlider.Range
            className="absolute h-full rounded-full"
            style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${color ?? 'var(--accent)'} 55%, transparent), ${color ?? 'var(--accent)'})` }}
          />
        )}
      </RSlider.Track>
      <RSlider.Thumb
        className="block h-4 w-4 rounded-full bg-white shadow-[0_0_0_4px_rgb(255_255_255/0.08),0_2px_8px_rgb(0_0_0/0.5)] outline-none transition-transform hover:scale-110 focus-visible:ring-4 focus-visible:ring-accent/40 cursor-grab active:cursor-grabbing"
        aria-label="value"
      />
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
        'relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40',
        checked ? 'bg-accent shadow-[0_0_14px_-2px_var(--accent)]' : 'bg-white/[0.12]',
      )}
    >
      <RSwitch.Thumb className="block h-[18px] w-[18px] translate-x-[2px] rounded-full bg-white shadow-md transition-transform duration-200 data-[state=checked]:translate-x-[18px]" />
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
          'inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-[13px] text-zinc-100 outline-none hover:border-white/15 focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer',
          className,
        )}
      >
        <span className="truncate"><RSelect.Value placeholder={placeholder ?? 'Select…'} /></span>
        <RSelect.Icon><ChevronDown size={15} className="text-zinc-400" /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-white/10 bg-ink-800/95 p-1 shadow-2xl backdrop-blur-xl"
        >
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer items-center gap-2 rounded-lg py-2 pl-8 pr-3 text-[13px] text-zinc-200 outline-none data-[highlighted]:bg-accent/20 data-[highlighted]:text-white"
              >
                <RSelect.ItemIndicator className="absolute left-2.5"><Check size={14} className="text-accent" /></RSelect.ItemIndicator>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                {o.hint && <span className="ml-auto pl-3 text-[11px] text-accent">{o.hint}</span>}
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
  open, onOpenChange, title, description, children, className, icon,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode
  children: ReactNode; className?: string; icon?: ReactNode
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay asChild>
          <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        </RDialog.Overlay>
        <RDialog.Content asChild aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(720px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-ink-850/95 shadow-[0_30px_80px_-10px_rgb(0_0_0/0.8)] backdrop-blur-2xl',
              className,
            )}
          >
            <div className="flex items-start gap-3 border-b border-white/[0.06] px-6 py-4">
              {icon}
              <div className="min-w-0 flex-1">
                <RDialog.Title className="font-display text-lg font-semibold text-white">{title}</RDialog.Title>
                {description && <RDialog.Description className="mt-0.5 text-[13px] text-zinc-400">{description}</RDialog.Description>}
              </div>
              <RDialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close"><X size={16} /></Button>
              </RDialog.Close>
            </div>
            {children}
          </motion.div>
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
    <div className="inline-flex rounded-xl border border-white/[0.07] bg-black/20 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
            value === o.value ? 'text-white' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-lg bg-white/[0.1] shadow-inner" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between text-[12px] font-medium uppercase tracking-wider text-zinc-400">
      <span>{children}</span>
      {hint && <span className="font-mono text-[11px] normal-case tracking-normal text-zinc-300">{hint}</span>}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('glass rounded-2xl', className)}>{children}</div>
}
