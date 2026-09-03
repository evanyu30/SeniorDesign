import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { nativeTheme } from 'electron'

let ragAbort: AbortController | null = null

// The FastAPI backend. Override with BACKEND_URL in the environment once
// this stops being localhost.
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // Hides the native title bar (macOS only) so the window looks custom --
    // traffic lights stay, everything else is drawn by our own CSS.
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window, { zoom: true })
  })

  ipcMain.handle('theme:set', (_e, source: 'system' | 'light' | 'dark') => {
    nativeTheme.themeSource = source
    return nativeTheme.shouldUseDarkColors
  })

  // Consumes the backend's /chat SSE stream and re-emits each event over IPC
  // as 'rag:<event>' (sources/token/error), plus 'rag:done' once, always.
  ipcMain.handle('rag:chat', async (e, question: string): Promise<void> => {
    ragAbort = new AbortController()
    let sawDone = false

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: ragAbort.signal
      })
      if (!res.ok || !res.body) {
        throw new Error(`backend responded ${res.status} ${res.statusText}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by a blank line; parse whole ones as they arrive.
        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          const lines = rawEvent.split('\n')
          const eventLine = lines.find((l) => l.startsWith('event: '))
          const dataLine = lines.find((l) => l.startsWith('data: '))
          if (!eventLine || !dataLine) continue

          const eventName = eventLine.slice('event: '.length)
          e.sender.send(`rag:${eventName}`, JSON.parse(dataLine.slice('data: '.length)))
          if (eventName === 'done') sawDone = true
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        sawDone = true // user clicked Stop -- not an error to show
      } else {
        e.sender.send('rag:error', { detail: err instanceof Error ? err.message : String(err) })
      }
    } finally {
      ragAbort = null
      if (!sawDone) e.sender.send('rag:done', {})
    }
  })

  ipcMain.on('rag:abort', () => {
    ragAbort?.abort()
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
