// Records an animated demo GIF of the soundboard + voice changer (needs ImageMagick).
// Linux: `npm run build:fast && xvfb-run -a node scripts/demo-gif.mjs`
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './e2e.mjs'

const FRAMES = '.screenshot-data/frames'
rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
const { app, page } = await launch()
let n = 0
const grab = async (count, gap = 70) => {
  for (let i = 0; i < count; i++) {
    await page.screenshot({ path: join(FRAMES, `f${String(n++).padStart(4, '0')}.png`) })
    await page.waitForTimeout(gap)
  }
}
await grab(4)
for (const name of ['Air Horn', 'Vine Boom', 'Wow', 'Pew Pew']) {
  await page.getByText(name, { exact: true }).click()
  await grab(6)
}
await page.getByText('Stream alerts').first().click()
await grab(3)
await page.getByText('New Follower').click()
await grab(7)
await page.getByRole('button', { name: 'Voice Changer', exact: true }).click()
await grab(3)
for (const p of ['Robot', 'Demon', 'Chipmunk']) {
  await page.getByText(p, { exact: true }).first().click()
  await grab(6)
}
await app.close()
execFileSync('convert', [
  '-delay', '9', '-loop', '0', `${FRAMES}/f*.png`,
  '-resize', '960x', '-fuzz', '2%', '-layers', 'Optimize', '-colors', '192',
  'docs/demo.gif',
])
console.log('docs/demo.gif written')
