// Synthesizes a handful of demo sound effects (WAV) so screenshots/tests have real audio.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SR = 44100
function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40)
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  samples.forEach((s, i) => buf.writeInt16LE(Math.round((s / (peak || 1)) * 0.89 * 32767), 44 + i * 2))
  return buf
}
const gen = (sec, fn) => Array.from({ length: Math.floor(sec * SR) }, (_, i) => fn(i / SR, i))
const env = (t, a, d, len) => Math.min(1, t / a) * Math.max(0, Math.min(1, (len - t) / d))
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5))
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1

export const DEMO = {
  'airhorn.wav': gen(2.2, (t) => {
    const v = 1 + 0.01 * Math.sin(t * 30)
    const e = env(t, 0.02, 0.1, 2.2) * (t % 0.75 < 0.62 ? 1 : 0.05)
    return e * [440, 554, 659].reduce((a, f) => a + saw(t * f * v), 0) * 0.4
  }),
  'vine-boom.wav': gen(1.6, (t) => {
    const f = 55 + 120 * Math.exp(-t * 18)
    return Math.tanh(4 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 2.4)) + rnd() * 0.3 * Math.exp(-t * 30)
  }),
  'sad-trombone.wav': (() => {
    const notes = [[311, 0.45], [294, 0.45], [277, 0.45], [262, 1.3]]
    const out = []
    for (const [f, d] of notes) out.push(...gen(d, (t) => env(t, 0.03, 0.12, d) * (saw(t * f * (1 + (d > 1 ? 0.02 * Math.sin(t * 36) : 0))) * 0.6 + Math.sin(2 * Math.PI * f * t) * 0.4)))
    return out
  })(),
  'applause.wav': gen(3.5, (t) => {
    let s = 0
    for (let k = 0; k < 3; k++) s += rnd() * (Math.random() < 0.004 ? 1 : 0.25)
    return s * env(t, 0.4, 1.4, 3.5)
  }),
  'laser.wav': gen(0.6, (t) => Math.sin(2 * Math.PI * (1800 * Math.exp(-t * 6) + 200) * t) * env(t, 0.005, 0.2, 0.6)),
  'drumroll.wav': gen(2.8, (t, i) => {
    const hit = (t * 22) % 1
    return (rnd() * 0.7 + Math.sin(2 * Math.PI * 180 * t) * 0.3) * Math.exp(-hit * 6) * (0.4 + t / 3) + (t > 2.5 ? Math.sin(2 * Math.PI * 90 * t) * Math.exp(-(t - 2.5) * 8) * 2 * rnd() : 0)
  }),
  'ding.wav': gen(1.8, (t) => (Math.sin(2 * Math.PI * 1318 * t) + 0.5 * Math.sin(2 * Math.PI * 2637 * t) + 0.2 * Math.sin(2 * Math.PI * 3951 * t)) * Math.exp(-t * 3)),
  'tada.wav': (() => {
    const out = gen(0.14, (t) => saw(t * 523) * env(t, 0.005, 0.03, 0.14) * 0.5)
    out.push(...gen(1.6, (t) => [523, 659, 784, 1046].reduce((a, f) => a + saw(t * f), 0) * env(t, 0.01, 0.9, 1.6) * 0.3))
    return out
  })(),
  'siren.wav': gen(3, (t) => Math.sin(2 * Math.PI * (700 * t + 250 * Math.sin(2 * Math.PI * 0.8 * t) / (2 * Math.PI * 0.8))) * env(t, 0.1, 0.4, 3)),
  'crickets.wav': gen(3, (t) => Math.sin(2 * Math.PI * 4400 * t) * (Math.sin(2 * Math.PI * 30 * t) > 0.3 ? 1 : 0) * ((t % 0.9) < 0.35 ? 1 : 0) * 0.5 + rnd() * 0.02),
  'bruh.wav': gen(0.9, (t) => {
    const f = 110 - 20 * t
    let s = 0
    for (let h = 1; h < 14; h++) s += Math.sin(2 * Math.PI * f * h * t) / h * (Math.abs(h * f - 700) < 250 ? 2.5 : 1)
    return s * env(t, 0.04, 0.35, 0.9)
  }),
  'rimshot.wav': (() => {
    const hit = (d, f) => gen(d, (t) => (rnd() * 0.6 + Math.sin(2 * Math.PI * f * t)) * Math.exp(-t * 25))
    return [...hit(0.25, 330), ...hit(0.22, 300), ...gen(1.2, (t) => (rnd() * 0.8 + Math.sin(2 * Math.PI * 5000 * t) * 0.2) * Math.exp(-t * 4))]
  })(),
  'coin.wav': (() => [...gen(0.08, (t) => Math.sign(Math.sin(2 * Math.PI * 988 * t)) * 0.4), ...gen(0.6, (t) => Math.sign(Math.sin(2 * Math.PI * 1319 * t)) * 0.4 * Math.exp(-t * 5))])(),
  'wow.wav': gen(1.3, (t) => {
    const f = 180 + 60 * Math.sin(Math.PI * t / 1.3)
    let s = 0
    for (let h = 1; h < 10; h++) s += Math.sin(2 * Math.PI * f * h * t) / h * (h * f > 500 + 900 * (t / 1.3) && h * f < 1100 + 900 * (t / 1.3) ? 3 : 0.6)
    return s * env(t, 0.08, 0.3, 1.3)
  }),
  'lofi-loop.wav': gen(4, (t) => {
    const beat = t % 0.5
    const kick = Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-beat * 30)) * beat) * Math.exp(-beat * 9) * ((Math.floor(t / 0.5) % 2) === 0 ? 1 : 0)
    const chord = [261, 329, 392, 493].reduce((a, f) => a + Math.sin(2 * Math.PI * f * (1 + 0.003 * Math.sin(t * 5)) * t), 0) * 0.12
    return kick + chord + rnd() * 0.02
  }),
  'boing.wav': gen(0.9, (t) => Math.sin(2 * Math.PI * (200 + 180 * Math.sin(t * 40) * Math.exp(-t * 3)) * t) * Math.exp(-t * 3)),
}

export function writeDemo(dir) {
  mkdirSync(dir, { recursive: true })
  for (const [name, samples] of Object.entries(DEMO)) writeFileSync(join(dir, name), wav(samples))
}

if (process.argv[1]?.endsWith('gen-demo-sounds.mjs')) {
  writeDemo(process.argv[2] ?? 'demo-sounds')
  console.log('demo sounds written')
}
