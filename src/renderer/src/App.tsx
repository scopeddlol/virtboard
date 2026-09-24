import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Toaster, toast } from 'sonner'
import { Cable, Keyboard, MessageSquareText, Rocket } from 'lucide-react'
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
      if (p) toast(`${p.emoji} ${p.name}`, { description: 'Page keybinds active', duration: 1400 })
      break
    }
    case 'nextPage':
    case 'prevPage': {
      s.cyclePage(a.type === 'nextPage' ? 1 : -1)
      const next = useStore.getState()
      const p = next.pages.find((x) => x.id === next.activePageId)
      if (p) toast(`${p.emoji} ${p.name}`, { description: 'Page keybinds active', duration: 1400 })
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
    { icon: <Cable size={18} />, title: 'Install the virtual cable', text: 'Virtboard sends your mic + sounds into VB-Audio Virtual Cable (free). One-click install from Settings.' },
    { icon: <MessageSquareText size={18} />, title: 'Pick it in Discord & games', text: 'Set your input device to “CABLE Output”. Everyone now hears your voice, effects and sounds.' },
    { icon: <Keyboard size={18} />, title: 'Add sounds, bind keys', text: 'Drop in audio files, trim them, and give each page its own keybinds.' },
  ]
  return (
    <Dialog
      open={!onboarded}
      onOpenChange={() => setSettings({ onboarded: true })}
      title="Welcome to Virtboard"
      description="Three steps and you’re live."
      className="w-[min(620px,92vw)]"
      icon={<img src="./logo.svg" className="h-10 w-10" alt="" />}
    >
      <div className="space-y-3 p-6">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">{s.icon}</span>
            <div>
              <div className="text-[14px] font-semibold text-white">
                <span className="mr-2 font-mono text-accent">{i + 1}.</span>
                {s.title}
              </div>
              <div className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">{s.text}</div>
            </div>
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-3">
          <Button
            variant="outline"
            onClick={() => {
              setSettings({ onboarded: true })
              setView('settings')
            }}
          >
            Open audio settings
          </Button>
          <Button variant="primary" onClick={() => setSettings({ onboarded: true })}>
            <Rocket size={14} /> Let’s go
          </Button>
        </div>
      </div>
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

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  return (
    <TooltipProvider>
      <div className="app-bg noise relative flex h-full flex-col overflow-hidden">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="relative min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                className="absolute inset-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {loaded && (view === 'board' ? <Soundboard /> : view === 'voice' ? <VoiceChanger /> : <Settings />)}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <Mixer />
      </div>
      {loaded && <SoundEditor />}
      {loaded && <Welcome />}
      <Toaster
        theme="dark"
        position="bottom-right"
        offset={{ bottom: 100, right: 20 }}
        toastOptions={{ className: '!bg-ink-800/95 !border-white/10 !backdrop-blur-xl !rounded-xl !text-zinc-100' }}
      />
    </TooltipProvider>
  )
}
