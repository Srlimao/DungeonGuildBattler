const { ipcMain } = require('electron');
const HostLobbyManager = require('./HostLobbyManager');
const HostCombatEngine = require('./HostCombatEngine');

class SteamP2PManager {
  constructor() {
    this.mainWindow = null;
    this.steamClient = null;
    this.isMock = false;
    this.pollingInterval = null;

    // Delegate Managers
    this.lobbyManager = new HostLobbyManager(this);
    this.combatEngine = new HostCombatEngine(this);
  }

  // Getters for compatibility or convenience
  get lobbyId() { return this.lobbyManager.lobbyId; }
  get players() { return this.lobbyManager.players; }

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
    return this.lobbyManager.createLobby(hostData);
  }

  async listLobbies() {
    return this.lobbyManager.listLobbies();
  }

  async joinLobby(targetLobbyId, playerData) {
    return this.lobbyManager.joinLobby(targetLobbyId, playerData);
  }

  async sendPosition(playerId, x, y) {
    return this.lobbyManager.sendPosition(playerId, x, y);
  }

  async sendReady(playerId, ready) {
    return this.lobbyManager.sendReady(playerId, ready);
  }

  async simulateJoin() {
    return this.lobbyManager.simulateJoin();
  }

  async simulateFriendMove() {
    return this.lobbyManager.simulateFriendMove();
  }

  async leaveLobby() {
    return this.lobbyManager.leaveLobby();
  }

  async startCombat() {
    return this.combatEngine.startCombat(this.lobbyManager.players);
  }

  async clientCastSkill(playerId, skillId) {
    return this.combatEngine.clientCastSkill(playerId, skillId, this.lobbyManager.players);
  }

  async returnToLobby() {
    this.combatEngine.reset();
    this.lobbyManager.resetReadyState();
    this.sendToRenderer('net-game-state-change', { screen: 'guild-lobby' });
    return { success: true };
  }

  broadcastPacket(type, data) {
    const steamLobby = this.lobbyManager.steamLobby;
    if (!this.isMock && this.steamClient && steamLobby) {
      try {
        const payload = JSON.stringify({ type, ...data });
        const buffer = Buffer.from(payload);
        const members = steamLobby.getMembers();
        const steamIdStr = this.getLocalSteamId();
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== steamIdStr) {
            try {
              this.steamClient.networking.sendP2PPacket(m.steamId64, this.steamClient.networking.SendType.Reliable, buffer);
            } catch (err) {
              console.error(`Failed to send ${type} broadcast to ${mIdStr}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to broadcast P2P packet for ${type}:`, err);
      }
    }
    if (type === 'START_COMBAT') {
      this.sendToRenderer('net-game-state-change', { screen: 'combat', combatData: data.combatData });
    } else if (type === 'COMBAT_EVENT') {
      this.sendToRenderer('net-combat-event', data);
    } else if (type === 'STATE_UPDATE') {
      this.sendToRenderer('net-combat-state-update', data);
    } else if (type === 'RESOLVE_COMBAT') {
      this.sendToRenderer('net-combat-resolve', data);
    }
  }

  setupP2PCallbacks() {
    if (!this.isMock && this.steamClient) {
      try {
        this.steamClient.callback.register(this.steamClient.callback.SteamCallback.P2PSessionRequest, (req) => {
          console.log(`Accepting P2P Session from: ${req.remote}`);
          this.steamClient.networking.acceptP2PSession(req.remote);
        });
      } catch (e) {
        console.error("Failed to register P2PSessionRequest callback:", e);
      }

      const steamIdStr = this.getLocalSteamId() || 'steam_user';
      this.pollingInterval = setInterval(() => {
        try {
          let size = this.steamClient.networking.isP2PPacketAvailable();
          while (size > 0) {
            const packet = this.steamClient.networking.readP2PPacket(size);
            if (packet && packet.data) {
              const senderIdStr = packet.steamId.steamId64.toString();
              const steamLobby = this.lobbyManager.steamLobby;
              const isMember = steamLobby && steamLobby.getMembers().some(m => m.steamId64.toString() === senderIdStr);
              if (!isMember) {
                size = this.steamClient.networking.isP2PPacketAvailable();
                continue;
              }

              const payload = JSON.parse(packet.data.toString('utf8'));
              if (payload.type === 'POSITION_UPDATE') {
                const hostId = steamLobby ? steamLobby.getOwner()?.steamId64?.toString() : 'host';
                let existing = this.lobbyManager.players.find(p => p.id === payload.playerId);
                if (!existing) {
                  this.lobbyManager.players.push({
                    id: payload.playerId,
                    name: payload.name,
                    class: payload.class,
                    x: payload.x,
                    y: payload.y,
                    isHost: payload.playerId === hostId,
                    ready: payload.ready || false
                  });
                  
                  const localPlayer = this.lobbyManager.players.find(p => p.id === steamIdStr);
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
                this.sendToRenderer('net-players-update', this.lobbyManager.players);
              } else if (payload.type === 'READY_UPDATE') {
                let existing = this.lobbyManager.players.find(p => p.id === payload.playerId);
                if (existing) {
                  existing.ready = payload.ready;
                  this.sendToRenderer('net-players-update', this.lobbyManager.players);
                }
              } else if (payload.type === 'START_COMBAT') {
                this.sendToRenderer('net-game-state-change', { screen: 'combat', combatData: payload.combatData });
              } else if (payload.type === 'RETURN_TO_LOBBY') {
                this.lobbyManager.players.forEach(p => p.ready = false);
                this.sendToRenderer('net-players-update', this.lobbyManager.players);
                this.sendToRenderer('net-game-state-change', { screen: 'guild-lobby' });
              } else if (payload.type === 'CAST_SKILL') {
                this.combatEngine.castSkill(payload.playerId, payload.skillId);
              } else if (payload.type === 'COMBAT_EVENT') {
                this.sendToRenderer('net-combat-event', payload);
              } else if (payload.type === 'STATE_UPDATE') {
                this.sendToRenderer('net-combat-state-update', payload);
              } else if (payload.type === 'RESOLVE_COMBAT') {
                this.sendToRenderer('net-combat-resolve', payload);
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
    this.combatEngine.stopCombatLoops();
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
  ipcMain.handle('net-start-combat', (event) => manager.startCombat());
  ipcMain.handle('net-return-to-lobby', () => manager.returnToLobby());
  ipcMain.handle('net-cast-skill', (event, { playerId, skillId }) => manager.clientCastSkill(playerId, skillId));
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
