import { app } from 'electron'
import { promises as fs, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { AppState } from '../shared/types'

export const dataDir = () => app.getPath('userData')
export const soundsDir = () => join(dataDir(), 'sounds')
const statePath = () => join(dataDir(), 'state.json')

export function ensureDirs() {
  mkdirSync(soundsDir(), { recursive: true })
}

/** Resolve a sound file name to an absolute path, refusing anything that escapes the sounds dir. */
export function soundPath(file: string) {
  const safe = basename(file)
  if (!safe || safe !== file) throw new Error(`Invalid sound file name: ${file}`)
  return join(soundsDir(), safe)
}

export async function loadState(): Promise<AppState | null> {
  try {
    return JSON.parse(await fs.readFile(statePath(), 'utf8')) as AppState
  } catch {
    return null
  }
}

let writing: Promise<void> = Promise.resolve()

/** Atomic write (tmp file + rename) serialized so saves never interleave. */
export function saveState(state: AppState) {
  const json = JSON.stringify(state, null, 1)
  writing = writing.then(async () => {
    const tmp = statePath() + '.tmp'
    await fs.writeFile(tmp, json, 'utf8')
    await fs.rename(tmp, statePath())
  }).catch((err) => console.error('[virtboard] failed to save state', err))
  return writing
}
