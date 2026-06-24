const { ipcMain } = require('electron');

let steamClient = null;
let isMock = false;
let lobbyId = null;
let players = [];
let nextMockId = 1;

// Preset positions in Guild Hall for new joins
const START_POSITIONS = [
  { x: 200, y: 300 },
  { x: 300, y: 250 },
  { x: 400, y: 320 },
  { x: 500, y: 280 }
];

function initSteamworks() {
  try {
    // Try to load steamworks.js using AppID 480 (Spacewar)
    const steamworks = require('steamworks.js');
    steamClient = steamworks.init(480);
    console.log("Steamworks API initialized successfully under AppID 480.");
  } catch (e) {
    console.warn("Failed to initialize steamworks.js (Steam client might not be running). Switching to Local Mock Mode.");
    isMock = true;
  }
}

function setupP2PHandlers(mainWindow) {
  initSteamworks();

  // Create Lobby
  ipcMain.handle('net-create-lobby', async (event, hostData) => {
    if (isMock) {
      lobbyId = 'MOCK_LOBBY_' + Math.floor(Math.random() * 900000 + 100000);
      const hostPlayer = {
        id: hostData.id || 'host_player',
        name: hostData.name || 'Guild Host',
        class: hostData.class || 'Warrior',
        x: 150,
        y: 200,
        isHost: true
      };
      players = [hostPlayer];
      console.log(`Mock Lobby created: ${lobbyId}`);
      return { success: true, lobbyId, players, isMock: true };
    } else {
      try {
        // Real Steam Matchmaking
        const steamId = (steamClient.localPlayer || steamClient.localUser)?.getSteamId()?.toString() || 'steam_host';
        const steamName = (steamClient.localPlayer || steamClient.localUser)?.getName() || 'Steam Player';
        
        lobbyId = 'STEAM_LOBBY_' + steamId;
        const hostPlayer = {
          id: steamId,
          name: steamName,
          class: hostData.class || 'Warrior',
          x: 150,
          y: 200,
          isHost: true
        };
        players = [hostPlayer];
        return { success: true, lobbyId, players, isMock: false };
      } catch (err) {
        console.error("Steam Lobby creation failed. Falling back to Mock.", err);
        isMock = true;
        lobbyId = 'MOCK_LOBBY_FALLBACK_' + Date.now();
        players = [{ id: 'host', name: hostData.name, class: hostData.class, x: 150, y: 200, isHost: true }];
        return { success: true, lobbyId, players, isMock: true };
      }
    }
  });

  // Update position
  ipcMain.handle('net-send-position', async (event, { playerId, x, y }) => {
    const p = players.find(player => player.id === playerId);
    if (p) {
      p.x = x;
      p.y = y;
    }
    // Broadcast updated players list back to renderer
    mainWindow.webContents.send('net-players-update', players);
    return { success: true, players };
  });

  // Simulate Friend joining (Mock mode helper)
  ipcMain.handle('net-simulate-join', async (event) => {
    if (!isMock && !lobbyId) return { success: false, error: "No active lobby" };

    const mockNames = ["Alex", "Jordan", "Morgan", "Taylor", "Casey", "Sam"];
    const mockClasses = ["Warrior", "Mage", "Rogue", "Cleric"];

    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)] + ` #${nextMockId++}`;
    const randomClass = mockClasses[Math.floor(Math.random() * mockClasses.length)];
    const startPos = START_POSITIONS[players.length % START_POSITIONS.length];

    const newFriend = {
      id: 'mock_friend_' + Date.now(),
      name: randomName,
      class: randomClass,
      x: startPos.x,
      y: startPos.y,
      isHost: false
    };

    players.push(newFriend);
    mainWindow.webContents.send('net-players-update', players);
    return { success: true, players };
  });

  // Simulate Friend movements randomly in Mock mode
  ipcMain.handle('net-simulate-friend-move', async () => {
    players.forEach(p => {
      if (!p.isHost) {
        // Move towards a random offset
        p.x += Math.floor(Math.random() * 80 - 40);
        p.y += Math.floor(Math.random() * 80 - 40);
        
        // Boundaries checks
        if (p.x < 50) p.x = 50;
        if (p.x > 750) p.x = 750;
        if (p.y < 50) p.y = 350;
        if (p.y > 350) p.y = 350;
      }
    });
    mainWindow.webContents.send('net-players-update', players);
    return { success: true, players };
  });
}

module.exports = {
  setupP2PHandlers
};
