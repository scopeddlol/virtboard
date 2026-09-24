// Generates every icon & installer asset from the vector logo.
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { writeFileSync, mkdirSync } from 'node:fs'
import { logoSvg } from './logo.mjs'

const png = (size, opts) => sharp(Buffer.from(logoSvg({ size, ...opts }))).png().toBuffer()

// 24-bit BMP encoder (NSIS installer images must be BMP).
function bmp({ data, info }) {
  const { width: w, height: h, channels } = info
  const rowSize = Math.ceil((w * 3) / 4) * 4
  const buf = Buffer.alloc(54 + rowSize * h)
  buf.write('BM', 0); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14); buf.writeInt32LE(w, 18); buf.writeInt32LE(h, 22)
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(rowSize * h, 34)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * channels
      const di = 54 + (h - 1 - y) * rowSize + x * 3
      buf[di] = data[si + 2]; buf[di + 1] = data[si + 1]; buf[di + 2] = data[si]
    }
  }
  return buf
}

mkdirSync('build', { recursive: true })
mkdirSync('resources', { recursive: true })
mkdirSync('docs', { recursive: true })

writeFileSync('build/icon.png', await png(1024))
writeFileSync('resources/icon.png', await png(256))
writeFileSync('src/renderer/public/logo.svg', logoSvg({ size: 256 }))
writeFileSync('docs/logo.svg', logoSvg({ size: 256 }))
const ico = await pngToIco(await Promise.all([16, 24, 32, 48, 64, 128, 256].map((s) => png(s))))
writeFileSync('build/icon.ico', ico)
writeFileSync('resources/icon.ico', ico)

// Tray icons (normal + "muted" variant with a red dot).
const trayMuted = (size) => sharp(Buffer.from(logoSvg({ size }).replace('</svg>',
  `<circle cx="${size * 0.8}" cy="${size * 0.8}" r="${size * 0.2}" fill="#dc2626" stroke="#111113" stroke-width="${size * 0.06}"/></svg>`))).png().toBuffer()
writeFileSync('resources/tray-muted.ico', await pngToIco(await Promise.all([16, 24, 32, 48].map(trayMuted))))
writeFileSync('resources/tray-muted.png', await trayMuted(32))
writeFileSync('resources/tray.png', await png(32))

// NSIS artwork -------------------------------------------------------------
const sidebarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314">
  <rect width="164" height="314" fill="#111113"/>
  <text x="82" y="168" text-anchor="middle" font-family="Segoe UI, DejaVu Sans, sans-serif" font-weight="600" font-size="20" fill="#f4f4f5">Virtboard</text>
  <text x="82" y="188" text-anchor="middle" font-family="Segoe UI, DejaVu Sans, sans-serif" font-size="10.5" fill="#a1a1aa">Soundboard &amp; voice changer</text>
</svg>`
const sidebar = await sharp(Buffer.from(sidebarSvg))
  .composite([{ input: await png(64), left: 50, top: 70 }])
  .removeAlpha().raw().toBuffer({ resolveWithObject: true })
writeFileSync('build/installerSidebar.bmp', bmp(sidebar))
writeFileSync('build/uninstallerSidebar.bmp', bmp(sidebar))

const headerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57"><rect width="150" height="57" fill="#ffffff"/></svg>`
const header = await sharp(Buffer.from(headerSvg))
  .composite([{ input: await png(36), left: 106, top: 10 }])
  .removeAlpha().raw().toBuffer({ resolveWithObject: true })
writeFileSync('build/installerHeader.bmp', bmp(header))

// README banner
const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="320">
  <rect width="1280" height="320" fill="#111113"/>
  <text x="640" y="236" text-anchor="middle" font-family="Inter, DejaVu Sans, sans-serif" font-weight="600" font-size="56" fill="#f4f4f5">Virtboard</text>
  <text x="640" y="276" text-anchor="middle" font-family="Inter, DejaVu Sans, sans-serif" font-size="22" fill="#a1a1aa">Soundboard &amp; voice changer for Windows</text>
</svg>`
await sharp(Buffer.from(bannerSvg)).composite([{ input: await png(112), left: 584, top: 50 }]).png().toFile('docs/banner.png')
console.log('icons generated')
