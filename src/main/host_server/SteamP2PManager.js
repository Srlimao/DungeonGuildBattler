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
  { x: 500, y: 280 },
  { x: 600, y: 240 },
  { x: 450, y: 180 },
  { x: 350, y: 150 },
  { x: 250, y: 220 },
  { x: 180, y: 190 }
];

// Simulated Lobbies List (Mock mode)
const MOCK_LOBBIES = [
  {
    id: "MOCK_LOBBY_1",
    name: "Valiant Shields Guild",
    hostName: "Soren",
    memberCount: 3,
    maxPlayers: 10,
    players: [
      { id: "mock_host_1", name: "Soren (Host)", class: "Warrior", x: 150, y: 200, isHost: true },
      { id: "mock_guest_1a", name: "Kaelen", class: "Mage", x: 280, y: 260, isHost: false },
      { id: "mock_guest_1b", name: "Lira", class: "Rogue", x: 410, y: 190, isHost: false }
    ]
  },
  {
    id: "MOCK_LOBBY_2",
    name: "Arcane Spells Sanctum",
    hostName: "Eldrin",
    memberCount: 5,
    maxPlayers: 10,
    players: [
      { id: "mock_host_2", name: "Eldrin (Host)", class: "Mage", x: 150, y: 200, isHost: true },
      { id: "mock_guest_2a", name: "Garrick", class: "Warrior", x: 300, y: 310, isHost: false },
      { id: "mock_guest_2b", name: "Jumina", class: "Cleric", x: 220, y: 150, isHost: false },
      { id: "mock_guest_2c", name: "Varis", class: "Rogue", x: 500, y: 280, isHost: false },
      { id: "mock_guest_2d", name: "Faelar", class: "Warrior", x: 450, y: 200, isHost: false }
    ]
  },
  {
    id: "MOCK_LOBBY_3",
    name: "Dagger in the Dark",
    hostName: "Valera",
    memberCount: 8,
    maxPlayers: 10,
    players: [
      { id: "mock_host_3", name: "Valera (Host)", class: "Rogue", x: 150, y: 200, isHost: true },
      { id: "mock_guest_3a", name: "Darek", class: "Warrior", x: 300, y: 250, isHost: false },
      { id: "mock_guest_3b", name: "Orin", class: "Mage", x: 400, y: 320, isHost: false },
      { id: "mock_guest_3c", name: "Sylvia", class: "Cleric", x: 500, y: 280, isHost: false },
      { id: "mock_guest_3d", name: "Brog", class: "Warrior", x: 220, y: 300, isHost: false },
      { id: "mock_guest_3e", name: "Celeste", class: "Mage", x: 450, y: 180, isHost: false },
      { id: "mock_guest_3f", name: "Talon", class: "Rogue", x: 600, y: 240, isHost: false },
      { id: "mock_guest_3g", name: "Zael", class: "Cleric", x: 350, y: 150, isHost: false }
    ]
  }
];

function initSteamworks() {
  try {
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

  // Create Lobby (Max 10 players)
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

  // List Lobbies (Steam or Mock)
  ipcMain.handle('net-list-lobbies', async () => {
    if (isMock) {
      // Map to return simplified browse list (max 10 players metadata)
      return MOCK_LOBBIES.map(l => ({
        id: l.id,
        name: l.name,
        hostName: l.hostName,
        memberCount: l.players.length,
        maxPlayers: l.maxPlayers
      }));
    } else {
      try {
        // Fallback or Steam matchmaking search
        return [];
      } catch (e) {
        return [];
      }
    }
  });

  // Join Lobby
  ipcMain.handle('net-join-lobby', async (event, { lobbyId: targetLobbyId, playerData }) => {
    if (isMock) {
      const match = MOCK_LOBBIES.find(l => l.id === targetLobbyId);
      if (!match) return { success: false, error: "Lobby not found" };

      if (match.players.length >= 10) {
        return { success: false, error: "Lobby is full (Max 10 players)" };
      }

      lobbyId = targetLobbyId;
      
      // Load preset players
      players = JSON.parse(JSON.stringify(match.players));
      
      // Add local player as client guest
      const newGuest = {
        id: playerData.id || 'guest_player',
        name: playerData.name || 'Guild Guest',
        class: playerData.class || 'Mage',
        x: 350,
        y: 280,
        isHost: false
      };
      players.push(newGuest);

      console.log(`Mock Joined Lobby: ${lobbyId} (Count: ${players.length}/10)`);
      mainWindow.webContents.send('net-players-update', players);
      return { success: true, lobbyId, players, isMock: true };
    } else {
      // Real Steamworks join logic hook
      return { success: false, error: "Steam Matchmaking Join not implemented yet." };
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

  // Simulate Friend joining (Mock mode helper - capped at 10 players)
  ipcMain.handle('net-simulate-join', async (event) => {
    if (!isMock && !lobbyId) return { success: false, error: "No active lobby" };

    if (players.length >= 10) {
      console.warn("Lobby limit reached: Max 10 players.");
      return { success: false, error: "Lobby is full (Max 10 players)" };
    }

    const mockNames = ["Alex", "Jordan", "Morgan", "Taylor", "Casey", "Sam", "Pat", "Robin", "Finley"];
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
      // Only move other players (not hosts if they are us, or guest if they are us)
      // For mock simplicity, move all players whose ID contains "mock"
      if (p.id.includes('mock')) {
        p.x += Math.floor(Math.random() * 40 - 20);
        p.y += Math.floor(Math.random() * 40 - 20);
        
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
