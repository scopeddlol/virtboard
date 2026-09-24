// Dev runner: Vite dev server for the UI + esbuild watch for main/preload + Electron.
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import electron from 'electron'

const server = await createServer({ configFile: 'vite.config.ts' })
await server.listen()
const url = server.resolvedUrls.local[0]
spawn(process.execPath, ['scripts/build-main.mjs', '--watch'], { stdio: 'inherit' })
setTimeout(() => {
  const args = ['.']
  if (process.getuid?.() === 0) args.push('--no-sandbox')
  const child = spawn(electron, args, { stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } })
  child.on('exit', () => process.exit(0))
}, 1200)
