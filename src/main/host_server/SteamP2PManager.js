const { ipcMain } = require('electron');
const { MOCK_LOBBIES, START_POSITIONS } = require('./mockData');

class SteamP2PManager {
  constructor() {
    this.mainWindow = null;
    this.steamClient = null;
    this.isMock = false;
    this.lobbyId = null;
    this.players = [];
    this.nextMockId = 1;
    this.steamLobby = null;
    this.pollingInterval = null;
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  sendToRenderer(channel, ...args) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }

  getLocalSteamId() {
    if (!this.steamClient) return null;
    try {
      const lp = this.steamClient.localplayer || this.steamClient.localPlayer || this.steamClient.localUser;
      return lp?.getSteamId()?.steamId64?.toString() || null;
    } catch (e) {
      return null;
    }
  }

  getLocalSteamName() {
    if (!this.steamClient) return null;
    try {
      const lp = this.steamClient.localplayer || this.steamClient.localPlayer || this.steamClient.localUser;
      return lp?.getName() || null;
    } catch (e) {
      return null;
    }
  }

  generateShortLobbyId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'DG-';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  initSteamworks() {
    try {
      const steamworks = require('steamworks.js');
      this.steamClient = steamworks.init(480);
      console.log("Steamworks API initialized successfully under AppID 480.");
    } catch (e) {
      console.warn("Failed to initialize steamworks.js (Steam client might not be running). Switching to Local Mock Mode.");
      this.isMock = true;
    }
  }

  setup() {
    this.initSteamworks();
    this.setupP2PCallbacks();
  }

  async createLobby(hostData) {
    const customName = hostData.lobbyName || `${hostData.name || 'Guild Host'}'s Guild`;
    if (this.isMock) {
      this.lobbyId = this.generateShortLobbyId();
      const hostPlayer = {
        id: hostData.id || 'host_player',
        name: hostData.name || 'Guild Host',
        class: hostData.class || 'Warrior',
        x: 150,
        y: 200,
        isHost: true,
        ready: false
      };
      this.players = [hostPlayer];
      
      MOCK_LOBBIES.push({
        id: this.lobbyId,
        shortId: this.lobbyId,
        name: customName,
        hostName: hostPlayer.name,
        memberCount: 1,
        maxPlayers: 10,
        players: this.players
      });
      
      console.log(`Mock Lobby created: ${this.lobbyId} ("${customName}")`);
      return { success: true, lobbyId: this.lobbyId, players: this.players, isMock: true, localPlayerId: hostPlayer.id };
    } else {
      try {
        const steamId = this.getLocalSteamId() || 'steam_host';
        const steamName = this.getLocalSteamName() || 'Steam Player';
        
        // Create real Steam Lobby
        this.steamLobby = await this.steamClient.matchmaking.createLobby(this.steamClient.matchmaking.LobbyType.Public, 10);
        this.lobbyId = this.generateShortLobbyId();
        
        // Store metadata
        this.steamLobby.setData('shortId', this.lobbyId);
        this.steamLobby.setData('lobbyName', customName);
        this.steamLobby.setData('hostName', steamName);
        this.steamLobby.setData('hostClass', hostData.class || 'Warrior');
        
        const hostPlayer = {
          id: steamId,
          name: steamName,
          class: hostData.class || 'Warrior',
          x: 150,
          y: 200,
          isHost: true,
          ready: false
        };
        this.players = [hostPlayer];

        console.log(`Steam Lobby created: ${this.lobbyId} (Steam ID: ${this.steamLobby.id.toString()})`);
        return { success: true, lobbyId: this.lobbyId, players: this.players, isMock: false, localPlayerId: steamId };
      } catch (err) {
        console.error("Steam Lobby creation failed. Falling back to Mock.", err);
        this.isMock = true;
        this.lobbyId = this.generateShortLobbyId();
        const hostPlayer = { id: 'host', name: hostData.name, class: hostData.class, x: 150, y: 200, isHost: true };
        this.players = [hostPlayer];

        MOCK_LOBBIES.push({
          id: this.lobbyId,
          shortId: this.lobbyId,
          name: customName,
          hostName: hostPlayer.name,
          memberCount: 1,
          maxPlayers: 10,
          players: this.players
        });

        return { success: true, lobbyId: this.lobbyId, players: this.players, isMock: true, localPlayerId: hostPlayer.id };
      }
    }
  }

