const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#071222',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(indexPath).catch((error) => {
    console.error('Failed to load Rivals Collision:', error);
    dialog.showErrorBox('Rivals Collision failed to launch', `Could not load the game UI.\n\n${error.message}`);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process exited:', details);
    dialog.showErrorBox('Rivals Collision renderer stopped', `Reason: ${details.reason}\nExit code: ${details.exitCode}`);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
