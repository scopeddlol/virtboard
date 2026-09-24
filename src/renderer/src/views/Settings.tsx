import { useEffect, useState } from 'react'
import { ArrowRight, AudioLines, Cable, CheckCircle2, Download, ExternalLink, Headphones, Keyboard, Mic, MonitorCog, Palette, Radio, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { Hotkeys } from '@shared/types'
import { api } from '@/lib/api'
import { ACCENTS } from '@/lib/defaults'
import { deviceLabel, isVirtualOutput, useDevices } from '@/lib/devices'
import { findConflict } from '@/lib/conflicts'
import { persisted, useStore } from '@/state/store'
import { HotkeyInput } from '@/components/HotkeyInput'
import { Button, Card, cn, Select, Switch } from '@/components/ui'

const GithubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
  </svg>
)

function Section({ icon, title, description, children }: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">{icon}</span>
        <div>
          <h2 className="font-display text-[16px] font-semibold text-white">{title}</h2>
          {description && <p className="mt-0.5 text-[12.5px] text-zinc-400">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  )
}

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-white/[0.05] py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-zinc-100">{title}</div>
        {description && <div className="mt-0.5 text-[12px] text-zinc-400">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Node({ icon, title, sub, glow }: { icon: React.ReactNode; title: string; sub: string; glow?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5', glow ? 'border-accent/40 bg-accent/10 shadow-[0_0_30px_-10px_var(--accent)]' : 'border-white/[0.07] bg-white/[0.03]')}>
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', glow ? 'bg-accent text-white' : 'bg-white/[0.06] text-zinc-300')}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold text-white">{title}</span>
        <span className="block truncate text-[10.5px] text-zinc-400">{sub}</span>
      </span>
    </div>
  )
}

const HOTKEY_ROWS: { key: keyof Hotkeys; title: string; description: string }[] = [
  { key: 'stopAll', title: 'Stop all sounds', description: 'Instantly silence every playing sound' },
  { key: 'toggleMic', title: 'Mute / unmute microphone', description: 'Sounds keep playing while your mic is muted' },
  { key: 'toggleVoice', title: 'Toggle voice changer', description: 'Switch between your normal and changed voice' },
  { key: 'nextPage', title: 'Next sound page', description: 'Swap every sound keybind to the next page' },
  { key: 'prevPage', title: 'Previous sound page', description: 'Swap every sound keybind to the previous page' },
  { key: 'toggleWindow', title: 'Show / hide Virtboard', description: 'Bring the window back from the tray' },
]

export function Settings() {
  const s = useStore((st) => st.settings)
  const setSettings = useStore((st) => st.setSettings)
  const setHotkey = useStore((st) => st.setHotkey)
  const devices = useDevices()
  const [version, setVersion] = useState('0.1.0')
  const [installing, setInstalling] = useState(false)
  useEffect(() => {
    api.appVersion().then(setVersion)
  }, [])

  const cable = devices.outputs.find((d) => isVirtualOutput(d.label))
  const cableSelected = !!s.virtualDeviceId && isVirtualOutput(s.virtualDeviceLabel)
  const inputs = devices.inputs.map((d) => ({ value: d.deviceId, label: deviceLabel(d) }))
  const outputs = devices.outputs.map((d) => ({ value: d.deviceId, label: deviceLabel(d), hint: isVirtualOutput(d.label) ? 'virtual' : undefined }))
  const pick = (list: MediaDeviceInfo[], id: string) => list.find((d) => d.deviceId === id)?.label ?? ''

  const install = async () => {
    setInstalling(true)
    const res = await api.installVirtualCable()
    setInstalling(false)
    if (res === 'started') toast.success('VB-CABLE installer launched', { description: 'Approve the admin prompt, click “Install Driver”, then reboot if asked.' })
    else if (res === 'opened-website') toast('Opened the VB-CABLE download page', { description: 'Install it, then come back — Virtboard detects it automatically.' })
    else toast.error('Could not start the installer')
  }

  return (
    <div className="h-full overflow-y-auto px-8 pb-10 pt-7">
      <div className="mx-auto max-w-[920px] space-y-5">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-white">Settings</h1>
          <p className="mt-0.5 text-[13px] text-zinc-400">Audio routing, hotkeys and how Virtboard behaves.</p>
        </div>

        <Section icon={<Cable size={18} />} title="Audio routing" description="Your mic and sounds are mixed and sent into a virtual audio cable that other apps use as a microphone.">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Node icon={<Mic size={15} />} title="Microphone" sub={pick(devices.inputs, s.inputDeviceId).replace(/^Default - /, '') || 'System default'} />
              <Node icon={<AudioLines size={15} />} title="Soundboard" sub="Your sounds" />
            </div>
            <ArrowRight size={16} className="shrink-0 text-zinc-600" />
            <Node icon={<Sparkles size={15} />} title="Virtboard mix" sub={s.voiceEnabled ? 'Voice FX on' : 'Clean voice'} glow />
            <ArrowRight size={16} className="shrink-0 text-zinc-600" />
            <div className="flex flex-1 flex-col gap-2">
              <Node icon={<Radio size={15} />} title={cableSelected ? 'CABLE Input' : 'Virtual output'} sub={cableSelected ? 'Discord / games hear this' : 'Not set up yet'} />
              <Node icon={<Headphones size={15} />} title="Your headphones" sub="Monitor (optional)" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-zinc-300"><Mic size={13} /> Microphone input</div>
              <Select
                value={s.inputDeviceId}
                options={inputs}
                onChange={(id) => setSettings({ inputDeviceId: id, inputDeviceLabel: pick(devices.inputs, id) })}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-zinc-300"><Radio size={13} /> Virtual mic output</div>
              <Select
                value={s.virtualDeviceId}
                options={[{ value: 'none', label: 'None (don’t send anywhere)' }, ...outputs]}
                placeholder="Choose CABLE Input…"
                onChange={(id) =>
                  setSettings(id === 'none' ? { virtualDeviceId: '', virtualDeviceLabel: '' } : { virtualDeviceId: id, virtualDeviceLabel: pick(devices.outputs, id) })
                }
              />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-zinc-300"><Headphones size={13} /> Monitor output</div>
              <Select
                value={s.monitorDeviceId}
                options={outputs}
                onChange={(id) => setSettings({ monitorDeviceId: id, monitorDeviceLabel: pick(devices.outputs, id) })}
              />
            </div>
          </div>

          <div className={cn('mt-5 flex items-center gap-4 rounded-xl border p-4', cable ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-amber-500/25 bg-amber-500/[0.06]')}>
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', cable ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
              {cable ? <CheckCircle2 size={19} /> : <Cable size={19} />}
            </span>
            <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-zinc-300">
              {cable ? (
                <>
                  <b className="text-white">Virtual cable detected.</b> In Discord, OBS or your game, set the <b className="text-white">input device / microphone</b> to{' '}
                  <code className="rounded bg-black/30 px-1.5 py-0.5 text-emerald-300">CABLE Output (VB-Audio Virtual Cable)</code>.
                  {!cableSelected && (
                    <Button size="sm" variant="primary" className="ml-2" onClick={() => setSettings({ virtualDeviceId: cable.deviceId, virtualDeviceLabel: cable.label })}>
                      Use it
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <b className="text-white">No virtual audio cable found.</b> Virtboard uses the free VB-Audio Virtual Cable driver to create a virtual microphone.
                  Install it once, and Virtboard will pick it up automatically.
                </>
              )}
            </div>
            {!cable && (
              <Button variant="primary" onClick={install} disabled={installing}>
                <Download size={14} /> {installing ? 'Downloading…' : 'Install VB-CABLE'}
              </Button>
            )}
          </div>
        </Section>

        <Section icon={<Mic size={18} />} title="Microphone processing" description="Chromium’s built-in voice processing, applied before the voice changer.">
          <Row title="Noise suppression" description="Removes steady background noise like fans and keyboards">
            <Switch checked={s.noiseSuppression} onChange={(noiseSuppression) => setSettings({ noiseSuppression })} />
          </Row>
          <Row title="Echo cancellation" description="Only needed if you use speakers instead of headphones">
            <Switch checked={s.echoCancellation} onChange={(echoCancellation) => setSettings({ echoCancellation })} />
          </Row>
          <Row title="Hear my voice" description="Play your (changed) voice back on the monitor output">
            <Switch checked={s.monitorVoice} onChange={(monitorVoice) => setSettings({ monitorVoice })} />
          </Row>
          <Row title="Hear sounds" description="Play soundboard sounds on the monitor output too">
            <Switch checked={s.monitorSounds} onChange={(monitorSounds) => setSettings({ monitorSounds })} />
          </Row>
        </Section>

        <Section icon={<Keyboard size={18} />} title="Global hotkeys" description="These work everywhere — even when Virtboard is minimized to the tray. Sound keybinds are set per sound, per page.">
          {HOTKEY_ROWS.map((r) => (
            <Row key={r.key} title={r.title} description={r.description}>
              <HotkeyInput
                className="w-[270px]"
                value={s.hotkeys[r.key]}
                onChange={(v) => setHotkey(r.key, v)}
                conflict={findConflict(persisted(useStore.getState()), s.hotkeys[r.key], { global: r.key })}
              />
            </Row>
          ))}
        </Section>

        <Section icon={<MonitorCog size={18} />} title="App behavior">
          <Row title="Close button minimizes to tray" description="Keep hotkeys and the virtual mic running in the background">
            <Switch checked={s.closeToTray} onChange={(closeToTray) => setSettings({ closeToTray })} />
          </Row>
          <Row title="Launch on Windows startup" description="Starts quietly in the tray">
            <Switch checked={s.launchOnStartup} onChange={(launchOnStartup) => setSettings({ launchOnStartup })} />
          </Row>
          <Row title="Start minimized" description="Open straight to the tray">
            <Switch checked={s.startMinimized} onChange={(startMinimized) => setSettings({ startMinimized })} />
          </Row>
        </Section>

        <Section icon={<Palette size={18} />} title="Appearance">
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                onClick={() => setSettings({ accent: a.value })}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium transition-all',
                  s.accent === a.value ? 'border-white/30 bg-white/[0.08] text-white' : 'border-white/[0.06] text-zinc-400 hover:border-white/15 hover:text-white',
                )}
              >
                <span className="h-4 w-4 rounded-full" style={{ background: a.value, boxShadow: s.accent === a.value ? `0 0 12px ${a.value}` : undefined }} />
                {a.name}
              </button>
            ))}
          </div>
        </Section>

        <Card className="flex items-center gap-4 p-5">
          <img src="./logo.svg" className="h-12 w-12" alt="" />
          <div className="flex-1">
            <div className="font-display text-[15px] font-semibold text-white">Virtboard {version}</div>
            <div className="text-[12px] text-zinc-400">Open-source soundboard & voice changer · MIT license</div>
          </div>
          <Button variant="outline" onClick={() => api.openExternal('https://github.com/scopeddlol/virtboard')}>
            <GithubIcon /> GitHub <ExternalLink size={12} />
          </Button>
        </Card>
      </div>
    </div>
  )
}
