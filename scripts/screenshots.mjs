// Drives the real Electron app with Playwright to capture README screenshots.
// Linux: `npm run build:fast && xvfb-run -a node scripts/screenshots.mjs`
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './e2e.mjs'

const OUT = resolve('docs/screenshots')
mkdirSync(OUT, { recursive: true })

const shot = async (page, name) => {
  await page.waitForTimeout(450)
  await page.screenshot({ path: join(OUT, name) })
  console.log('📸', name)
}

// ---- Fresh install: welcome dialog --------------------------------------
{
  const { app, page } = await launch({ onboarded: false })
  await shot(page, '08-welcome.png')
  await app.close()
}

const { app, page } = await launch()

// Soundboard with a couple of sounds playing
await page.getByText('Vine Boom').click()
await page.waitForTimeout(250)
await page.getByText('Air Horn').click()
await page.waitForTimeout(350)
await shot(page, '01-soundboard.png')
await page.waitForTimeout(2500)

// Hover state
await page.getByText('Sad Trombone').hover()
await shot(page, '02-pad-hover.png')

// Context menu
await page.getByText('Wow', { exact: true }).click({ button: 'right' })
await page.waitForTimeout(200)
await page.getByText('Copy to page').hover()
await shot(page, '03-context-menu.png')
await page.keyboard.press('Escape')
await page.keyboard.press('Escape')

// Trimmer
await page.getByText('Air Horn').click({ button: 'right' })
await page.getByText('Edit, trim & keybind').click()
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Preview' }).click()
await page.waitForTimeout(500)
await shot(page, '04-trimmer.png')
await page.getByRole('button', { name: 'Cancel' }).click()

// Another page
await page.getByText('Stream alerts').first().click()
await page.waitForTimeout(400)
await page.getByText('New Follower').click()
await page.waitForTimeout(300)
await shot(page, '05-pages.png')

// Page settings
await page.locator('h1 + button').click()
await shot(page, '06-page-settings.png')
await page.keyboard.press('Escape')

// Voice changer
await page.getByText('Voice Changer', { exact: true }).click()
await page.waitForTimeout(400)
await page.getByText('Robot', { exact: true }).first().click()
await page.waitForTimeout(1500)
await shot(page, '07-voice-changer.png')

// Custom preset editor
await page.getByText('Customize a copy of').click()
await page.waitForTimeout(600)
await shot(page, '09-custom-preset.png')

// Settings
await page.getByText('Settings', { exact: true }).first().click()
await page.waitForTimeout(700)
await shot(page, '10-settings-audio.png')
await page.getByText('Virtual mic output').locator('..').locator('button').click()
await shot(page, '11-device-picker.png')
await page.keyboard.press('Escape')
await page.getByText('Global hotkeys').scrollIntoViewIfNeeded()
await page.evaluate(() => document.querySelector('.overflow-y-auto')?.scrollBy(0, 120))
await page.getByText('Toggle voice changer', { exact: true }).locator('xpath=../..').locator('button').first().click()
await shot(page, '12-hotkeys.png')
await page.keyboard.press('Escape')
await page.getByText('Appearance').scrollIntoViewIfNeeded()
await page.getByText('Ocean').click()
await page.waitForTimeout(300)
await shot(page, '13-appearance.png')

// Accent themes on the soundboard
for (const [name, file] of [['Magenta', '14-theme-magenta.png'], ['Lime', '15-theme-lime.png']]) {
  await page.getByText(name, { exact: true }).click()
  await page.getByRole('button', { name: 'Soundboard' }).click()
  await page.getByText('Memes').first().click()
  await page.waitForTimeout(300)
  await page.getByText('Bruh').click()
  await page.waitForTimeout(200)
  await shot(page, file)
  await page.getByText('Settings', { exact: true }).first().click()
  await page.waitForTimeout(400)
  await page.getByText('Appearance').scrollIntoViewIfNeeded()
}
await page.getByText('Violet', { exact: true }).click()

// Empty page
await page.getByText('Gaming').first().click()
await page.waitForTimeout(900)
await shot(page, '16-empty-page.png')

await app.close()
console.log('done')
