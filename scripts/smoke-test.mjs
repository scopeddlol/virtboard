// End-to-end smoke test against the real Electron build.
// Linux: `npm run build:fast && xvfb-run -a node scripts/smoke-test.mjs`
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA, launch } from './e2e.mjs'

let failures = 0
const check = (ok, msg) => {
  console.log(`${ok ? '✅' : '❌'} ${msg}`)
  if (!ok) failures++
}
const registered = (app, accel) => app.evaluate(({ globalShortcut }, a) => globalShortcut.isRegistered(a), accel)
const sendHotkey = (app, action) =>
  app.evaluate(({ BrowserWindow }, a) => BrowserWindow.getAllWindows()[0].webContents.send('hotkey', a), action)
const playing = (page) => page.locator('.pulse-ring').count()

const { app, page } = await launch()

check(await registered(app, 'num1'), 'Sound keybind num1 registered on the active page')
check(await registered(app, 'Ctrl+Alt+M'), 'Global mute hotkey registered')
check(await registered(app, 'Ctrl+Alt+2'), 'Jump-to-page hotkey registered')
check(await registered(app, 'num9'), 'num9 bound on Memes page')

// Page switch: Stream alerts has 6 sounds bound to num4..num9 — num1..num3 must be released.
await sendHotkey(app, { type: 'page', id: 'stream' })
await page.waitForTimeout(600)
check(await page.getByRole('heading', { name: 'Stream alerts' }).isVisible(), 'Page hotkey switches the visible page')
check(!(await registered(app, 'num1')), 'num1 released on a page that does not use it')
check(await registered(app, 'num4'), 'num4 now bound to the Stream page')

// Sound hotkey plays through the audio engine
await sendHotkey(app, { type: 'sound', id: 'stream-tada.wav' })
await page.waitForTimeout(300)
check((await playing(page)) === 1, 'Sound hotkey starts playback')
await sendHotkey(app, { type: 'stopAll' })
await page.waitForTimeout(300)
check((await playing(page)) === 0, 'Stop-all hotkey stops playback')

// Mic mute + voice toggles flow through state
await sendHotkey(app, { type: 'toggleMic' })
await page.waitForTimeout(200)
check(await page.getByText('Mic muted').isVisible(), 'Mute hotkey mutes the mic')
await sendHotkey(app, { type: 'preset', id: 'robot' })
await page.waitForTimeout(200)
check(await page.getByText('🤖 Robot').first().isVisible(), 'Preset hotkey activates a voice preset')

// Next/prev page wrap around
await sendHotkey(app, { type: 'nextPage' })
await page.waitForTimeout(400)
check(await page.getByRole('heading', { name: 'Music beds' }).isVisible(), 'Next-page hotkey advances pages')

// Persistence
await page.waitForTimeout(800)
const saved = JSON.parse(readFileSync(join(DATA, 'state.json'), 'utf8'))
check(saved.activePageId === 'music' && saved.settings.micMuted && saved.settings.activePresetId === 'robot', 'State persisted to disk')


// Voice DSP: a 220 Hz tone shifted ±12 semitones should come out at ~440 / ~110 Hz.
const freqs = await page.evaluate(async () => {
  const measure = async (semis) => {
    const ctx = new OfflineAudioContext(1, 48000, 48000)
    await ctx.audioWorklet.addModule(new URL('voice-processor.js', document.baseURI).href)
    const osc = ctx.createOscillator()
    osc.frequency.value = 220
    const node = new AudioWorkletNode(ctx, 'virtboard-voice', { outputChannelCount: [1] })
    node.parameters.get('pitch').value = semis
    osc.connect(node).connect(ctx.destination)
    osc.start()
    const d = (await ctx.startRendering()).getChannelData(0)
    // Dominant frequency via autocorrelation over the second half (after the delay line fills).
    const x = d.subarray(24000, 40000)
    let best = 0, bestLag = 0
    for (let lag = 40; lag < 600; lag++) {
      let sum = 0
      for (let i = 0; i < 8000; i++) sum += x[i] * x[i + lag]
      if (sum > best) { best = sum; bestLag = lag }
    }
    return 48000 / bestLag
  }
  return [await measure(12), await measure(-12)]
})
check(Math.abs(freqs[0] - 440) < 15, `Pitch +12 st: 220 Hz → ${freqs[0].toFixed(1)} Hz`)
check(Math.abs(freqs[1] - 110) < 8, `Pitch −12 st: 220 Hz → ${freqs[1].toFixed(1)} Hz`)

await app.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll smoke checks passed')
process.exit(failures ? 1 : 0)
