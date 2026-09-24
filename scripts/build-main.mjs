// Bundles the Electron main + preload scripts with esbuild (fast & tiny).
import { build, context } from 'esbuild'

const watch = process.argv.includes('--watch')
const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
}
const configs = [
  { ...common, entryPoints: ['src/main/index.ts'], outfile: 'out/main/index.cjs' },
  { ...common, entryPoints: ['src/preload/index.ts'], outfile: 'out/preload/index.cjs' },
]
if (watch) {
  for (const c of configs) await (await context(c)).watch()
} else {
  await Promise.all(configs.map((c) => build(c)))
}