  async listLobbies() {
    if (this.isMock) {
      return MOCK_LOBBIES.map(l => ({
        id: l.id,
        name: l.name,
        hostName: l.hostName,
        memberCount: l.players.length,
        maxPlayers: l.maxPlayers
      }));
    } else {
      try {
        const steamLobbies = await this.steamClient.matchmaking.getLobbies();
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
  }

  async joinLobby(targetLobbyId, playerData) {
    if (this.isMock) {
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

      this.lobbyId = match.id;
      
      // Load preset players
      this.players = JSON.parse(JSON.stringify(match.players));
      
      // Add local player as client guest if not already present
      const guestId = playerData.id || 'guest_player';
      if (!this.players.some(p => p.id === guestId)) {
        const newGuest = {
          id: guestId,
          name: playerData.name || 'Guild Guest',
          class: playerData.class || 'Mage',
          x: 350,
          y: 280,
          isHost: false,
          ready: false
        };
        this.players.push(newGuest);
        
        // Sync back to MOCK_LOBBIES so it reflects in Browse list
        match.players = JSON.parse(JSON.stringify(this.players));
        match.memberCount = this.players.length;
      }

      console.log(`Mock Joined Lobby: ${this.lobbyId} (Count: ${this.players.length}/10)`);
      this.sendToRenderer('net-players-update', this.players);
      return { success: true, lobbyId: this.lobbyId, players: this.players, isMock: true, localPlayerId: guestId };
    } else {
      try {
        let lobbyToJoin = null;
        const query = (targetLobbyId || '').toUpperCase().trim();
        
        const steamLobbies = await this.steamClient.matchmaking.getLobbies();
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
              this.steamLobby = await this.steamClient.matchmaking.joinLobby(directId);
            } catch (err) {
              console.error("Direct join by Steam ID failed:", err);
            }
          }
        } else {
          this.steamLobby = await lobbyToJoin.join();
        }

        if (!this.steamLobby) {
          return { success: false, error: "Steam Lobby not found or failed to join." };
        }
        
        const hostName = this.steamLobby.getData('hostName') || 'Steam Host';
        const hostId = this.steamLobby.getOwner()?.steamId64?.toString() || 'steam_host';
        const hostClass = this.steamLobby.getData('hostClass') || 'Warrior';
        
        const steamId = this.getLocalSteamId() || 'steam_guest';
        const steamName = this.getLocalSteamName() || 'Steam Guest';
        
        const members = this.steamLobby.getMembers();
        this.players = [];
        
        // Add host first
        this.players.push({
          id: hostId,
          name: hostName,
          class: hostClass,
          x: 150,
          y: 200,
          isHost: true,
          ready: false
        });

        // Add local guest
        const localGuest = {
          id: steamId,
          name: steamName,
          class: playerData.class || 'Mage',
          x: 350,
          y: 280,
          isHost: false,
          ready: false
        };
        this.players.push(localGuest);

        // Add other members if any
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== hostId && mIdStr !== steamId) {
            this.players.push({
              id: mIdStr,
              name: 'Steam Guest',
              class: 'Mage',
              x: 350,
              y: 280,
              isHost: false,
              ready: false
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
          y: localGuest.y,
          ready: false
        });
        const buffer = Buffer.from(payload);
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== steamId) {
            try {
              this.steamClient.networking.sendP2PPacket(m.steamId64, this.steamClient.networking.SendType.Reliable, buffer);
            } catch (err) {
              console.error(`Failed to send join notification to member ${mIdStr}:`, err);
            }
          }
        }

