const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');

let activeWindow = null;
let initialized = false;

function initUpdater() {
  if (initialized) return;
  initialized = true;

  if (process.env.STEAM_BUILD === 'true') {
    console.log('Steam build detected (STEAM_BUILD=true): Auto-updater is disabled.');
    return;
  }

  console.log('Initializing Auto-Updater for alpha/beta channel...');
  
  // Set automatic download of updates
  autoUpdater.autoDownload = true;

  function sendToRenderer(channel, ...args) {
    if (activeWindow && !activeWindow.isDestroyed()) {
      activeWindow.webContents.send(channel, ...args);
    }
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    sendToRenderer('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`Update available: version ${info.version}`);
    sendToRenderer('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available.');
    sendToRenderer('update-status', { status: 'not-available' });
  });

  autoUpdater.on('error', (err) => {
    console.error('Updater error:', err);
    sendToRenderer('update-status', { status: 'error', message: err?.message || 'Unknown error' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download progress: ${progressObj.percent}%`);
    sendToRenderer('update-status', { status: 'downloading', percent: progressObj.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`Update downloaded: version ${info.version}`);
    sendToRenderer('update-status', { status: 'downloaded', version: info.version });
  });

  ipcMain.handle('install-update', () => {
    console.log('Installing update and restarting...');
    autoUpdater.quitAndInstall();
  });
}

function bindUpdaterWindow(mainWindow) {
  activeWindow = mainWindow;
  
  // Check for updates on startup if updater is enabled
  if (process.env.STEAM_BUILD !== 'true') {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('Failed checking for updates:', err);
    });
  }
}

module.exports = { initUpdater, bindUpdaterWindow };

