const { ipcMain } = require('electron');

let steamClient = null;
let isMock = false;
let lobbyId = null;
let players = [];
let nextMockId = 1;
let steamLobby = null;

function generateShortLobbyId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'DG-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
    const customName = hostData.lobbyName || `${hostData.name || 'Guild Host'}'s Guild`;
    if (isMock) {
      lobbyId = generateShortLobbyId();
      const hostPlayer = {
        id: hostData.id || 'host_player',
        name: hostData.name || 'Guild Host',
        class: hostData.class || 'Warrior',
        x: 150,
        y: 200,
        isHost: true
      };
      players = [hostPlayer];
      
      // Save/append to browseable MOCK_LOBBIES
      MOCK_LOBBIES.push({
        id: lobbyId,
        shortId: lobbyId,
        name: customName,
        hostName: hostPlayer.name,
        memberCount: 1,
        maxPlayers: 10,
        players: players
      });
      
      console.log(`Mock Lobby created: ${lobbyId} ("${customName}")`);
      return { success: true, lobbyId, players, isMock: true };
    } else {
      try {
        const steamId = (steamClient.localPlayer || steamClient.localUser)?.getSteamId()?.steamId64?.toString() || 'steam_host';
        const steamName = (steamClient.localPlayer || steamClient.localUser)?.getName() || 'Steam Player';
        
        // Create real Steam Lobby
        steamLobby = await steamClient.matchmaking.createLobby(steamClient.matchmaking.LobbyType.Public, 10);
        lobbyId = generateShortLobbyId();
        
        // Store metadata
        steamLobby.setData('shortId', lobbyId);
        steamLobby.setData('lobbyName', customName);
        steamLobby.setData('hostName', steamName);
        steamLobby.setData('hostClass', hostData.class || 'Warrior');
        
        const hostPlayer = {
          id: steamId,
          name: steamName,
          class: hostData.class || 'Warrior',
          x: 150,
          y: 200,
          isHost: true
        };
        players = [hostPlayer];

        console.log(`Steam Lobby created: ${lobbyId} (Steam ID: ${steamLobby.id.toString()})`);
        return { success: true, lobbyId, players, isMock: false };
      } catch (err) {
        console.error("Steam Lobby creation failed. Falling back to Mock.", err);
        isMock = true;
        lobbyId = generateShortLobbyId();
        const hostPlayer = { id: 'host', name: hostData.name, class: hostData.class, x: 150, y: 200, isHost: true };
        players = [hostPlayer];

        MOCK_LOBBIES.push({
          id: lobbyId,
          shortId: lobbyId,
          name: customName,
          hostName: hostPlayer.name,
          memberCount: 1,
          maxPlayers: 10,
          players: players
        });

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
        const steamLobbies = await steamClient.matchmaking.getLobbies();
        const results = [];
        for (const l of steamLobbies) {
          const shortId = l.getData('shortId');
          const lobbyName = l.getData('lobbyName') || `${l.getData('hostName') || 'Steam'}'s Guild`;
          const hostName = l.getData('hostName') || 'Steam Player';
          const memberCount = Number(l.getMemberCount() || 1n);
          const maxPlayers = Number(l.getMemberLimit() || 10n);
          
          if (shortId) {
            results.push({
              id: l.id.toString(), // The actual Steam Lobby ID to join
              shortId: shortId,
              name: lobbyName,
              hostName: hostName,
              memberCount: memberCount,
              maxPlayers: maxPlayers
            });
          }
        }
        return results;
      } catch (e) {
        console.error("Failed to list Steam lobbies:", e);
        return [];
      }
    }
  });

  // Join Lobby
  ipcMain.handle('net-join-lobby', async (event, { lobbyId: targetLobbyId, playerData }) => {
    if (isMock) {
      // Support matching by standard id or shortId (case-insensitive for easier pasting)
      const query = (targetLobbyId || '').toUpperCase().trim();
      const match = MOCK_LOBBIES.find(l => 
        (l.id && l.id.toUpperCase() === query) || 
        (l.shortId && l.shortId.toUpperCase() === query)
      );
      if (!match) return { success: false, error: "Lobby not found" };

      if (match.players.length >= 10) {
        return { success: false, error: "Lobby is full (Max 10 players)" };
      }

      lobbyId = match.id;
      
      // Load preset players
      players = JSON.parse(JSON.stringify(match.players));
      
      // Add local player as client guest if not already present
      if (!players.some(p => p.id === playerData.id)) {
        const newGuest = {
          id: playerData.id || 'guest_player',
          name: playerData.name || 'Guild Guest',
          class: playerData.class || 'Mage',
          x: 350,
          y: 280,
          isHost: false
        };
        players.push(newGuest);
        
        // Sync back to MOCK_LOBBIES so it reflects in Browse list
        match.players = JSON.parse(JSON.stringify(players));
        match.memberCount = players.length;
      }

      console.log(`Mock Joined Lobby: ${lobbyId} (Count: ${players.length}/10)`);
      mainWindow.webContents.send('net-players-update', players);
      return { success: true, lobbyId, players, isMock: true };
    } else {
      try {
        let lobbyToJoin = null;
        const query = (targetLobbyId || '').toUpperCase().trim();
        
        const steamLobbies = await steamClient.matchmaking.getLobbies();
        for (const l of steamLobbies) {
          const shortId = l.getData('shortId');
          if (l.id.toString() === query || (shortId && shortId.toUpperCase() === query)) {
            lobbyToJoin = l;
            break;
          }
        }
        
        if (!lobbyToJoin) {
          if (/^\d+$/.test(query)) {
            try {
              const directId = BigInt(query);
              steamLobby = await steamClient.matchmaking.joinLobby(directId);
            } catch (err) {
              console.error("Direct join by Steam ID failed:", err);
            }
          }
        } else {
          steamLobby = await lobbyToJoin.join();
        }

        if (!steamLobby) {
          return { success: false, error: "Steam Lobby not found or failed to join." };
        }
        
        const hostName = steamLobby.getData('hostName') || 'Steam Host';
        const hostId = steamLobby.getOwner()?.steamId64?.toString() || 'steam_host';
        const hostClass = steamLobby.getData('hostClass') || 'Warrior';
        
        const steamId = (steamClient.localPlayer || steamClient.localUser)?.getSteamId()?.steamId64?.toString() || 'steam_guest';
        const steamName = (steamClient.localPlayer || steamClient.localUser)?.getName() || 'Steam Guest';
        
        const members = steamLobby.getMembers();
        players = [];
        
        // Add host first
        players.push({
          id: hostId,
          name: hostName,
          class: hostClass,
          x: 150,
          y: 200,
          isHost: true
        });

        // Add local guest
        const localGuest = {
          id: steamId,
          name: steamName,
          class: playerData.class || 'Mage',
          x: 350,
          y: 280,
          isHost: false
        };
        players.push(localGuest);

        // Add other members if any
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== hostId && mIdStr !== steamId) {
            players.push({
              id: mIdStr,
              name: 'Steam Guest',
              class: 'Mage',
              x: 350,
              y: 280,
              isHost: false
            });
          }
        }
        
        // Send initial position packet to all members in the lobby
        const payload = JSON.stringify({
          type: 'POSITION_UPDATE',
          playerId: steamId,
          name: steamName,
          class: localGuest.class,
          x: localGuest.x,
          y: localGuest.y
        });
        const buffer = Buffer.from(payload);
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== steamId) {
            try {
              steamClient.networking.sendP2PPacket(m.steamId64, steamClient.networking.SendType.Reliable, buffer);
            } catch (err) {
              console.error(`Failed to send join notification to member ${mIdStr}:`, err);
            }
          }
        }

        console.log(`Successfully joined Steam lobby: ${steamLobby.id.toString()}`);
        return { success: true, lobbyId: steamLobby.getData('shortId') || steamLobby.id.toString(), players, isMock: false };
      } catch (err) {
        console.error("Failed to join Steam lobby:", err);
        return { success: false, error: err.message || "Failed to join Steam lobby" };
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
    
    // Broadcast to other players via Steam P2P if not mock
    if (!isMock && steamClient && steamLobby) {
      try {
        const steamIdStr = (steamClient.localPlayer || steamClient.localUser)?.getSteamId()?.steamId64?.toString();
        const payload = JSON.stringify({
          type: 'POSITION_UPDATE',
          playerId: steamIdStr,
          name: (steamClient.localPlayer || steamClient.localUser)?.getName() || 'Steam Player',
          class: p ? p.class : 'Warrior',
          x,
          y
        });
        const buffer = Buffer.from(payload);
        
        const members = steamLobby.getMembers();
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== steamIdStr) {
            try {
              steamClient.networking.sendP2PPacket(m.steamId64, steamClient.networking.SendType.UnreliableNoDelay, buffer);
            } catch (err) {
              console.error(`Failed to send packet to ${mIdStr}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to send Steam P2P packet:", err);
      }
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

    // Keep MOCK_LOBBIES synchronized
    const match = MOCK_LOBBIES.find(l => l.id === lobbyId);
    if (match) {
      match.players = JSON.parse(JSON.stringify(players));
      match.memberCount = players.length;
    }

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

  // Leave Lobby
  ipcMain.handle('net-leave-lobby', async () => {
    if (!isMock && steamClient && steamLobby) {
      try {
        steamLobby.leave();
        console.log("Left Steam Lobby successfully.");
      } catch (err) {
        console.error("Error leaving Steam lobby:", err);
      }
    }
    steamLobby = null;
    lobbyId = null;
    players = [];
    return { success: true };
  });

  // Accept P2P session requests automatically from other players in the lobby
  if (!isMock && steamClient) {
    try {
      steamClient.callback.register(steamClient.callback.SteamCallback.P2PSessionRequest, (req) => {
        console.log(`Accepting P2P Session from: ${req.remote}`);
        steamClient.networking.acceptP2PSession(req.remote);
      });
    } catch (e) {
      console.error("Failed to register P2PSessionRequest callback:", e);
    }

    // Poll for P2P networking packets
    const steamIdStr = (steamClient.localPlayer || steamClient.localUser)?.getSteamId()?.steamId64?.toString() || 'steam_user';
    setInterval(() => {
      try {
        let size = steamClient.networking.isP2PPacketAvailable();
        while (size > 0) {
          const packet = steamClient.networking.readP2PPacket(size);
          if (packet && packet.data) {
            const payload = JSON.parse(packet.data.toString('utf8'));
            if (payload.type === 'POSITION_UPDATE') {
              const hostId = steamLobby ? steamLobby.getOwner()?.steamId64?.toString() : 'host';
              let existing = players.find(p => p.id === payload.playerId);
              if (!existing) {
                players.push({
                  id: payload.playerId,
                  name: payload.name,
                  class: payload.class,
                  x: payload.x,
                  y: payload.y,
                  isHost: payload.playerId === hostId
                });
                
                // Reply with our own position so they know where we are!
                const localPlayer = players.find(p => p.id === steamIdStr);
                if (localPlayer) {
                  const replyPayload = JSON.stringify({
                    type: 'POSITION_UPDATE',
                    playerId: steamIdStr,
                    name: (steamClient.localPlayer || steamClient.localUser)?.getName() || 'Steam Player',
                    class: localPlayer.class,
                    x: localPlayer.x,
                    y: localPlayer.y
                  });
                  try {
                    const peerId = BigInt(payload.playerId);
                    steamClient.networking.sendP2PPacket(peerId, steamClient.networking.SendType.UnreliableNoDelay, Buffer.from(replyPayload));
                  } catch (err) {
                    console.error("Failed to reply with position packet:", err);
                  }
                }
              } else {
                existing.x = payload.x;
                existing.y = payload.y;
                existing.name = payload.name;
                existing.class = payload.class;
              }
              mainWindow.webContents.send('net-players-update', players);
            }
          }
          size = steamClient.networking.isP2PPacketAvailable();
        }
      } catch (e) {
        // Suppress
      }
    }, 150);
  }
}

module.exports = {
  setupP2PHandlers
};
