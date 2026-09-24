// Virtboard logo: a "V" drawn with equalizer bars on a flat violet rounded square.
export function logoSvg({ size = 1024, background = true } = {}) {
  const s = size
  const heights = [0.16, 0.22, 0.29, 0.21, 0.13, 0.21, 0.29, 0.22, 0.16]
  const n = heights.length
  const x0 = 0.21, x1 = 0.79
  const barW = 0.052
  const bars = heights.map((h, i) => {
    const x = x0 + ((x1 - x0) * i) / (n - 1)
    const y = 0.3 + (1 - Math.abs(x - 0.5) / 0.29) * 0.4 // V centerline
    return `<rect x="${((x - barW / 2) * s).toFixed(1)}" y="${((y - h / 2) * s).toFixed(1)}" width="${(barW * s).toFixed(1)}" height="${(h * s).toFixed(1)}" rx="${((barW / 2) * s).toFixed(1)}" fill="#ffffff"/>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  ${background ? `<rect width="${s}" height="${s}" rx="${s * 0.22}" fill="#7c6cf0"/>` : ''}
  ${bars.join('')}
</svg>`
}
