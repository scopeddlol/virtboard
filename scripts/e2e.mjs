// Shared helpers for driving the real Electron app with Playwright (screenshots + smoke test).
import { _electron as electron } from 'playwright'
import { rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DEMO, writeDemo } from './gen-demo-sounds.mjs'

export const DATA = resolve('.screenshot-data')

const peaks = (s, n = 48) => {
  const b = Math.floor(s.length / n)
  const p = Array.from({ length: n }, (_, i) => Math.max(...s.slice(i * b, (i + 1) * b).map(Math.abs)))
  const m = Math.max(...p)
  return p.map((x) => +(x / m).toFixed(3))
}

export function seed({ onboarded = true, accent = '#8b5cf6' } = {}) {
  rmSync(DATA, { recursive: true, force: true })
  writeDemo(join(DATA, 'sounds'))
  const pages = [
    { id: 'memes', name: 'Memes', emoji: '😂', hotkey: 'Ctrl+Alt+1' },
    { id: 'stream', name: 'Stream alerts', emoji: '🎥', hotkey: 'Ctrl+Alt+2' },
    { id: 'music', name: 'Music beds', emoji: '🎵', hotkey: 'Ctrl+Alt+3' },
    { id: 'gaming', name: 'Gaming', emoji: '🎮', hotkey: '' },
  ]
  const P = ['#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#64748b']
  const mk = (page, file, name, emoji, i, extra = {}) => ({
    id: `${page}-${file}`, pageId: page, name, file, emoji, color: P[i % P.length], hotkey: `num${i + 1}`,
    volume: 1, trimStart: 0, trimEnd: null, fadeIn: 0, fadeOut: 0, rate: 1, loop: false, mode: 'restart',
    localPlayback: true, duration: DEMO[file].length / 44100, peaks: peaks(DEMO[file]), createdAt: Date.now(), ...extra,
  })
  const memes = [
    ['airhorn.wav', 'Air Horn', '📢'], ['vine-boom.wav', 'Vine Boom', '💥'], ['bruh.wav', 'Bruh', '🗿'],
    ['sad-trombone.wav', 'Sad Trombone', '🎺'], ['wow.wav', 'Wow', '🤯'], ['rimshot.wav', 'Ba Dum Tss', '🥁'],
    ['crickets.wav', 'Crickets', '🦗'], ['boing.wav', 'Boing', '🤡'], ['laser.wav', 'Pew Pew', '⚡'],
  ]
  const stream = [
    ['tada.wav', 'New Follower', '🎉'], ['coin.wav', 'Donation', '💰'], ['ding.wav', 'Chat Ping', '🔔'],
    ['applause.wav', 'Applause', '👏'], ['drumroll.wav', 'Drum Roll', '🥁'], ['siren.wav', 'Raid Alert', '🚨'],
  ]
  const sounds = [
    ...memes.map(([f, n, e], i) => mk('memes', f, n, e, i)),
    ...stream.map(([f, n, e], i) => mk('stream', f, n, e, i + 3)),
    mk('music', 'lofi-loop.wav', 'Lo-fi Loop', '🎧', 9, { loop: true, hotkey: 'num1' }),
    mk('music', 'ding.wav', 'Intro Sting', '✨', 10, { hotkey: 'num2', trimEnd: 1.2 }),
  ]
  sounds[0].trimStart = 0.05
  sounds[0].trimEnd = 1.45
  sounds[0].fadeOut = 0.2
  const state = JSON.parse(readFileSync(new URL('./seed-settings.json', import.meta.url)))
  state.settings.onboarded = onboarded
  state.settings.accent = accent
  state.pages = pages
  state.activePageId = 'memes'
  state.sounds = sounds
  writeFileSync(join(DATA, 'state.json'), JSON.stringify(state))
}

const FAKE_DEVICES = () => {
  const devs = [
    ['audioinput', 'default', 'Default - Microphone (Blue Yeti)'],
    ['audioinput', 'yeti', 'Microphone (Blue Yeti)'],
    ['audioinput', 'headset-mic', 'Headset Microphone (Arctis 7)'],
    ['audiooutput', 'default', 'Default - Speakers (Realtek(R) Audio)'],
    ['audiooutput', 'cable', 'CABLE Input (VB-Audio Virtual Cable)'],
    ['audiooutput', 'arctis', 'Headphones (Arctis 7 Game)'],
    ['audiooutput', 'speakers', 'Speakers (Realtek(R) Audio)'],
  ]
  const list = devs.map(([kind, deviceId, label]) => ({ kind, deviceId, label, groupId: 'g', toJSON() { return this } }))
  navigator.mediaDevices.enumerateDevices = async () => list
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia = (c) => orig({ audio: true })
  const ss = AudioContext.prototype.setSinkId
  AudioContext.prototype.setSinkId = function (id) { return typeof id === 'string' && id ? Promise.resolve() : ss.call(this, id) }
}

export async function launch(opts) {
  seed(opts)
  const app = await electron.launch({
    args: ['.', '--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--force-device-scale-factor=1', '--disable-gpu', '--in-process-gpu'],
    env: { ...process.env, VIRTBOARD_USER_DATA: DATA },
  })
  const page = await app.firstWindow()
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w.setSize(1280, 820)
    w.show()
  })
  await page.waitForSelector('text=Virtboard')
  await page.evaluate(FAKE_DEVICES)
  await page.evaluate(() => navigator.mediaDevices.dispatchEvent(new Event('devicechange')))
  await page.waitForTimeout(1200)
  return { app, page }
}

