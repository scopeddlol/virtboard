import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Hotkeys } from '@shared/types'
import { api } from '@/lib/api'
import { engine } from '@/audio/engine'
import { ACCENTS, uid } from '@/lib/defaults'
import { deviceLabel, isVirtualOutput, useDevices } from '@/lib/devices'
import { findConflict } from '@/lib/conflicts'
import { persisted, useStore } from '@/state/store'
import { HotkeyInput } from '@/components/HotkeyInput'
import { Button, cn, Select, Switch } from '@/components/ui'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <h2 className="text-[14px] font-semibold text-zinc-100">{title}</h2>
      {description && <p className="mt-0.5 text-[12.5px] text-zinc-500">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[13px] text-zinc-200">{title}</div>
        {description && <div className="text-[12px] text-zinc-500">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const HOTKEY_ROWS: { key: keyof Hotkeys; title: string }[] = [
  { key: 'stopAll', title: 'Stop all sounds' },
  { key: 'toggleMic', title: 'Mute / unmute microphone' },
  { key: 'toggleVoice', title: 'Voice changer on / off' },
  { key: 'nextPage', title: 'Next page' },
  { key: 'prevPage', title: 'Previous page' },
  { key: 'toggleWindow', title: 'Show / hide Virtboard' },
]

export function Settings() {
  const s = useStore((st) => st.settings)
  const setSettings = useStore((st) => st.setSettings)
  const updateOutput = useStore((st) => st.updateOutput)
  const [, refreshErrors] = useState(0)
  useEffect(() => engine.subscribe(() => refreshErrors((n) => n + 1)), [])
  const setHotkey = useStore((st) => st.setHotkey)
  const devices = useDevices()
  const [version, setVersion] = useState('0.2.0')
  const [installing, setInstalling] = useState(false)
  useEffect(() => {
    api.appVersion().then(setVersion)
  }, [])

  const cable = devices.outputs.find((d) => isVirtualOutput(d.label))
  const inputs = devices.inputs.map((d) => ({ value: d.deviceId, label: deviceLabel(d) }))
  const outputs = devices.outputs.map((d) => ({ value: d.deviceId, label: deviceLabel(d) }))
  const pick = (list: MediaDeviceInfo[], id: string) => list.find((d) => d.deviceId === id)?.label ?? ''

  const install = async () => {
    setInstalling(true)
    const res = await api.installVirtualCable()
    setInstalling(false)
    if (res === 'started') toast('VB-CABLE installer opened', { description: 'Click “Install Driver”, then restart your PC if asked.' })
    else if (res === 'opened-website') toast('Opened the VB-CABLE download page')
    else toast.error('Could not start the installer')
  }

  const field = (label: string, hint: string, el: React.ReactNode) => (
    <div className="grid grid-cols-[180px_1fr] items-center gap-4">
      <div>
        <div className="text-[13px] text-zinc-200">{label}</div>
        <div className="text-[12px] text-zinc-500">{hint}</div>
      </div>
      {el}
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[680px] px-6 py-6">
        <h1 className="mb-6 text-[17px] font-semibold text-zinc-100">Settings</h1>

        <Section title="Audio" description="Choose your microphone and headphones, then set up separate mixes for your chat apps.">
          {field(
            'Microphone',
            'Your real mic',
            <Select value={s.inputDeviceId} options={inputs} onChange={(id) => setSettings({ inputDeviceId: id, inputDeviceLabel: pick(devices.inputs, id) })} />,
          )}
          {field(
            'Your headphones',
            'Where you hear sounds',
            <Select value={s.monitorDeviceId} options={outputs} onChange={(id) => setSettings({ monitorDeviceId: id, monitorDeviceLabel: pick(devices.outputs, id) })} />,
          )}

          <div className="rounded-md border border-line bg-panel px-3.5 py-3 text-[12.5px] leading-relaxed text-zinc-400">
            {cable ? (
              <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="flex-1">
                  VB-CABLE is installed. Its matching microphone is <span className="text-zinc-200">CABLE Output</span>.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span className="flex-1">
                  No virtual cable found. Virtboard uses the free VB-Audio Virtual Cable driver to create a virtual microphone.
                </span>
                <Button size="sm" variant="primary" onClick={install} disabled={installing}>
                  {installing ? 'Downloading…' : 'Install'}
                </Button>
              </div>
            )}
          </div>
        </Section>

        <Section title="Virtual outputs" description="Choose a different installed virtual cable for each output. In Discord and your game, select the matching cable recording device as the microphone. Adding a route here does not install a Windows audio device.">
          <p className="text-[12px] text-zinc-400">For sounds in game while talking in Discord: mute the Game Chat microphone and mute the Voice Chat soundboard. The global microphone mute still silences your mic on every output.</p>
          {s.outputs.map((o) => (
            <div key={o.id} data-output-id={o.id} className="space-y-3 rounded-md border border-line bg-panel p-4">
              <div className="flex items-center gap-3">
                <input aria-label={`${o.name} name`} className="min-w-0 flex-1 rounded border border-line bg-base px-2 py-1 text-[13px] text-zinc-200" value={o.name} maxLength={40} onChange={(e) => updateOutput(o.id, { name: e.target.value })} />
                <Button size="sm" variant="ghost" onClick={() => setSettings({ outputs: s.outputs.filter((x) => x.id !== o.id) })}>Remove</Button>
              </div>
              <Select value={o.deviceId || 'none'} options={[
                { value: 'none', label: 'None (disabled)' },
                ...(o.deviceId && !devices.outputs.some((d) => d.deviceId === o.deviceId) ? [{ value: o.deviceId, label: `${o.deviceLabel || 'Saved device'} (unavailable)` }] : []),
                ...outputs.filter((d) => d.value !== 'default' && !s.outputs.some((x) => x.id !== o.id && x.deviceId === d.value)),
              ]} onChange={(id) => updateOutput(o.id, { deviceId: id === 'none' ? '' : id, deviceLabel: id === 'none' ? '' : pick(devices.outputs, id) })} />
              {engine.outputErrors[o.id] && <p role="alert" className="text-[12px] text-amber-400">{engine.outputErrors[o.id]}</p>}
              <Row title="Mute microphone" description={s.micMuted ? 'Global microphone mute is also on' : undefined}>
                <Switch label={`Mute ${o.name} microphone`} checked={o.micMuted} onChange={(micMuted) => updateOutput(o.id, { micMuted })} />
              </Row>
              <Row title="Mute soundboard">
                <Switch label={`Mute ${o.name} soundboard`} checked={o.soundsMuted} onChange={(soundsMuted) => updateOutput(o.id, { soundsMuted })} />
              </Row>
              {(['micHotkey', 'soundsHotkey'] as const).map((key) => (
                <Row key={key} title={key === 'micHotkey' ? 'Microphone mute keybind' : 'Soundboard mute keybind'}>
                  <HotkeyInput className="w-[200px]" value={o[key]} onChange={(v) => updateOutput(o.id, { [key]: v })} conflict={findConflict(persisted(useStore.getState()), o[key], { output: `${o.id}:${key}` })} placeholder="None" />
                </Row>
              ))}
            </div>
          ))}
          <Button variant="outline" onClick={() => setSettings({ outputs: [...s.outputs, { id: uid(), name: `Output ${s.outputs.length + 1}`, deviceId: '', deviceLabel: '', micMuted: true, soundsMuted: false, micHotkey: '', soundsHotkey: '' }] })}>Add virtual output</Button>
        </Section>

        <Section title="Microphone">
          <Row title="Noise suppression" description="Reduce background noise such as fans and typing">
            <Switch checked={s.noiseSuppression} onChange={(noiseSuppression) => setSettings({ noiseSuppression })} />
          </Row>
          <Row title="Echo cancellation" description="Only needed if you use speakers instead of headphones">
            <Switch checked={s.echoCancellation} onChange={(echoCancellation) => setSettings({ echoCancellation })} />
          </Row>
          <Row title="Hear my voice" description="Play your voice back in your headphones">
            <Switch checked={s.monitorVoice} onChange={(monitorVoice) => setSettings({ monitorVoice })} />
          </Row>
          <Row title="Hear sounds" description="Play soundboard sounds in your headphones too">
            <Switch checked={s.monitorSounds} onChange={(monitorSounds) => setSettings({ monitorSounds })} />
          </Row>
        </Section>

        <Section title="Shortcuts" description="These work everywhere, even when Virtboard is in the tray. Sound shortcuts are set on each sound.">
          {HOTKEY_ROWS.map((r) => (
            <Row key={r.key} title={r.title}>
              <HotkeyInput
                className="w-[240px]"
                value={s.hotkeys[r.key]}
                onChange={(v) => setHotkey(r.key, v)}
                conflict={findConflict(persisted(useStore.getState()), s.hotkeys[r.key], { global: r.key })}
                placeholder="None"
              />
            </Row>
          ))}
        </Section>

        <Section title="App">
          <Row title="Keep running in the tray when closed" description="Shortcuts and the virtual mic keep working">
            <Switch checked={s.closeToTray} onChange={(closeToTray) => setSettings({ closeToTray })} />
          </Row>
          <Row title="Start with Windows">
            <Switch checked={s.launchOnStartup} onChange={(launchOnStartup) => setSettings({ launchOnStartup })} />
          </Row>
          <Row title="Start minimized to the tray">
            <Switch checked={s.startMinimized} onChange={(startMinimized) => setSettings({ startMinimized })} />
          </Row>
          <Row title="Accent color">
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  title={a.name}
                  onClick={() => setSettings({ accent: a.value })}
                  className={cn(
                    'h-5 w-5 cursor-pointer rounded-full ring-offset-2 ring-offset-base transition-shadow',
                    s.accent === a.value ? 'ring-2 ring-zinc-300' : 'hover:ring-1 hover:ring-zinc-600',
                  )}
                  style={{ background: a.value }}
                />
              ))}
            </div>
          </Row>
        </Section>

        <Section title="About">
          <p className="text-[13px] text-zinc-200">Virtboard {version} <span className="text-zinc-500">· Open source · MIT license</span></p>
        </Section>
      </div>
    </div>
  )
}
