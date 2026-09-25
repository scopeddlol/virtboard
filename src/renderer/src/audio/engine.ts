import type { Settings, Sound, VoiceParams } from '@shared/types'
import { api } from '@/lib/api'
import { OutputRouter } from './outputs'
import { NEUTRAL } from '@/lib/defaults'

/**
 * Virtboard's audio graph (everything runs natively in Chromium's audio thread):
 *
 *   mic ─┬─► [voice worklet → filters → EQ → drive → echo/reverb] ─┐
 *        └─► bypass ────────────────────────────────────────────────┴► micVol ► mute ─┬─► per-output mic gates ─► independent virtual cable mixes
 *                                                                                     └─► monitor (optional)
 *   sounds ─► per-sound gain ─► soundsVol ─► per-output sound gates ─► independent virtual cable mixes
 *                          └──► local ─► monitor bus ─► 2nd AudioContext on your headphones
 */

export interface Instance {
  soundId: string
  startedAt: number
  length: number
  loop: boolean
  src: AudioBufferSourceNode
  gain: GainNode
}

type Listener = () => void
const dbToGain = (db: number) => Math.pow(10, db / 20)

function distortionCurve(amount: number) {
  if (amount <= 0) return null
  const k = amount * 60
  const n = 2048
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}

function impulse(ctx: BaseAudioContext, seconds: number) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  }
  return buf
}

export function computePeaks(buffer: AudioBuffer, count = 48) {
  const data = buffer.getChannelData(0)
  const block = Math.max(1, Math.floor(data.length / count))
  const peaks: number[] = []
  let max = 0
  for (let i = 0; i < count; i++) {
    let m = 0
    for (let j = i * block; j < Math.min(data.length, (i + 1) * block); j += 4) m = Math.max(m, Math.abs(data[j]))
    peaks.push(m)
    max = Math.max(max, m)
  }
  return peaks.map((p) => +(p / (max || 1)).toFixed(3))
}

class Engine {
  ctx!: AudioContext
  monitorCtx!: AudioContext
  private ready: Promise<void> | null = null

  // mic chain
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | null = null
  private fx!: {
    hp: BiquadFilterNode; lp: BiquadFilterNode; low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode
    shaper: WaveShaperNode; dry: GainNode; delay: DelayNode; feedback: GainNode; echo: GainNode
    convolver: ConvolverNode; reverb: GainNode; out: GainNode
  }
  private fxInput!: GainNode
  private bypass!: GainNode
  private voiceBus!: GainNode
  private micVol!: GainNode
  private mute!: GainNode
  private monitorVoice!: GainNode
  // sounds
  private soundsVol!: GainNode
  private localSounds!: GainNode
  private outputRouter!: OutputRouter
  private applying: Promise<void> = Promise.resolve()
  private monitorBus!: GainNode
  private monitorVol!: GainNode
  micAnalyser!: AnalyserNode
  soundsAnalyser!: AnalyserNode

  private buffers = new Map<string, AudioBuffer>()
  private loading = new Map<string, Promise<AudioBuffer>>()
  instances: Instance[] = []
  private listeners = new Set<Listener>()
  private settings: Settings | null = null
  private voiceParams: VoiceParams = NEUTRAL
  private reverbSize = 0
  private micKey = ''
  micError: string | null = null

  init() {
    if (this.ready) return this.ready
    this.ready = this.build()
    return this.ready
  }

