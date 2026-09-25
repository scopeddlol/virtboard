import { createServer } from 'node:http'
import { readdir, lstat, realpath } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { dirname, resolve, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), 'public')
const installerPattern = /^Virtboard-Setup-(\d+)\.(\d+)\.(\d+)\.exe$/i
const safeInstaller = /^[a-zA-Z0-9][a-zA-Z0-9._ -]*\.exe$/i

async function fileIn(root, name) {
  if (basename(name) !== name) return null
  try {
    const path = resolve(root, name)
    const stat = await lstat(path)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) return null
    if (dirname(await realpath(path)) !== await realpath(root)) return null
    return { path, stat }
  } catch { return null }
}

export async function installers(dataDir) {
  const entries = await readdir(dataDir).catch(() => [])
  const files = (await Promise.all(entries.filter((n) => safeInstaller.test(n)).map(async (name) => {
    const file = await fileIn(dataDir, name)
    if (!file) return null
    const match = name.match(installerPattern)
    return { name, version: match ? match.slice(1).join('.') : null, size: file.stat.size, modified: file.stat.mtimeMs }
  }))).filter(Boolean)
  return files.sort((a, b) => {
    if (a.version && b.version) {
      const av = a.version.split('.').map(Number), bv = b.version.split('.').map(Number)
      for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return bv[i] - av[i]
    }
    if (!!a.version !== !!b.version) return a.version ? -1 : 1
    return b.modified - a.modified || a.name.localeCompare(b.name)
  })
}

export function createWebsite({ dataDir = process.env.DATA_DIR || '/data' } = {}) {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(req.method === 'HEAD' ? undefined : body) }
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); reply(405, 'Method not allowed'); return }
    let path
    try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { reply(400, 'Invalid URL'); return }
    try {
      if (path === '/healthz') { reply(200, 'ok'); return }
      if (path === '/api/download') {
        const latest = (await installers(dataDir))[0]
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(latest ? { ...latest, url: `/downloads/${encodeURIComponent(latest.name)}` } : { available: false }))
        return
      }
      if (path === '/download') {
        const latest = (await installers(dataDir))[0]
        if (!latest) { reply(503, 'The Windows installer is not available yet. Please check back soon.'); return }
        res.writeHead(302, { Location: `/downloads/${encodeURIComponent(latest.name)}`, 'Cache-Control': 'no-store' }); res.end(); return
      }
      let file, type
      if (path.startsWith('/downloads/')) {
        const name = path.slice('/downloads/'.length)
        if (!safeInstaller.test(name)) { reply(404, 'Not found'); return }
        file = await fileIn(dataDir, name)
        type = 'application/octet-stream'
        if (file) res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
        res.setHeader('Cache-Control', 'no-store')
      } else {
        // Explicit public assets only: never expose the data directory, source or configuration.
        const name = path === '/' ? 'index.html' : path.slice(1)
        const allowed = ['index.html', 'style.css', 'app.js', 'logo.svg', 'screenshots/soundboard.png', 'screenshots/trimmer.png', 'screenshots/voice-changer.png', 'screenshots/outputs.png']
        if (!allowed.includes(name)) { reply(404, 'Not found'); return }
        file = await fileIn(dirname(resolve(publicDir, name)), basename(name))
        type = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' }[extname(name)]
      }
      if (!file) { reply(404, 'Not found'); return }
      let start = 0, end = file.stat.size - 1, status = 200
      res.setHeader('Accept-Ranges', 'bytes')
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
        if (!match || (!match[1] && !match[2])) { res.setHeader('Content-Range', `bytes */${file.stat.size}`); reply(416, 'Invalid range'); return }
        if (!match[1]) start = Math.max(0, file.stat.size - Number(match[2]))
        else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])) }
        if (start > end || start >= file.stat.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) { res.setHeader('Content-Range', `bytes */${file.stat.size}`); reply(416, 'Invalid range'); return }
        status = 206
        res.setHeader('Content-Range', `bytes ${start}-${end}/${file.stat.size}`)
      }
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': end - start + 1 })
      if (req.method === 'HEAD') { res.end(); return }
      await pipeline(createReadStream(file.path, { start, end }), res)
    } catch (error) {
      console.error('Request failed:', error.code || error.message)
      if (!res.headersSent) reply(500, 'Unable to serve this request')
      else res.destroy()
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createWebsite()
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('Virtboard website listening on port', process.env.PORT || 8080))
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)))
}