        console.log(`Successfully joined Steam lobby: ${this.steamLobby.id.toString()}`);
        return { success: true, lobbyId: this.steamLobby.getData('shortId') || this.steamLobby.id.toString(), players: this.players, isMock: false, localPlayerId: steamId };
      } catch (err) {
        console.error("Failed to join Steam lobby:", err);
        return { success: false, error: err.message || "Failed to join Steam lobby" };
      }
    }
  }

  async sendPosition(playerId, x, y) {
    const p = this.players.find(player => player.id === playerId);
    if (p) {
      p.x = x;
      p.y = y;
    }
    
    // Broadcast to other players via Steam P2P if not mock
    if (!this.isMock && this.steamClient && this.steamLobby) {
      try {
        const steamIdStr = this.getLocalSteamId();
        const payload = JSON.stringify({
          type: 'POSITION_UPDATE',
          playerId: steamIdStr,
          name: this.getLocalSteamName() || 'Steam Player',
          class: p ? p.class : 'Warrior',
          x,
          y
        });
        const buffer = Buffer.from(payload);
        
        const members = this.steamLobby.getMembers();
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== steamIdStr) {
            try {
              this.steamClient.networking.sendP2PPacket(m.steamId64, this.steamClient.networking.SendType.UnreliableNoDelay, buffer);
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
    this.sendToRenderer('net-players-update', this.players);
    return { success: true, players: this.players };
  }

  async sendReady(playerId, ready) {
    const p = this.players.find(player => player.id === playerId);
    if (p) {
      p.ready = ready;
    }
    
    if (!this.isMock && this.steamClient && this.steamLobby) {
      try {
        const payload = JSON.stringify({
          type: 'READY_UPDATE',
          playerId,
          ready
        });
        const buffer = Buffer.from(payload);
        const members = this.steamLobby.getMembers();
        const steamIdStr = this.getLocalSteamId();
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== steamIdStr) {
            try {
              this.steamClient.networking.sendP2PPacket(m.steamId64, this.steamClient.networking.SendType.Reliable, buffer);
            } catch (err) {
              console.error(`Failed to send ready update to ${mIdStr}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to send Steam P2P ready update:", err);
      }
    }
    
    this.sendToRenderer('net-players-update', this.players);
    return { success: true, players: this.players };
  }

  async startCombat(combatData) {
    if (!this.isMock && this.steamClient && this.steamLobby) {
      try {
        const payload = JSON.stringify({
          type: 'START_COMBAT',
          combatData
        });
        const buffer = Buffer.from(payload);
        const members = this.steamLobby.getMembers();
        const steamIdStr = this.getLocalSteamId();
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== steamIdStr) {
            try {
              this.steamClient.networking.sendP2PPacket(m.steamId64, this.steamClient.networking.SendType.Reliable, buffer);
            } catch (err) {
              console.error(`Failed to send start combat to ${mIdStr}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to broadcast START_COMBAT:", err);
      }
    }
    this.sendToRenderer('net-game-state-change', { screen: 'combat', combatData });
    return { success: true };
  }

  async returnToLobby() {
    this.players.forEach(p => p.ready = false);
    if (!this.isMock && this.steamClient && this.steamLobby) {
      try {
        const payload = JSON.stringify({
          type: 'RETURN_TO_LOBBY'
        });
        const buffer = Buffer.from(payload);
        const members = this.steamLobby.getMembers();
        const steamIdStr = this.getLocalSteamId();
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== steamIdStr) {
            try {
              this.steamClient.networking.sendP2PPacket(m.steamId64, this.steamClient.networking.SendType.Reliable, buffer);
            } catch (err) {
              console.error(`Failed to send return to lobby to ${mIdStr}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to broadcast RETURN_TO_LOBBY:", err);
      }
    }
    this.sendToRenderer('net-players-update', this.players);
    this.sendToRenderer('net-game-state-change', { screen: 'guild-lobby' });
    return { success: true };
  }

  async simulateJoin() {
    if (!this.isMock && !this.lobbyId) return { success: false, error: "No active lobby" };

    if (this.players.length >= 10) {
      console.warn("Lobby limit reached: Max 10 players.");
      return { success: false, error: "Lobby is full (Max 10 players)" };
    }

    const mockNames = ["Alex", "Jordan", "Morgan", "Taylor", "Casey", "Sam", "Pat", "Robin", "Finley"];
    const mockClasses = ["Warrior", "Mage", "Rogue", "Cleric"];

    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)] + ` #${this.nextMockId++}`;
    const randomClass = mockClasses[Math.floor(Math.random() * mockClasses.length)];
    const startPos = START_POSITIONS[this.players.length % START_POSITIONS.length];

    const newFriend = {
      id: 'mock_friend_' + Date.now(),
      name: randomName,
      class: randomClass,
      x: startPos.x,
      y: startPos.y,
      isHost: false,
      ready: false
    };

    this.players.push(newFriend);

    // Keep MOCK_LOBBIES synchronized
    const match = MOCK_LOBBIES.find(l => l.id === this.lobbyId);
    if (match) {
      match.players = JSON.parse(JSON.stringify(this.players));
      match.memberCount = this.players.length;
    }

    this.sendToRenderer('net-players-update', this.players);
    return { success: true, players: this.players };
  }

  async simulateFriendMove() {
    this.players.forEach(p => {
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
    this.sendToRenderer('net-players-update', this.players);
    return { success: true, players: this.players };
  }

  async leaveLobby() {
    if (!this.isMock && this.steamClient && this.steamLobby) {
      try {
        this.steamLobby.leave();
        console.log("Left Steam Lobby successfully.");
      } catch (err) {
        console.error("Error leaving Steam lobby:", err);
      }
    }
    this.steamLobby = null;
    this.lobbyId = null;
    this.players = [];
    return { success: true };
  }

  setupP2PCallbacks() {
    // Accept P2P session requests automatically from other players in the lobby
    if (!this.isMock && this.steamClient) {
      try {
        this.steamClient.callback.register(this.steamClient.callback.SteamCallback.P2PSessionRequest, (req) => {
          console.log(`Accepting P2P Session from: ${req.remote}`);
          this.steamClient.networking.acceptP2PSession(req.remote);
        });
      } catch (e) {
        console.error("Failed to register P2PSessionRequest callback:", e);
      }

      // Poll for P2P networking packets
      const steamIdStr = this.getLocalSteamId() || 'steam_user';
      this.pollingInterval = setInterval(() => {
        try {
          let size = this.steamClient.networking.isP2PPacketAvailable();
          while (size > 0) {
            const packet = this.steamClient.networking.readP2PPacket(size);
            if (packet && packet.data) {
              const senderIdStr = packet.steamId.steamId64.toString();
              const isMember = this.steamLobby && this.steamLobby.getMembers().some(m => m.steamId64.toString() === senderIdStr);
              if (!isMember) {
                size = this.steamClient.networking.isP2PPacketAvailable();
                continue;
              }

              const payload = JSON.parse(packet.data.toString('utf8'));
              if (payload.type === 'POSITION_UPDATE') {
                const hostId = this.steamLobby ? this.steamLobby.getOwner()?.steamId64?.toString() : 'host';
                let existing = this.players.find(p => p.id === payload.playerId);
                if (!existing) {
                  this.players.push({
                    id: payload.playerId,
                    name: payload.name,
                    class: payload.class,
                    x: payload.x,
                    y: payload.y,
                    isHost: payload.playerId === hostId,
                    ready: payload.ready || false
                  });
                  
                  // Reply with our own position so they know where we are!
                  const localPlayer = this.players.find(p => p.id === steamIdStr);
                  if (localPlayer) {
                    const replyPayload = JSON.stringify({
                      type: 'POSITION_UPDATE',
                      playerId: steamIdStr,
                      name: this.getLocalSteamName() || 'Steam Player',
                      class: localPlayer.class,
                      x: localPlayer.x,
                      y: localPlayer.y,
                      ready: localPlayer.ready || false
                    });
                    try {
                      const peerId = BigInt(payload.playerId);
                      this.steamClient.networking.sendP2PPacket(peerId, this.steamClient.networking.SendType.UnreliableNoDelay, Buffer.from(replyPayload));
                    } catch (err) {
                      console.error("Failed to reply with position packet:", err);
                    }
                  }
                } else {
                  existing.x = payload.x;
                  existing.y = payload.y;
                  existing.name = payload.name;
                  existing.class = payload.class;
                  if (payload.ready !== undefined) {
                    existing.ready = payload.ready;
                  }
                }
                this.sendToRenderer('net-players-update', this.players);
              } else if (payload.type === 'READY_UPDATE') {
                let existing = this.players.find(p => p.id === payload.playerId);
                if (existing) {
                  existing.ready = payload.ready;
                  this.sendToRenderer('net-players-update', this.players);
                }
              } else if (payload.type === 'START_COMBAT') {
                this.sendToRenderer('net-game-state-change', { screen: 'combat', combatData: payload.combatData });
              } else if (payload.type === 'RETURN_TO_LOBBY') {
                this.players.forEach(p => p.ready = false);
                this.sendToRenderer('net-players-update', this.players);
                this.sendToRenderer('net-game-state-change', { screen: 'guild-lobby' });
              }
            }
            size = this.steamClient.networking.isP2PPacketAvailable();
          }
        } catch (e) {
          // Suppress
        }
      }, 150);
    }
  }

  destroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
}

const manager = new SteamP2PManager();

function initP2PHandlers() {
  manager.setup();

  ipcMain.handle('net-create-lobby', (event, hostData) => manager.createLobby(hostData));
  ipcMain.handle('net-list-lobbies', () => manager.listLobbies());
  ipcMain.handle('net-join-lobby', (event, { lobbyId, playerData }) => manager.joinLobby(lobbyId, playerData));
  ipcMain.handle('net-send-position', (event, { playerId, x, y }) => manager.sendPosition(playerId, x, y));
  ipcMain.handle('net-send-ready', (event, { playerId, ready }) => manager.sendReady(playerId, ready));
  ipcMain.handle('net-start-combat', (event, { combatData }) => manager.startCombat(combatData));
  ipcMain.handle('net-return-to-lobby', () => manager.returnToLobby());
  ipcMain.handle('net-simulate-join', () => manager.simulateJoin());
  ipcMain.handle('net-simulate-friend-move', () => manager.simulateFriendMove());
  ipcMain.handle('net-leave-lobby', () => manager.leaveLobby());
}

function bindP2PWindow(mainWindow) {
  manager.setMainWindow(mainWindow);
}

module.exports = {
  initP2PHandlers,
  bindP2PWindow
};
