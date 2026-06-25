const { app, BrowserWindow } = require('electron');
const path = require('path');

const { initP2PHandlers, bindP2PWindow } = require('./host_server/SteamP2PManager');
const { initUpdater, bindUpdaterWindow } = require('./updater');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#07060e',
    show: false
  });

  bindP2PWindow(mainWindow);
  bindUpdaterWindow(mainWindow);

  // Attempt to connect to local Vite dev server. If it fails, load production build.
  mainWindow.loadURL('http://localhost:5173')
    .catch(() => {
      console.log('Vite dev server not found, loading static HTML production build...');
      mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
    });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  // Initialize handlers once globally
  initP2PHandlers();
  initUpdater();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

