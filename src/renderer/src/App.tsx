import { useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import type { HotkeyAction, TrayAction } from '@shared/types'
import { engine } from '@/audio/engine'
import { api } from '@/lib/api'
import { isVirtualOutput, listDevices } from '@/lib/devices'
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
    case 'toggleOutputMic':
    case 'toggleOutputSounds':
      s.toggleOutput(a.id, a.type === 'toggleOutputMic' ? 'micMuted' : 'soundsMuted')
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
  const fix = (list: MediaDeviceInfo[], id: string, label: string, idKey: 'inputDeviceId' | 'monitorDeviceId') => {
    if (!id || list.some((x) => x.deviceId === id)) return
    const byLabel = list.find((x) => x.label === label)
    if (byLabel) patch[idKey] = byLabel.deviceId
  }
  fix(d.inputs, settings.inputDeviceId, settings.inputDeviceLabel, 'inputDeviceId')
  fix(d.outputs, settings.monitorDeviceId, settings.monitorDeviceLabel, 'monitorDeviceId')
  const outputs = settings.outputs.map((o, i) => {
    if (o.deviceId && d.outputs.some((x) => x.deviceId === o.deviceId)) return o
    const device = o.deviceId ? d.outputs.find((x) => x.label === o.deviceLabel)
      : !settings.onboarded && i === 0 ? d.outputs.find((x) => isVirtualOutput(x.label)) : undefined
    return device ? { ...o, deviceId: device.deviceId, deviceLabel: device.label } : o
  })
  if (outputs.some((o, i) => o !== settings.outputs[i])) patch.outputs = outputs
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
    const offZoom = api.window.onZoomChange((zoomFactor) => useStore.getState().setSettings({ zoomFactor }))
    navigator.mediaDevices.addEventListener('devicechange', reconcileDevices)
    return () => {
      offHotkey()
      offTray()
      offZoom()
      navigator.mediaDevices.removeEventListener('devicechange', reconcileDevices)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    const apply = () => {
      const s = useStore.getState()
      api.window.setZoom(s.settings.zoomFactor)
      engine.applySettings(s.settings).then(() => engine.setVoiceParams(activePreset(s).params))
    }
    apply()
    return useStore.subscribe((s, prev) => {
      if (s.settings !== prev.settings) engine.applySettings(s.settings)
      if (s.settings.zoomFactor !== prev.settings.zoomFactor) api.window.setZoom(s.settings.zoomFactor)
      if (s.presets !== prev.presets || s.settings.activePresetId !== prev.settings.activePresetId) engine.setVoiceParams(activePreset(s).params)
    })
  }, [loaded])

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
