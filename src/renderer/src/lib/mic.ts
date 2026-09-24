import { useSyncExternalStore } from 'react'
import { engine } from '@/audio/engine'

export interface MicStatus {
  device: string
  notice: string | null
  error: string | null
}

let micSnap: MicStatus = { device: '', notice: null, error: null }
const readMic = () => {
  const { micDevice: device, micNotice: notice, micError: error } = engine
  if (device !== micSnap.device || notice !== micSnap.notice || error !== micSnap.error) micSnap = { device, notice, error }
  return micSnap
}

/** Which mic the engine is really capturing, plus any warning about it. */
export function useMicStatus() {
  return useSyncExternalStore((fn) => {
    const off = engine.subscribe(fn)
    return () => void off()
  }, readMic)
}
