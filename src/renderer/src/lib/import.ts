import { toast } from 'sonner'
import type { ImportedFile } from '@shared/types'
import { api } from './api'
import { computePeaks, engine } from '@/audio/engine'
import { useStore } from '@/state/store'

const AUDIO = /\.(mp3|wav|ogg|oga|flac|m4a|aac|webm|opus)$/i

async function analyse(files: ImportedFile[], bytes?: ArrayBuffer[]) {
  const ok: (ImportedFile & { duration: number; peaks: number[] })[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    try {
      const data = bytes?.[i]?.slice(0) ?? (await api.readSound(f.file))
      const buf = await engine.decode(data)
      ok.push({ ...f, duration: buf.duration, peaks: computePeaks(buf) })
    } catch {
      api.deleteSoundFile(f.file)
      toast.error(`Couldn't decode “${f.name}”`, { description: 'The file may be corrupt or in an unsupported format.' })
    }
  }
  if (ok.length) {
    useStore.getState().addSounds(ok)
    toast.success(ok.length === 1 ? `Added “${ok[0].name}”` : `Added ${ok.length} sounds`)
  }
}

export async function importFromDialog() {
  const files = await api.importDialog()
  if (files.length) await analyse(files)
}

export async function importFromDrop(list: FileList | File[]) {
  const files = [...list].filter((f) => AUDIO.test(f.name))
  if (!files.length) {
    toast.error('No audio files found', { description: 'Supported: MP3, WAV, OGG, FLAC, M4A, AAC, WEBM, OPUS' })
    return
  }
  const bytes = await Promise.all(files.map((f) => f.arrayBuffer()))
  const imported = await Promise.all(files.map((f, i) => api.importBytes(f.name, bytes[i])))
  await analyse(imported, bytes)
}
