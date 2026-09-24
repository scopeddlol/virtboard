import { useEffect, useState } from 'react'

export interface Devices {
  inputs: MediaDeviceInfo[]
  outputs: MediaDeviceInfo[]
  ready: boolean
}

const VIRTUAL = /cable input|vb-audio|voicemeeter (aux )?input|virtual/i
export const isVirtualOutput = (label: string) => VIRTUAL.test(label)

/**
 * The *recording* side of a virtual cable ("CABLE Output", "VoiceMeeter Output"…).
 * That's where Virtboard's own mix comes out, so capturing it as "your mic" means
 * your real voice never gets in and every sound feeds back into itself.
 * Installing VB-CABLE often makes Windows pick it as the default recording device.
 */
const LOOPBACK = /cable(-[a-z0-9]+)? output|vb-audio|voicemeeter|virtual (audio )?cable/i
export const isLoopbackInput = (label: string) => LOOPBACK.test(label)

/** Mics people route through on purpose (AI noise removal) — the best guess when we have to choose. */
const PREFERRED = /nvidia broadcast|rtx voice|krisp|steelseries sonar - microphone|elgato wave/i

export interface MicChoice {
  /** Device to open ('' = let the OS decide). */
  deviceId: string
  label: string
  /** Set when we had to avoid the user's (or Windows') choice. */
  notice: string | null
}

const bare = (label: string) => label.replace(/^(Default|Communications) - /, '')

/** Turn the saved mic setting into a real, non-loopback capture device. */
export function chooseMic(inputs: MediaDeviceInfo[], wantedId: string): MicChoice {
  const wanted = inputs.find((d) => d.deviceId === (wantedId || 'default')) ?? inputs.find((d) => d.deviceId === 'default')
  if (wanted && !isLoopbackInput(wanted.label)) {
    return { deviceId: wanted.deviceId, label: bare(wanted.label), notice: null }
  }
  const real = inputs.filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications' && d.label && !isLoopbackInput(d.label))
  const comms = inputs.find((d) => d.deviceId === 'communications' && d.label && !isLoopbackInput(d.label))
  const pick = real.find((d) => PREFERRED.test(d.label)) ?? real.find((d) => comms && bare(comms.label) === d.label) ?? real[0]
  if (!wanted) return pick ? { deviceId: pick.deviceId, label: pick.label, notice: null } : { deviceId: '', label: '', notice: null }
  const why = wanted.deviceId === 'default'
    ? `Windows' default recording device is “${bare(wanted.label)}” — that's Virtboard's own output, not a microphone.`
    : `“${bare(wanted.label)}” is Virtboard's own output, not a microphone.`
  if (!pick) return { deviceId: '', label: '', notice: `${why} Plug in or enable a microphone.` }
  return { deviceId: pick.deviceId, label: pick.label, notice: `${why} Using “${pick.label}” instead.` }
}

let permission: Promise<void> | null = null
export function ensurePermission() {
  // Device labels are only exposed after mic permission is granted.
  permission ??= navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((s) => s.getTracks().forEach((t) => t.stop()))
    .catch(() => {})
  return permission
}

export async function listDevices(): Promise<Devices> {
  await ensurePermission()
  const all = await navigator.mediaDevices.enumerateDevices()
  const clean = (kind: MediaDeviceKind) => all.filter((d) => d.kind === kind && d.deviceId !== 'communications')
  return { inputs: clean('audioinput'), outputs: clean('audiooutput'), ready: true }
}

export function useDevices() {
  const [devices, setDevices] = useState<Devices>({ inputs: [], outputs: [], ready: false })
  useEffect(() => {
    let alive = true
    const refresh = () => listDevices().then((d) => alive && setDevices(d))
    refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => {
      alive = false
      navigator.mediaDevices.removeEventListener('devicechange', refresh)
    }
  }, [])
  return devices
}

export const deviceLabel = (d: MediaDeviceInfo) =>
  d.deviceId === 'default' ? `System default${d.label ? ` — ${d.label.replace(/^Default - /, '')}` : ''}` : d.label || 'Unnamed device'
