import { _electron as electron } from 'playwright'
import { createWebsite } from '../website/server.mjs'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
mkdirSync('out/qa', { recursive: true })
const server = createWebsite({ dataDir: 'out/qa/empty-data' })
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const app = await electron.launch({ env: { ...process.env, VIRTBOARD_PREVIEW_URL: `http://127.0.0.1:${server.address().port}` }, args: [resolve('scripts/website-preview.cjs'), '--no-sandbox', '--disable-gpu'] })
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.waitForLoadState('networkidle')
  for (const img of await page.locator('img[loading=lazy]').all()) await img.scrollIntoViewIfNeeded()
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'out/qa/website-desktop.png', fullPage: true })
  assert.match(await page.title(), /Virtboard/)
  assert.equal(await page.locator('img').evaluateAll((images) => images.every((i) => i.complete && i.naturalWidth > 0)), true)
  assert.equal(await page.locator('.download-link').first().getAttribute('aria-disabled'), 'true')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(390, 844))
  await page.screenshot({ path: 'out/qa/website-mobile.png', fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  assert.deepEqual(errors, [])
  console.log('Desktop/mobile website checks passed; screenshots saved to out/qa')
} finally { await app.close(); await new Promise((resolve) => server.close(resolve)) }
