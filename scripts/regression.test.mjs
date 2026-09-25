import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

globalThis.window = { virtboard: {} }
const result = await build({
  stdin: { contents: `export { defaultState, migrate } from './src/renderer/src/lib/defaults'; export { useStore } from './src/renderer/src/state/store'; export { OutputRouter } from './src/renderer/src/audio/outputs'; export { findConflict } from './src/renderer/src/lib/conflicts';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm',
})
const { defaultState, migrate, useStore, OutputRouter, findConflict } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text + '\n//# sourceURL=virtboard-regression-bundle.mjs').toString('base64')}`)

test('legacy output migrates, game mic starts muted, and saved output choices survive', () => {
  const old = structuredClone(defaultState())
  delete old.settings.outputs
  delete old.settings.zoomFactor
  old.settings.virtualDeviceId = 'old-cable'
  old.settings.virtualDeviceLabel = 'My cable'
  delete old.pages[0].defaultMode
  const migrated = migrate(old)
  assert.equal(migrated.settings.outputs[0].deviceId, 'old-cable')
  assert.equal(migrated.settings.outputs[1].micMuted, true)
  assert.equal(migrated.settings.zoomFactor, 1)
  assert.equal(migrated.pages[0].defaultMode, 'restart')
  migrated.settings.outputs[0].deviceId = ''
  assert.equal(migrate(migrated).settings.outputs[0].deviceId, '')
  assert.deepEqual(migrate({ ...migrated, settings: { ...migrated.settings, outputs: [] } }).settings.outputs, [])
})

test('page defaults apply to new imports while existing sounds and other pages retain their modes', () => {
  useStore.setState(defaultState())
  const s = () => useStore.getState()
  const page = s().activePageId
  const sound = { file: 'test.wav', name: 'Test', duration: 1, peaks: [1] }
  s().addSounds([sound])
  s().updatePage(page, { defaultMode: 'overlap' })
  s().addSounds([sound])
  assert.deepEqual(s().sounds.map((x) => x.mode), ['restart', 'overlap'])
  s().updatePage(page, { defaultMode: 'toggle' })
  s().addSounds([sound])
  assert.equal(s().sounds[2].mode, 'toggle')
  s().addPage()
  s().addSounds([sound])
  assert.equal(s().sounds[3].mode, 'restart')
  assert.equal(migrate(JSON.parse(JSON.stringify(s()))).pages[0].defaultMode, 'toggle')
})

test('per-output toggle actions and keybind conflicts stay independent', () => {
  useStore.setState(defaultState())
  const s = () => useStore.getState()
  s().toggleOutput('game-chat', 'micMuted')
  s().toggleOutput('voice-chat', 'soundsMuted')
  assert.equal(s().settings.outputs[0].micMuted, false)
  assert.equal(s().settings.outputs[1].micMuted, false)
  assert.equal(s().settings.outputs[0].soundsMuted, true)
  assert.equal(s().settings.outputs[1].soundsMuted, false)
  s().updateOutput('game-chat', { micHotkey: 'Ctrl+Shift+G' })
  assert.match(findConflict(s(), 'Ctrl+Shift+G', {}), /Game Chat microphone/)
  assert.equal(findConflict(s(), 'Ctrl+Shift+G', { output: 'game-chat:micHotkey' }), null)
})

class Node {
  connections = new Set()
  gain = { value: 1 }
  connect(n) { this.connections.add(n); return n }
  disconnect(n) { if (n) this.connections.delete(n); else this.connections.clear() }
}
class Context {
  static all = []
  state = 'running'
  destination = new Node()
  constructor() { Context.all.push(this) }
  createGain() { return new Node() }
  createMediaStreamDestination() { const n = new Node(); n.stream = { getTracks: () => [{ stop() {} }] }; return n }
  createMediaStreamSource(stream) { const n = new Node(); n.stream = stream; return n }
  async setSinkId(id) { if (id === 'broken') throw new Error('Unavailable'); this.sinkId = id }
  async close() { this.state = 'closed' }
  async resume() { this.state = 'running' }
}

test('audio graph separates mic/sounds, mutes active streams, fails closed, and releases removed routes', async () => {
  globalThis.AudioContext = Context
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { enumerateDevices: async () => ['voice', 'game', 'broken', 'default'].map((deviceId) => ({ deviceId, kind: 'audiooutput' })) } } })
  const ctx = new Context(), mic = new Node(), sounds = new Node()
  const router = new OutputRouter(ctx, mic, sounds)
  let outputs = defaultState().settings.outputs.map((o, i) => ({ ...o, deviceId: i ? 'game' : 'voice', soundsMuted: !i }))
  await router.apply(outputs)
  const [voiceMic, gameMic] = [...mic.connections], [voiceSounds, gameSounds] = [...sounds.connections]
  assert.equal(voiceMic.gain.value, 1)
  assert.equal(voiceSounds.gain.value, 0)
  assert.equal(gameMic.gain.value, 0)
  assert.equal(gameSounds.gain.value, 1)
  assert.notEqual([...voiceMic.connections][0], [...gameMic.connections][0])
  assert.equal([...voiceMic.connections][0], [...voiceSounds.connections][0])
  assert.equal(Context.all[1].sinkId, 'voice')
  assert.equal(Context.all[2].sinkId, 'game')
  outputs = outputs.map((o) => ({ ...o, micMuted: true, soundsMuted: true }))
  await router.apply(outputs)
  assert.ok([...mic.connections, ...sounds.connections].every((n) => n.gain.value === 0))
  await router.apply([{ ...outputs[0], deviceId: 'broken', micMuted: false, soundsMuted: false }, outputs[1]])
  assert.equal(voiceMic.gain.value, 0)
  assert.match(router.errors['voice-chat'], /Could not open/)
  await router.apply([{ ...outputs[0], micMuted: false }, { ...outputs[1], deviceId: 'voice', micMuted: false }])
  assert.equal(gameMic.gain.value, 0)
  assert.match(router.errors['game-chat'], /different device/)
  await router.apply([{ ...outputs[0], deviceId: 'missing', micMuted: false }, outputs[1]])
  assert.equal(voiceMic.gain.value, 0)
  assert.match(router.errors['voice-chat'], /unavailable/)
  await router.apply([{ ...outputs[0], deviceId: 'default', micMuted: false }, outputs[1]])
  assert.equal(voiceMic.gain.value, 0)
  router.muteAll()
  assert.ok([...mic.connections, ...sounds.connections].every((n) => n.gain.value === 0))
  const enumerate = navigator.mediaDevices.enumerateDevices
  navigator.mediaDevices.enumerateDevices = async () => { throw new Error('permission revoked') }
  await router.apply(outputs)
  assert.ok([...mic.connections, ...sounds.connections].every((n) => n.gain.value === 0))
  navigator.mediaDevices.enumerateDevices = enumerate
  const originalSink = Context.prototype.setSinkId
  let finishSwitch
  Context.prototype.setSinkId = async function(id) { await new Promise((resolve) => { finishSwitch = resolve }); this.sinkId = id }
  const switching = router.apply([{ ...outputs[0], micMuted: false, soundsMuted: false }])
  await new Promise((resolve) => setImmediate(resolve))
  router.muteAll()
  finishSwitch()
  await switching
  assert.ok([...mic.connections, ...sounds.connections].every((n) => n.gain.value === 0), 'A device disconnect during sink selection cannot re-enable an old route')
  Context.prototype.setSinkId = originalSink
  await router.apply([])
  assert.equal(mic.connections.size, 0)
  assert.equal(sounds.connections.size, 0)
  assert.ok(Context.all.slice(1).every((c) => c.state === 'closed'))
})