  private async build() {
    const ctx = (this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 }))
    this.monitorCtx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 })
    await ctx.audioWorklet.addModule(new URL('voice-processor.js', document.baseURI).href)

    const g = (v = 1) => {
      const n = ctx.createGain()
      n.gain.value = v
      return n
    }
    this.monitorBus = g()
    this.fxInput = g()
    this.bypass = g()
    this.voiceBus = g()
    this.micVol = g()
    this.mute = g()
    this.monitorVoice = g(0)
    this.soundsVol = g()
    this.localSounds = g()
    this.micAnalyser = ctx.createAnalyser()
    this.micAnalyser.fftSize = 512
    this.micAnalyser.smoothingTimeConstant = 0.6
    this.soundsAnalyser = ctx.createAnalyser()
    this.soundsAnalyser.fftSize = 512

    // Voice FX chain
    const bq = (type: BiquadFilterType, freq: number, q = 0.707) => {
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      return f
    }
    this.worklet = new AudioWorkletNode(ctx, 'virtboard-voice', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] })
    const fx = (this.fx = {
      hp: bq('highpass', 20),
      lp: bq('lowpass', 20000),
      low: bq('lowshelf', 220),
      mid: bq('peaking', 1400, 0.9),
      high: bq('highshelf', 4200),
      shaper: ctx.createWaveShaper(),
      dry: g(),
      delay: ctx.createDelay(2),
      feedback: g(0.3),
      echo: g(0),
      convolver: ctx.createConvolver(),
      reverb: g(0),
      out: g(),
    })
    fx.shaper.oversample = '2x'
    this.fxInput.connect(this.worklet)
    this.worklet.connect(fx.hp).connect(fx.lp).connect(fx.low).connect(fx.mid).connect(fx.high).connect(fx.shaper)
    fx.shaper.connect(fx.dry).connect(fx.out)
    fx.shaper.connect(fx.delay)
    fx.delay.connect(fx.feedback).connect(fx.delay)
    fx.delay.connect(fx.echo).connect(fx.out)
    fx.shaper.connect(fx.convolver).connect(fx.reverb).connect(fx.out)
    fx.out.connect(this.voiceBus)
    this.bypass.connect(this.voiceBus)

    this.voiceBus.connect(this.micVol).connect(this.mute)
    this.mute.connect(this.micAnalyser)
    this.mute.connect(this.monitorVoice).connect(this.monitorBus)

    this.soundsVol.connect(this.soundsAnalyser)
    this.localSounds.connect(this.monitorBus)
    this.outputRouter = new OutputRouter(ctx, this.mute, this.soundsVol)
    await this.setSink(ctx, '')

    // Monitor path lives in a 2nd context so it can target a different output device.
    const bridge = ctx.createMediaStreamDestination()
    this.monitorBus.connect(bridge)
    this.monitorVol = this.monitorCtx.createGain()
    this.monitorCtx.createMediaStreamSource(bridge.stream).connect(this.monitorVol).connect(this.monitorCtx.destination)

    navigator.mediaDevices.addEventListener('devicechange', () => {
      if (this.settings) {
        this.outputRouter.muteAll()
        this.micKey = ''
        this.applySettings(this.settings)
      }
    })
    const resume = () => {
      if (ctx.state !== 'running') ctx.resume()
      if (this.monitorCtx.state !== 'running') this.monitorCtx.resume()
      this.outputRouter.resume()
    }
    document.addEventListener('pointerdown', resume)
    document.addEventListener('keydown', resume)
    resume()
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }
  private emit() {
    for (const fn of this.listeners) fn()
  }

  // ------------------------------------------------------------ devices ---

  private async setSink(ctx: AudioContext, id: string) {
    const c = ctx as AudioContext & { setSinkId?: (id: string | { type: 'none' }) => Promise<void>; sinkId?: string | object }
    if (!c.setSinkId) return
    try {
      if (!id) await c.setSinkId({ type: 'none' })
      else await c.setSinkId(id === 'default' ? '' : id)
    } catch (e) {
      console.warn('[virtboard] setSinkId failed', id, e)
    }
  }

  private async openMic(s: Settings) {
    const key = [s.inputDeviceId, s.noiseSuppression, s.echoCancellation].join('|')
    if (key === this.micKey) return
    this.micKey = key
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micSource?.disconnect()
    this.micSource = null
    try {
      const constraints: MediaTrackConstraints = {
        echoCancellation: s.echoCancellation,
        noiseSuppression: s.noiseSuppression,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 48000,
      }
      if (s.inputDeviceId && s.inputDeviceId !== 'default') constraints.deviceId = { ideal: s.inputDeviceId }
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
      this.micSource = this.ctx.createMediaStreamSource(this.micStream)
      this.micError = null
      this.routeVoice()
    } catch (e) {
      this.micError = e instanceof Error ? e.message : String(e)
      this.micKey = ''
      console.warn('[virtboard] microphone unavailable', e)
    }
    this.emit()
  }

  // ------------------------------------------------------------- voice ---

  /** Only feed the worklet while the voice changer is on → zero DSP cost when it's off. */
  private routeVoice() {
    if (!this.micSource || !this.settings) return
    const on = this.settings.voiceEnabled
    try {
      this.micSource.disconnect()
    } catch {
      /* not connected */
    }
    this.micSource.connect(on ? this.fxInput : this.bypass)
  }

  setVoiceParams(p: VoiceParams) {
    if (!this.worklet) return
    this.voiceParams = p
    const t = this.ctx.currentTime
    const set = (param: AudioParam, v: number) => param.setTargetAtTime(v, t, 0.02)
    const wp = this.worklet.parameters
    set(wp.get('pitch')!, p.pitch)
    set(wp.get('gate')!, p.gate)
    set(wp.get('robot')!, p.robot)
    set(wp.get('robotFreq')!, p.robotFreq)
    set(wp.get('crushBits')!, p.crushBits)
    set(wp.get('crushRate')!, p.crushRate)
    set(wp.get('tremolo')!, p.tremolo)
    set(wp.get('tremoloRate')!, p.tremoloRate)
    const fx = this.fx
    set(fx.hp.frequency, Math.max(20, p.lowCut))
    set(fx.lp.frequency, Math.min(20000, p.highCut))
    set(fx.low.gain, p.bass)
    set(fx.mid.gain, p.mid)
    set(fx.high.gain, p.treble)
    fx.shaper.curve = distortionCurve(p.distortion)
    set(fx.delay.delayTime, p.echoTime)
    set(fx.feedback.gain, Math.min(0.9, p.echoFeedback))
    set(fx.echo.gain, p.echoMix)
    set(fx.reverb.gain, p.reverbMix * 1.4)
    set(fx.dry.gain, 1 - Math.max(p.reverbMix, p.echoMix) * 0.45)
    // Distortion adds a lot of level; tame it automatically.
    set(fx.out.gain, dbToGain(p.gain) * (1 - p.distortion * 0.5))
    if (p.reverbMix > 0 && Math.abs(p.reverbSize - this.reverbSize) > 0.05) {
      this.reverbSize = p.reverbSize
      fx.convolver.buffer = impulse(this.ctx, p.reverbSize)
    }
  }

  // ---------------------------------------------------------- settings ---

  get outputErrors() { return this.outputRouter?.errors ?? {} }

  applySettings(s: Settings) {
    const next = this.applying.then(() => this.applySettingsNow(s))
    this.applying = next.catch((e) => console.warn('[virtboard] settings failed', e))
    return this.applying
  }

  private async applySettingsNow(s: Settings) {
    await this.init()
    const prev = this.settings
    this.settings = s
    const t = this.ctx.currentTime
    this.micVol.gain.setTargetAtTime(s.micVolume, t, 0.02)
    this.mute.gain.setTargetAtTime(s.micMuted ? 0 : 1, t, 0.01)
    this.soundsVol.gain.setTargetAtTime(s.soundsVolume, t, 0.02)
    this.localSounds.gain.setTargetAtTime(s.monitorSounds ? 1 : 0, t, 0.02)
    this.monitorVoice.gain.setTargetAtTime(s.monitorVoice ? 1 : 0, t, 0.02)
    this.monitorVol.gain.setTargetAtTime(s.monitorVolume, this.monitorCtx.currentTime, 0.02)
    await this.outputRouter.apply(s.outputs)
    this.emit()
    if (!prev || prev.monitorDeviceId !== s.monitorDeviceId) await this.setSink(this.monitorCtx, s.monitorDeviceId || 'default')
    if (!prev || prev.voiceEnabled !== s.voiceEnabled) this.routeVoice()
    await this.openMic(s)
  }

  // ------------------------------------------------------------ sounds ---

  async decode(bytes: ArrayBuffer) {
    await this.init()
    return this.ctx.decodeAudioData(bytes)
  }

  getBuffer(sound: Pick<Sound, 'file'>) {
    const cached = this.buffers.get(sound.file)
    if (cached) return Promise.resolve(cached)
    let p = this.loading.get(sound.file)
    if (!p) {
      p = api
        .readSound(sound.file)
        .then((bytes) => this.decode(bytes))
        .then((buf) => {
          this.buffers.set(sound.file, buf)
          this.loading.delete(sound.file)
          return buf
        })
        .catch((e) => {
          this.loading.delete(sound.file)
          throw e
        })
      this.loading.set(sound.file, p)
    }
    return p
  }

  /** Warm the decode cache for a page so the first press is instant. */
  preload(sounds: Sound[]) {
    for (const s of sounds) this.getBuffer(s).catch(() => {})
  }

  isPlaying(id: string) {
    return this.instances.some((i) => i.soundId === id)
  }

  async play(sound: Sound, opts: { localOnly?: boolean } = {}) {
    await this.init()
    if (sound.mode === 'toggle' && this.isPlaying(sound.id)) return this.stop(sound.id)
    if (sound.mode === 'restart') this.stop(sound.id, 0.015)
    const buffer = await this.getBuffer(sound)
    const ctx = this.ctx
    if (ctx.state !== 'running') await ctx.resume()
    const start = Math.min(sound.trimStart, buffer.duration - 0.01)
    const end = Math.min(sound.trimEnd ?? buffer.duration, buffer.duration)
    const span = Math.max(0.01, end - start)
    const rate = sound.rate || 1
    const length = span / rate

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    const gain = ctx.createGain()
    const t = ctx.currentTime + 0.005
    const vol = sound.volume
    if (sound.fadeIn > 0) {
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(vol, t + Math.min(sound.fadeIn, length))
    } else gain.gain.setValueAtTime(vol, t)
    if (!sound.loop && sound.fadeOut > 0) {
      const fo = Math.min(sound.fadeOut, length)
      gain.gain.setValueAtTime(vol, t + length - fo)
      gain.gain.linearRampToValueAtTime(0, t + length)
    }
    src.connect(gain)
    if (opts.localOnly) {
      gain.connect(this.monitorBus)
    } else {
      gain.connect(this.soundsVol)
      if (sound.localPlayback) gain.connect(this.localSounds)
    }
    if (sound.loop) {
      src.loop = true
      src.loopStart = start
      src.loopEnd = end
      src.start(t, start)
    } else src.start(t, start, span)

    const inst: Instance = { soundId: sound.id, startedAt: t, length, loop: sound.loop, src, gain }
    this.instances.push(inst)
    src.onended = () => {
      this.instances = this.instances.filter((i) => i !== inst)
      gain.disconnect()
      this.emit()
    }
    this.emit()
  }

  stop(soundId?: string, fade = 0.04) {
    const t = this.ctx?.currentTime ?? 0
    for (const inst of this.instances) {
      if (soundId && inst.soundId !== soundId) continue
      inst.gain.gain.cancelScheduledValues(t)
      inst.gain.gain.setValueAtTime(inst.gain.gain.value, t)
      inst.gain.gain.linearRampToValueAtTime(0, t + fade)
      try {
        inst.src.stop(t + fade + 0.01)
      } catch {
        /* already stopped */
      }
    }
    if (soundId) this.instances = this.instances.filter((i) => i.soundId !== soundId)
    else this.instances = []
    this.emit()
  }

  /** 0..1 progress of the most recent instance of a sound (or -1 when idle). */
  progress(soundId: string) {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const inst = this.instances[i]
      if (inst.soundId !== soundId) continue
      const el = this.ctx.currentTime - inst.startedAt
      return inst.loop ? (el % inst.length) / inst.length : Math.min(1, Math.max(0, el / inst.length))
    }
    return -1
  }

  forget(file: string) {
    this.buffers.delete(file)
  }

  level(analyser: AnalyserNode | undefined, buf: Float32Array<ArrayBuffer>) {
    if (!analyser) return 0
    analyser.getFloatTimeDomainData(buf)
    let peak = 0
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]))
    return peak
  }

  /** Render a sound with its trim / fades / speed baked in (for WAV export). */
  async renderTrimmed(sound: Sound) {
    const buffer = await this.getBuffer(sound)
    const start = sound.trimStart
    const end = Math.min(sound.trimEnd ?? buffer.duration, buffer.duration)
    const length = (end - start) / sound.rate
    const off = new OfflineAudioContext(buffer.numberOfChannels, Math.ceil(length * buffer.sampleRate), buffer.sampleRate)
    const src = off.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = sound.rate
    const g = off.createGain()
    g.gain.setValueAtTime(sound.fadeIn > 0 ? 0 : sound.volume, 0)
    if (sound.fadeIn > 0) g.gain.linearRampToValueAtTime(sound.volume, sound.fadeIn)
    if (sound.fadeOut > 0) {
      g.gain.setValueAtTime(sound.volume, Math.max(0, length - sound.fadeOut))
      g.gain.linearRampToValueAtTime(0, length)
    }
    src.connect(g).connect(off.destination)
    src.start(0, start, end - start)
    return off.startRendering()
  }

  get currentVoice() {
    return this.voiceParams
  }
}

export const engine = new Engine()
