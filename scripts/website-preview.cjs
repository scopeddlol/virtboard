const { app, BrowserWindow } = require('electron')
const { resolve } = require('node:path')
app.setPath('userData', resolve('out/qa/website-profile'))
app.whenReady().then(() => {
  const window = new BrowserWindow({ width: 1440, height: 1000, show: false, webPreferences: { sandbox: true, contextIsolation: true } })
  window.loadURL(process.env.VIRTBOARD_PREVIEW_URL || 'http://127.0.0.1:4186')
})
app.on('window-all-closed', () => app.quit())

