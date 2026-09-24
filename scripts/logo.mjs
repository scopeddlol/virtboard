// Virtboard logo: a "V" drawn with equalizer bars on a violet → magenta squircle.
export function logoSvg({ size = 1024, background = true } = {}) {
  const s = size
  const heights = [0.16, 0.22, 0.29, 0.21, 0.13, 0.21, 0.29, 0.22, 0.16]
  const n = heights.length
  const x0 = 0.21, x1 = 0.79
  const barW = 0.052
  const bars = heights.map((h, i) => {
    const x = x0 + ((x1 - x0) * i) / (n - 1)
    const y = 0.3 + (1 - Math.abs(x - 0.5) / 0.29) * 0.4 // V centerline
    const top = y - h / 2
    return `<rect x="${((x - barW / 2) * s).toFixed(1)}" y="${(top * s).toFixed(1)}" width="${(barW * s).toFixed(1)}" height="${(h * s).toFixed(1)}" rx="${((barW / 2) * s).toFixed(1)}" fill="url(#bar)"/>`
  })
  const r = s * 0.23
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8B5CF6"/>
      <stop offset="0.55" stop-color="#7C3AED"/>
      <stop offset="1" stop-color="#EC4899"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.2" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shade" cx="0.8" cy="1" r="0.7">
      <stop offset="0" stop-color="#1e0b3a" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#1e0b3a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#E0F2FE"/>
    </linearGradient>
    <filter id="drop" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${s * 0.012}" stdDeviation="${s * 0.018}" flood-color="#2e1065" flood-opacity="0.45"/>
    </filter>
  </defs>
  ${background ? `<rect width="${s}" height="${s}" rx="${r}" fill="url(#bg)"/>
  <rect width="${s}" height="${s}" rx="${r}" fill="url(#shade)"/>
  <rect width="${s}" height="${s}" rx="${r}" fill="url(#glow)"/>
  <rect x="${s * 0.004}" y="${s * 0.004}" width="${s * 0.992}" height="${s * 0.992}" rx="${r}" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="${s * 0.008}"/>` : ''}
  <g filter="url(#drop)">${bars.join('')}</g>
</svg>`
}
