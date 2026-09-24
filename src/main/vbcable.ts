import { app, net, shell } from 'electron'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const WEBSITE = 'https://vb-audio.com/Cable/'
const PACK_URL = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip'

/**
 * Downloads the official VB-Audio Virtual Cable driver pack and launches its installer
 * (which asks for admin rights itself). Falls back to opening the download page.
 */
export async function installVirtualCable(): Promise<'started' | 'opened-website' | 'failed'> {
  if (process.platform !== 'win32') {
    await shell.openExternal(WEBSITE)
    return 'opened-website'
  }
  try {
    const dir = join(app.getPath('temp'), 'virtboard-vbcable')
    await fs.mkdir(dir, { recursive: true })
    const zip = join(dir, 'vbcable.zip')
    const res = await net.fetch(PACK_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await fs.writeFile(zip, Buffer.from(await res.arrayBuffer()))
    await new Promise<void>((resolve, reject) =>
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`],
        (err) => (err ? reject(err) : resolve()),
      ),
    )
    const setup = join(dir, process.arch === 'ia32' ? 'VBCABLE_Setup.exe' : 'VBCABLE_Setup_x64.exe')
    const err = await shell.openPath(setup)
    if (err) throw new Error(err)
    return 'started'
  } catch (e) {
    console.error('[virtboard] VB-Cable install failed, opening website', e)
    try {
      await shell.openExternal(WEBSITE)
      return 'opened-website'
    } catch {
      return 'failed'
    }
  }
}
