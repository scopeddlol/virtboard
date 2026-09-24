import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { extname, join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AppState, TrayAction } from '../shared/types'
import { ensureDirs, loadState, saveState, soundPath } from './store'
import { applyHotkeys, onHotkey, onToggleWindow, setPaused } from './hotkeys'
import { createTray, updateTray } from './tray'
import { installVirtualCable } from './vbcable'

if (process.env.VIRTBOARD_USER_DATA) app.setPath('userData', process.env.VIRTBOARD_USER_DATA)

// Keep audio + hotkeys fully responsive while the window is hidden in the tray.
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService')

const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'webm', 'opus']
const resDir = app.isPackaged ? join(process.resourcesPath, 'icons') : join(app.getAppPath(), 'resources')

let win: BrowserWindow | null = null
let state: AppState | null = null
let quitting = false
let trayHintShown = false

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
  app.whenReady().then(init)
}

function showWindow() {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function toggleWindow() {
  if (!win) return
  if (win.isVisible() && win.isFocused()) win.hide()
  else showWindow()
}

function sendTray(action: TrayAction) {
  if (action.type === 'show') return showWindow()
  if (action.type === 'openSettings') showWindow()
  win?.webContents.send('tray-action', action)
}

async function init() {
  app.setAppUserModelId('com.virtboard.app')
  ensureDirs()
  state = await loadState()

  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) =>
    cb(['media', 'speaker-selection', 'clipboard-sanitized-write'].includes(permission)),
  )
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    ['media', 'speaker-selection', 'clipboard-sanitized-write'].includes(permission),
  )

  const hidden = process.argv.includes('--hidden') || !!state?.settings.startMinimized
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 620,
    show: false,
    frame: false,
    backgroundColor: '#0a0913',
    icon: join(resDir, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    title: 'Virtboard',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  })
  win.once('ready-to-show', () => {
    if (!hidden) win?.show()
  })
  // Never block Windows shutdown / logoff by hiding to the tray.
  win.on('session-end', () => {
    quitting = true
  })
  win.on('maximize', () => win?.webContents.send('maximized', true))
  win.on('unmaximize', () => win?.webContents.send('maximized', false))
  win.on('close', (e) => {
    if (!quitting && state?.settings.closeToTray !== false) {
      e.preventDefault()
      win?.hide()
      if (!trayHintShown && process.platform === 'win32') {
        trayHintShown = true
        tray.displayBalloon({
          iconType: 'info',
          title: 'Virtboard is still running',
          content: 'Your hotkeys and virtual mic keep working. Right-click the tray icon for options.',
        })
      }
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  const tray = createTray(resDir, sendTray, toggleWindow)
  onHotkey((action) => win?.webContents.send('hotkey', action))
  onToggleWindow(toggleWindow)

  if (process.env.VITE_DEV_SERVER_URL) await win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else await win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.on('before-quit', () => {
  quitting = true
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---------------------------------------------------------------- IPC ----

ipcMain.handle('state:load', () => state)

ipcMain.handle('state:save', async (_e, next: AppState) => {
  const prevLogin = state?.settings.launchOnStartup
  state = next
  await saveState(next)
  if (prevLogin !== next.settings.launchOnStartup && process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: next.settings.launchOnStartup, args: ['--hidden'] })
  }
  updateTray(next, resDir, sendTray)
  return { failed: applyHotkeys(next) }
})

async function importFile(src: string) {
  const ext = extname(src).toLowerCase()
  const file = `${randomUUID()}${ext}`
  await fs.copyFile(src, soundPath(file))
  return { file, name: basename(src, ext) }
}

ipcMain.handle('sound:import-dialog', async () => {
  const res = await dialog.showOpenDialog(win!, {
    title: 'Add sounds',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: AUDIO_EXT }],
  })
  if (res.canceled) return []
  return Promise.all(res.filePaths.map(importFile))
})

ipcMain.handle('sound:import-bytes', async (_e, name: string, bytes: Uint8Array) => {
  const ext = extname(name).toLowerCase()
  if (!AUDIO_EXT.includes(ext.slice(1))) throw new Error('Unsupported file type')
  const file = `${randomUUID()}${ext}`
  await fs.writeFile(soundPath(file), bytes)
  return { file, name: basename(name, ext) }
})

ipcMain.handle('sound:read', (_e, file: string) => fs.readFile(soundPath(file)))
ipcMain.handle('sound:delete', (_e, file: string) => fs.rm(soundPath(file), { force: true }))

ipcMain.handle('sound:export-wav', async (_e, name: string, bytes: Uint8Array) => {
  const res = await dialog.showSaveDialog(win!, {
    title: 'Export trimmed sound',
    defaultPath: `${name.replace(/[\\/:*?"<>|]/g, '_')}.wav`,
    filters: [{ name: 'WAV audio', extensions: ['wav'] }],
  })
  if (res.canceled || !res.filePath) return false
  await fs.writeFile(res.filePath, bytes)
  return true
})

ipcMain.handle('hotkeys:pause', (_e, paused: boolean) => setPaused(paused))

ipcMain.on('win:minimize', () => win?.minimize())
ipcMain.on('win:toggle-maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
ipcMain.on('win:close', () => win?.close())
ipcMain.handle('win:is-maximized', () => !!win?.isMaximized())
ipcMain.on('open-external', (_e, url: string) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url)
})
ipcMain.handle('vbcable:install', () => installVirtualCable())
ipcMain.handle('app:version', () => app.getVersion())
