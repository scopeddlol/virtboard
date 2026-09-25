import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWebsite } from './server.mjs'

test('website serves local installers, handles updates and confines file access', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'virtboard-web-'))
  const server = createWebsite({ dataDir: dir })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(base + '/healthz')).status, 200)
    assert.equal((await fetch(base + '/download')).status, 503)
    assert.deepEqual(await (await fetch(base + '/api/download')).json(), { available: false })
    const html = await (await fetch(base)).text()
    assert.match(html, /Your voice/)
    assert.doesNotMatch(html, /open source|github\.com|ghcr\.io/i)
    await writeFile(join(dir, 'Virtboard-Setup-0.2.0.exe'), 'installer-020')
    await writeFile(join(dir, 'Virtboard-Setup-0.10.0.exe'), 'installer-0100')
    await writeFile(join(dir, 'private.txt'), 'private')
    await writeFile(join(dir, 'empty.exe'), '')
    const latest = await (await fetch(base + '/api/download')).json()
    assert.equal(latest.version, '0.10.0')
    assert.equal(latest.size, 14)
    const redirect = await fetch(base + '/download', { redirect: 'manual' })
    assert.equal(redirect.status, 302)
    assert.equal(redirect.headers.get('location'), latest.url)
    const download = await fetch(base + latest.url)
    assert.equal(await download.text(), 'installer-0100')
    assert.match(download.headers.get('content-disposition'), /attachment/)
    const range = await fetch(base + latest.url, { headers: { Range: 'bytes=0-8' } })
    assert.equal(range.status, 206)
    assert.equal(await range.text(), 'installer')
    assert.equal(range.headers.get('content-range'), 'bytes 0-8/14')
    assert.equal((await fetch(base + latest.url, { headers: { Range: 'bytes=999-' } })).status, 416)
    assert.equal((await fetch(base + latest.url, { headers: { Range: 'bytes=-0' } })).status, 416)
    const head = await fetch(base + latest.url, { method: 'HEAD' })
    assert.equal(head.headers.get('content-length'), '14')
    assert.equal(await head.text(), '')
    for (const path of ['/downloads/private.txt', '/downloads/empty.exe', '/server.mjs', '/data/', '/downloads/..%2Fprivate.txt', '/downloads/%5Cprivate.exe']) {
      assert.equal((await fetch(base + path)).status, 404, path)
    }
    assert.equal((await fetch(base + '/download', { method: 'POST' })).status, 405)
    assert.equal((await fetch(base + '/%ZZ')).status, 400)
    try {
      await symlink(join(dir, 'private.txt'), join(dir, 'linked.exe'))
      assert.equal((await fetch(base + '/downloads/linked.exe')).status, 404)
    } catch (e) { if (!['EPERM', 'EACCES'].includes(e.code)) throw e }
    await writeFile(join(dir, 'Virtboard-Setup-1.0.0.exe'), 'new installer')
    assert.equal((await (await fetch(base + '/api/download')).json()).version, '1.0.0')
    for (const asset of ['style.css', 'app.js', 'logo.svg', 'screenshots/soundboard.png', 'screenshots/trimmer.png', 'screenshots/voice-changer.png']) assert.equal((await fetch(base + '/' + asset)).status, 200)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  }
})
