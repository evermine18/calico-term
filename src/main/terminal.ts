import { spawn } from 'node-pty'
import { ipcMain } from 'electron'

let ptyProcess: any = null

export function setupTerminal() {
  // Crear proceso PTY
  ptyProcess = spawn(process.platform === 'win32' ? 'powershell.exe' : 'bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env
  })

  // Manejar input del renderer
  ipcMain.on('terminal-input', (event, data) => {
    if (ptyProcess) {
      ptyProcess.write(data)
    }
  })

  // Enviar output al renderer
  ptyProcess.onData((data: string) => {
    // Enviar a todas las ventanas
    const windows = require('electron').BrowserWindow.getAllWindows()
    windows.forEach(window => {
      window.webContents.send('terminal-output', data)
    })
  })

  ptyProcess.onExit(() => {
    console.log('Terminal process exited')
  })
}

export function closeTerminal() {
  if (ptyProcess) {
    ptyProcess.kill()
  }
}