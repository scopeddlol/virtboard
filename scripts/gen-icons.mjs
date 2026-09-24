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
  `<circle cx="${size * 0.8}" cy="${size * 0.8}" r="${size * 0.2}" fill="#EF4444" stroke="#fff" stroke-width="${size * 0.05}"/></svg>`))).png().toBuffer()
writeFileSync('resources/tray-muted.ico', await pngToIco(await Promise.all([16, 24, 32, 48].map(trayMuted))))
writeFileSync('resources/tray-muted.png', await trayMuted(32))
writeFileSync('resources/tray.png', await png(32))

// NSIS artwork -------------------------------------------------------------
const bars = Array.from({ length: 26 }, (_, i) => {
  const h = 20 + Math.abs(Math.sin(i * 1.7) * 60) + Math.abs(Math.cos(i * 0.6) * 30)
  return `<rect x="${8 + i * 6}" y="${262 - h / 2}" width="3" height="${h}" rx="1.5" fill="#fff" opacity="${0.1 + (i % 5) * 0.05}"/>`
}).join('')
const sidebarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#1a1033"/><stop offset="0.55" stop-color="#4c1d95"/><stop offset="1" stop-color="#db2777"/></linearGradient>
    <radialGradient id="r" cx="0.5" cy="0.25" r="0.6"><stop offset="0" stop-color="#a78bfa" stop-opacity="0.55"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="164" height="314" fill="url(#g)"/><rect width="164" height="314" fill="url(#r)"/>
  ${bars}
  <text x="82" y="172" text-anchor="middle" font-family="Segoe UI, DejaVu Sans, sans-serif" font-weight="800" font-size="24" fill="#fff">Virtboard</text>
  <text x="82" y="192" text-anchor="middle" font-family="Segoe UI, DejaVu Sans, sans-serif" font-size="9" fill="#e9d5ff" letter-spacing="1">SOUNDBOARD · VOICE FX</text>
</svg>`
const logoLayer = await png(96)
const sidebar = await sharp(Buffer.from(sidebarSvg))
  .composite([{ input: logoLayer, left: 34, top: 44 }])
  .removeAlpha().raw().toBuffer({ resolveWithObject: true })
writeFileSync('build/installerSidebar.bmp', bmp(sidebar))
writeFileSync('build/uninstallerSidebar.bmp', bmp(sidebar))

const headerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57">
  <rect width="150" height="57" fill="#ffffff"/>
  <text x="50" y="34" font-family="Segoe UI, DejaVu Sans, sans-serif" font-weight="800" font-size="15.5" fill="#4c1d95">Virtboard</text>
</svg>`
const header = await sharp(Buffer.from(headerSvg))
  .composite([{ input: await png(38), left: 6, top: 9 }])
  .removeAlpha().raw().toBuffer({ resolveWithObject: true })
writeFileSync('build/installerHeader.bmp', bmp(header))

// README banner
const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c0a1d"/><stop offset="0.6" stop-color="#1e1145"/><stop offset="1" stop-color="#4a1236"/></linearGradient>
    <radialGradient id="r" cx="0.25" cy="0.4" r="0.5"><stop offset="0" stop-color="#8b5cf6" stop-opacity="0.45"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient>
    <radialGradient id="r2" cx="0.85" cy="0.9" r="0.45"><stop offset="0" stop-color="#ec4899" stop-opacity="0.35"/><stop offset="1" stop-color="#ec4899" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1280" height="400" fill="url(#g)"/><rect width="1280" height="400" fill="url(#r)"/><rect width="1280" height="400" fill="url(#r2)"/>
  ${Array.from({ length: 90 }, (_, i) => { const h = 8 + Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)) * 120; return `<rect x="${i * 14.3}" y="${360 - h / 2}" width="5" height="${h}" rx="2.5" fill="#c4b5fd" opacity="0.13"/>` }).join('')}
  <text x="400" y="190" font-family="Space Grotesk, DejaVu Sans, sans-serif" font-weight="700" font-size="96" fill="#fff">Virtboard</text>
  <text x="404" y="245" font-family="DejaVu Sans, sans-serif" font-size="28" fill="#ddd6fe">Soundboard &amp; voice changer for Windows</text>
</svg>`
await sharp(Buffer.from(bannerSvg)).composite([{ input: await png(240), left: 120, top: 70 }]).png().toFile('docs/banner.png')
console.log('icons generated')
