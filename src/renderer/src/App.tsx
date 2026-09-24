import { useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import type { HotkeyAction, TrayAction } from '@shared/types'
import { engine } from '@/audio/engine'
import { api } from '@/lib/api'
import { isLoopbackInput, isVirtualOutput, listDevices } from '@/lib/devices'
import { activePreset, startPersistence, useStore } from '@/state/store'
import { TitleBar } from '@/components/TitleBar'
import { Sidebar } from '@/components/Sidebar'
import { Mixer } from '@/components/Mixer'
import { SoundEditor } from '@/components/SoundEditor'
import { Button, Dialog, TooltipProvider } from '@/components/ui'
import { Soundboard } from '@/views/Soundboard'
import { VoiceChanger } from '@/views/VoiceChanger'
import { Settings } from '@/views/Settings'

function handleAction(a: HotkeyAction | TrayAction) {
  const s = useStore.getState()
  switch (a.type) {
    case 'sound': {
      const sound = s.sounds.find((x) => x.id === a.id)
      if (sound) engine.play(sound).catch((e) => toast.error(`Couldn't play “${sound.name}”`, { description: String(e) }))
      break
    }
    case 'page': {
      s.setActivePage(a.id)
      const p = s.pages.find((x) => x.id === a.id)
      if (p) toast(`Page: ${p.name}`, { duration: 1200 })
      break
    }
    case 'nextPage':
    case 'prevPage': {
      s.cyclePage(a.type === 'nextPage' ? 1 : -1)
      const next = useStore.getState()
      const p = next.pages.find((x) => x.id === next.activePageId)
      if (p) toast(`Page: ${p.name}`, { duration: 1200 })
      break
    }
    case 'preset':
      if (s.settings.voiceEnabled && s.settings.activePresetId === a.id) s.toggleVoice()
      else s.activatePreset(a.id)
      break
    case 'stopAll':
      engine.stop()
      break
    case 'toggleMic':
      s.toggleMic()
      break
    case 'toggleVoice':
      s.toggleVoice()
      break
    case 'openSettings':
      s.setView('settings')
      break
  }
}

/** Re-find saved devices after reboots (IDs can change) and auto-pick VB-CABLE. */
async function reconcileDevices() {
  const d = await listDevices()
  const { settings, setSettings } = useStore.getState()
  const patch: Partial<typeof settings> = {}
  const fix = (list: MediaDeviceInfo[], id: string, label: string, idKey: 'inputDeviceId' | 'virtualDeviceId' | 'monitorDeviceId') => {
    if (!id || list.some((x) => x.deviceId === id)) return
    const byLabel = list.find((x) => x.label === label)
    if (byLabel) patch[idKey] = byLabel.deviceId
  }
  fix(d.inputs, settings.inputDeviceId, settings.inputDeviceLabel, 'inputDeviceId')
  // A virtual cable saved as "the mic" is a feedback loop — go back to automatic.
  const savedInput = d.inputs.find((x) => x.deviceId === (patch.inputDeviceId ?? settings.inputDeviceId))
  if (savedInput && savedInput.deviceId !== 'default' && isLoopbackInput(savedInput.label)) {
    patch.inputDeviceId = 'default'
    patch.inputDeviceLabel = ''
  }
  fix(d.outputs, settings.virtualDeviceId, settings.virtualDeviceLabel, 'virtualDeviceId')
  fix(d.outputs, settings.monitorDeviceId, settings.monitorDeviceLabel, 'monitorDeviceId')
  if (!settings.virtualDeviceId) {
    const cable = d.outputs.find((x) => isVirtualOutput(x.label))
    if (cable) {
      patch.virtualDeviceId = cable.deviceId
      patch.virtualDeviceLabel = cable.label
    }
  }
  if (Object.keys(patch).length) setSettings(patch)
}

function Welcome() {
  const onboarded = useStore((s) => s.settings.onboarded)
  const setSettings = useStore((s) => s.setSettings)
  const setView = useStore((s) => s.setView)
  const steps = [
    ['Install the virtual cable', 'Virtboard sends your voice and sounds through VB-Audio Virtual Cable (free). You can install it from Settings.'],
    ['Choose it in Discord or your game', 'Set your microphone / input device to “CABLE Output”.'],
    ['Add sounds and shortcuts', 'Drop audio files in, then give each one a key.'],
  ]
  return (
    <Dialog
      open={!onboarded}
      onOpenChange={() => setSettings({ onboarded: true })}
      title="Welcome to Virtboard"
      description="Three steps to get set up."
      className="w-[min(480px,92vw)]"
    >
      <ol className="space-y-3 px-5 pb-5 pt-3">
        {steps.map(([title, text], i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[11px] text-zinc-300">{i + 1}</span>
            <div>
              <div className="text-[13px] font-medium text-zinc-100">{title}</div>
              <div className="text-[12.5px] text-zinc-500">{text}</div>
            </div>
          </li>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => {
              setSettings({ onboarded: true })
              setView('settings')
            }}
          >
            Open settings
          </Button>
          <Button variant="primary" onClick={() => setSettings({ onboarded: true })}>Get started</Button>
        </div>
      </ol>
    </Dialog>
  )
}

export function App() {
  const loaded = useStore((s) => s.loaded)
  const view = useStore((s) => s.view)
  const accent = useStore((s) => s.settings.accent)

  useEffect(() => {
    useStore.getState().init().then(() => {
      startPersistence()
      // Push the loaded state once so the main process registers hotkeys & builds the tray menu.
      const s = useStore.getState()
      api.saveState({ version: 1, settings: s.settings, pages: s.pages, activePageId: s.activePageId, sounds: s.sounds, presets: s.presets })
        .then((r) => useStore.setState({ failedHotkeys: r.failed }))
      reconcileDevices()
    })
    const offHotkey = api.onHotkey(handleAction)
    const offTray = api.onTrayAction(handleAction)
    return () => {
      offHotkey()
      offTray()
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    const apply = () => {
      const s = useStore.getState()
      engine.applySettings(s.settings).then(() => engine.setVoiceParams(activePreset(s).params))
    }
    apply()
    return useStore.subscribe((s, prev) => {
      if (s.settings !== prev.settings) engine.applySettings(s.settings)
      if (s.presets !== prev.presets || s.settings.activePresetId !== prev.settings.activePresetId) engine.setVoiceParams(activePreset(s).params)
    })
  }, [loaded])

  // Tell the user (once per change) when their mic can't be used or had to be swapped.
  useEffect(() => {
    let last = ''
    const off = engine.subscribe(() => {
      const msg = engine.micError ?? engine.micNotice ?? ''
      if (msg === last) return
      last = msg
      if (engine.micError) toast.error('Microphone not working', { description: engine.micError, duration: 10000 })
      else if (engine.micNotice) toast.warning('Switched microphone', { description: engine.micNotice, duration: 10000 })
    })
    return () => void off()
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-base">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="relative min-w-0 flex-1 bg-base">
            <div className="absolute inset-0">
              {loaded && (view === 'board' ? <Soundboard /> : view === 'voice' ? <VoiceChanger /> : <Settings />)}
            </div>
          </main>
        </div>
        <Mixer />
      </div>
      {loaded && <SoundEditor />}
      {loaded && <Welcome />}
      <Toaster
        theme="dark"
        position="bottom-right"
        offset={{ bottom: 80, right: 16 }}
        toastOptions={{ className: '!bg-raised !border-line !rounded-md !text-zinc-200' }}
      />
    </TooltipProvider>
  )
}
