import type { VirtualOutput } from '@shared/types'

interface Route {
  ctx: AudioContext
  bridge: MediaStreamAudioDestinationNode
  mic: GainNode
  sounds: GainNode
  source: MediaStreamAudioSourceNode
  deviceId: string
}

/** Independent mixes; no route is audible until its exact device is selected. */
export class OutputRouter {
  private routes = new Map<string, Route>()
  private generation = 0
  errors: Record<string, string> = {}

  constructor(private ctx: AudioContext, private mic: AudioNode, private sounds: AudioNode) {}

  muteAll() {
    this.generation++
    for (const r of this.routes.values()) {
      r.mic.gain.value = 0
      r.sounds.gain.value = 0
      r.source.disconnect()
      r.deviceId = '' // Revalidate after device changes, even if the ID is unchanged.
    }
  }

  resume() {
    for (const r of this.routes.values()) if (r.ctx.state === 'suspended') void r.ctx.resume()
  }

  async apply(outputs: VirtualOutput[]) {
    const generation = this.generation
    this.errors = {}
    for (const [id, r] of this.routes) {
      if (outputs.some((o) => o.id === id)) continue
      this.mic.disconnect(r.mic)
      this.sounds.disconnect(r.sounds)
      r.mic.disconnect()
      r.sounds.disconnect()
      r.source.disconnect()
      r.bridge.stream.getTracks().forEach((t) => t.stop())
      await r.ctx.close()
      this.routes.delete(id)
    }
    let devices: MediaDeviceInfo[]
    try { devices = await navigator.mediaDevices.enumerateDevices() }
    catch {
      this.muteAll()
      for (const o of outputs) if (o.deviceId) this.errors[o.id] = 'Audio devices unavailable. Check device permissions.'
      return
    }
    if (generation !== this.generation) return
    const used = new Set<string>()
    for (const o of outputs) {
      if (generation !== this.generation) return
      let r = this.routes.get(o.id)
      // Reject default-device aliases, missing devices and duplicate destinations.
      // A default-device fallback could send the game mix into the voice-chat cable.
      const device = devices.find((d) => d.kind === 'audiooutput' && d.deviceId === o.deviceId)
      const valid = !!device && !['default', 'communications'].includes(o.deviceId) && !used.has(o.deviceId)
      if (!valid || !o.deviceId) {
        if (r) { r.mic.gain.value = 0; r.sounds.gain.value = 0; r.source.disconnect(); r.deviceId = '' }
        if (o.deviceId) this.errors[o.id] = used.has(o.deviceId) ? 'Choose a different device for each output.' : 'Output unavailable. Choose a connected device.'
        continue
      }
      used.add(o.deviceId)
      if (!r) {
        const ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 })
        const bridge = this.ctx.createMediaStreamDestination()
        const mic = this.ctx.createGain()
        const sounds = this.ctx.createGain()
        mic.gain.value = 0
        sounds.gain.value = 0
        this.mic.connect(mic).connect(bridge)
        this.sounds.connect(sounds).connect(bridge)
        const source = ctx.createMediaStreamSource(bridge.stream)
        r = { ctx, bridge, mic, sounds, source, deviceId: '' }
        this.routes.set(o.id, r)
      }
      if (r.deviceId !== o.deviceId) {
        r.mic.gain.value = 0
        r.sounds.gain.value = 0
        r.source.disconnect()
        try {
          await (r.ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(o.deviceId)
          if (generation !== this.generation) return
          r.source.connect(r.ctx.destination)
          r.deviceId = o.deviceId
        } catch {
          this.errors[o.id] = 'Could not open this output. Reconnect it or choose another device.'
          r.deviceId = ''
          continue
        }
      }
      // Immediate silence when muted, including currently playing sounds.
      r.mic.gain.value = o.micMuted ? 0 : 1
      r.sounds.gain.value = o.soundsMuted ? 0 : 1
      if (r.ctx.state === 'suspended') void r.ctx.resume().catch(() => { r.mic.gain.value = 0; r.sounds.gain.value = 0 })
    }
  }
}
