import { useEffect, useState } from 'react'

export interface Devices {
  inputs: MediaDeviceInfo[]
  outputs: MediaDeviceInfo[]
  ready: boolean
}

const VIRTUAL = /cable input|vb-audio|voicemeeter (aux )?input|virtual/i
export const isVirtualOutput = (label: string) => VIRTUAL.test(label)

let permission: Promise<void> | null = null
function ensurePermission() {
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
