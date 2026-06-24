const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');

function initUpdater(mainWindow) {
  if (process.env.STEAM_BUILD === 'true') {
    console.log('Steam build detected (STEAM_BUILD=true): Auto-updater is disabled.');
    return;
  }

  console.log('Initializing Auto-Updater for alpha/beta channel...');
  
  // Set automatic download of updates
  autoUpdater.autoDownload = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    mainWindow.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`Update available: version ${info.version}`);
    mainWindow.webContents.send('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No updates available.');
    mainWindow.webContents.send('update-status', { status: 'not-available' });
  });

  autoUpdater.on('error', (err) => {
    console.error('Updater error:', err);
    mainWindow.webContents.send('update-status', { status: 'error', message: err?.message || 'Unknown error' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download progress: ${progressObj.percent}%`);
    mainWindow.webContents.send('update-status', { status: 'downloading', percent: progressObj.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`Update downloaded: version ${info.version}`);
    mainWindow.webContents.send('update-status', { status: 'downloaded', version: info.version });
  });

  ipcMain.handle('install-update', () => {
    console.log('Installing update and restarting...');
    autoUpdater.quitAndInstall();
  });

  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.error('Failed checking for updates:', err);
  });
}

module.exports = { initUpdater };
