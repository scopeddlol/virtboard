// Virtboard real-time voice DSP (runs on the audio thread).
// Chain: noise gate → pitch shifter → ring modulator ("robot") → bitcrusher → tremolo.
// Everything else (EQ, filters, distortion, echo, reverb) uses native Web Audio nodes.

const TAU = Math.PI * 2

class VoiceProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const k = 'k-rate'
    return [
      { name: 'pitch', defaultValue: 0, minValue: -24, maxValue: 24, automationRate: k },
      { name: 'gate', defaultValue: -100, minValue: -100, maxValue: 0, automationRate: k },
      { name: 'robot', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: k },
      { name: 'robotFreq', defaultValue: 90, minValue: 10, maxValue: 2000, automationRate: k },
      { name: 'crushBits', defaultValue: 16, minValue: 1, maxValue: 16, automationRate: k },
      { name: 'crushRate', defaultValue: 1, minValue: 1, maxValue: 50, automationRate: k },
      { name: 'tremolo', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: k },
      { name: 'tremoloRate', defaultValue: 5, minValue: 0.1, maxValue: 30, automationRate: k },
    ]
  }

  constructor() {
    super()
    // Pitch shifter: two crossfaded read heads sweeping a delay line (granular / "delay-line" shifter).
    this.win = Math.round(sampleRate * 0.042)
    let size = 1
    while (size < this.win * 2 + 8) size <<= 1
    this.buf = new Float32Array(size)
    this.mask = size - 1
    this.w = 0
    this.phase = 0
    // Gate
    this.env = 0
    this.gateGain = 1
    this.release = Math.exp(-1 / (0.12 * sampleRate))
    this.gateAttack = 1 / (0.004 * sampleRate)
    this.gateRelease = 1 / (0.08 * sampleRate)
    // Modulators
    this.ring = 0
    this.trem = 0
    // Crusher sample & hold
    this.hold = 0
    this.holdCount = 0
  }

  read(pos) {
    const i = Math.floor(pos)
    const f = pos - i
    const m = this.mask
    return this.buf[i & m] * (1 - f) + this.buf[(i + 1) & m] * f
  }

  process(inputs, outputs, p) {
    const out = outputs[0] && outputs[0][0]
    if (!out) return true
    const input = inputs[0]
    const n = out.length
    if (!input || input.length === 0) {
      out.fill(0)
      return true
    }
    const chs = input.length
    const semis = p.pitch[0]
    const ratio = Math.pow(2, semis / 12)
    const shifting = Math.abs(semis) > 0.01
    const step = (1 - ratio) / this.win
    const gateOn = p.gate[0] > -99
    const thr = Math.pow(10, p.gate[0] / 20)
    const robot = p.robot[0]
    const ringInc = p.robotFreq[0] / sampleRate
    const bits = p.crushBits[0]
    const levels = Math.pow(2, bits - 1)
    const crushRate = Math.max(1, Math.round(p.crushRate[0]))
    const trem = p.tremolo[0]
    const tremInc = p.tremoloRate[0] / sampleRate
    const buf = this.buf
    const mask = this.mask
    const win = this.win

    for (let i = 0; i < n; i++) {
      let x = input[0][i]
      if (chs > 1) x = (x + input[1][i]) * 0.5

      if (gateOn) {
        const a = x < 0 ? -x : x
        this.env = a > this.env ? a : this.env * this.release
        const target = this.env > thr ? 1 : 0
        if (this.gateGain < target) this.gateGain = Math.min(1, this.gateGain + this.gateAttack)
        else if (this.gateGain > target) this.gateGain = Math.max(0, this.gateGain - this.gateRelease)
        x *= this.gateGain
      }

      buf[this.w] = x
      let y = x
      if (shifting) {
        let ph = this.phase + step
        ph -= Math.floor(ph)
        this.phase = ph
        let ph2 = ph + 0.5
        if (ph2 >= 1) ph2 -= 1
        const s1 = Math.sin(Math.PI * ph)
        const s2 = Math.sin(Math.PI * ph2)
        y = this.read(this.w - ph * win) * s1 * s1 + this.read(this.w - ph2 * win) * s2 * s2
      }
      this.w = (this.w + 1) & mask

      if (robot > 0) {
        this.ring += ringInc
        if (this.ring >= 1) this.ring -= 1
        y = y * (1 - robot) + y * robot * Math.sin(TAU * this.ring) * 1.4
      }

      if (bits < 16 || crushRate > 1) {
        if (this.holdCount <= 0) {
          this.hold = bits < 16 ? Math.round(y * levels) / levels : y
          this.holdCount = crushRate
        }
        this.holdCount--
        y = this.hold
      }

      if (trem > 0) {
        this.trem += tremInc
        if (this.trem >= 1) this.trem -= 1
        y *= 1 - trem * (0.5 + 0.5 * Math.sin(TAU * this.trem))
      }

      out[i] = y
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out)
    return true
  }
}

registerProcessor('virtboard-voice', VoiceProcessor)
