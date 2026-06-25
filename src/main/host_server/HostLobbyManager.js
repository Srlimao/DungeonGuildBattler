const { MOCK_LOBBIES, START_POSITIONS } = require('./mockData');

class HostLobbyManager {
  constructor(p2pManager) {
    this.p2p = p2pManager;
    this.lobbyId = null;
    this.players = [];
    this.nextMockId = 1;
    this.steamLobby = null;
  }

  generateShortLobbyId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'DG-';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async createLobby(hostData) {
    const customName = hostData.lobbyName || `${hostData.name || 'Guild Host'}'s Guild`;
    if (this.p2p.isMock) {
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
        const steamId = this.p2p.getLocalSteamId() || 'steam_host';
        const steamName = this.p2p.getLocalSteamName() || 'Steam Player';
        
        // Create real Steam Lobby
        this.steamLobby = await this.p2p.steamClient.matchmaking.createLobby(this.p2p.steamClient.matchmaking.LobbyType.Public, 10);
        this.lobbyId = this.steamLobby.id.toString();
        
        // Store metadata
        this.steamLobby.setData('gameId', 'DungeonGuildBattler');
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

        console.log(`Steam Lobby created: (Steam ID: ${this.lobbyId})`);
        return { success: true, lobbyId: this.lobbyId, players: this.players, isMock: false, localPlayerId: steamId };
      } catch (err) {
        console.error("Steam Lobby creation failed. Falling back to Mock.", err);
        this.p2p.isMock = true;
        this.lobbyId = this.generateShortLobbyId();
        const hostPlayer = { id: 'host', name: hostData.name, class: hostData.class, x: 150, y: 200, isHost: true };
        this.players = [hostPlayer];

        MOCK_LOBBIES.push({
          id: this.lobbyId,
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
    if (this.p2p.isMock) {
      return MOCK_LOBBIES.map(l => ({
        id: l.id,
        name: l.name,
        hostName: l.hostName,
        memberCount: l.players.length,
        maxPlayers: l.maxPlayers
      }));
    } else {
      try {
        const steamLobbies = await this.p2p.steamClient.matchmaking.getLobbies();
        const results = [];
        for (const l of steamLobbies) {
          if (l.getData('gameId') !== 'DungeonGuildBattler') {
            continue;
          }
          const lobbyName = l.getData('lobbyName') || `${l.getData('hostName') || 'Steam'}'s Guild`;
          const hostName = l.getData('hostName') || 'Steam Player';
          const memberCount = Number(l.getMemberCount() || 1n);
          const maxPlayers = Number(l.getMemberLimit() || 10n);
          
          results.push({
            id: l.id.toString(),
            name: lobbyName,
            hostName: hostName,
            memberCount: memberCount,
            maxPlayers: maxPlayers
          });
        }
        return results;
      } catch (e) {
        console.error("Failed to list Steam lobbies:", e);
        return [];
      }
    }
  }

  async joinLobby(targetLobbyId, playerData) {
    if (this.p2p.isMock) {
      const query = (targetLobbyId || '').toUpperCase().trim();
      const match = MOCK_LOBBIES.find(l => 
        l.id && l.id.toUpperCase() === query
      );
      if (!match) return { success: false, error: "Lobby not found" };

      if (match.players.length >= 10) {
        return { success: false, error: "Lobby is full (Max 10 players)" };
      }

      this.lobbyId = match.id;
      this.players = JSON.parse(JSON.stringify(match.players));
      
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
        
        match.players = JSON.parse(JSON.stringify(this.players));
        match.memberCount = this.players.length;
      }

      console.log(`Mock Joined Lobby: ${this.lobbyId} (Count: ${this.players.length}/10)`);
      this.p2p.sendToRenderer('net-players-update', this.players);
      return { success: true, lobbyId: this.lobbyId, players: this.players, isMock: true, localPlayerId: guestId };
    } else {
      try {
        let lobbyToJoin = null;
        const query = (targetLobbyId || '').toUpperCase().trim();
        
        const steamLobbies = await this.p2p.steamClient.matchmaking.getLobbies();
        for (const l of steamLobbies) {
          if (l.id.toString() === query) {
            lobbyToJoin = l;
            break;
          }
        }
        
        if (!lobbyToJoin) {
          if (/^\d+$/.test(query)) {
            try {
              const directId = BigInt(query);
              this.steamLobby = await this.p2p.steamClient.matchmaking.joinLobby(directId);
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
        
        const steamId = this.p2p.getLocalSteamId() || 'steam_guest';
        const steamName = this.p2p.getLocalSteamName() || 'Steam Guest';
        
        const members = this.steamLobby.getMembers();
        this.players = [];
        
        this.players.push({
          id: hostId,
          name: hostName,
          class: hostClass,
          x: 150,
          y: 200,
          isHost: true,
          ready: false
        });

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
              this.p2p.steamClient.networking.sendP2PPacket(m.steamId64, this.p2p.steamClient.networking.SendType.Reliable, buffer);
            } catch (err) {
              console.error(`Failed to send join notification to member ${mIdStr}:`, err);
            }
          }
        }

        this.lobbyId = this.steamLobby.id.toString();
        console.log(`Successfully joined Steam lobby: ${this.lobbyId}`);
        return { success: true, lobbyId: this.lobbyId, players: this.players, isMock: false, localPlayerId: steamId };
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
    
    if (!this.p2p.isMock && this.p2p.steamClient && this.steamLobby) {
      try {
        const steamIdStr = this.p2p.getLocalSteamId();
        const payload = JSON.stringify({
          type: 'POSITION_UPDATE',
          playerId: steamIdStr,
          name: this.p2p.getLocalSteamName() || 'Steam Player',
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
              this.p2p.steamClient.networking.sendP2PPacket(m.steamId64, this.p2p.steamClient.networking.SendType.UnreliableNoDelay, buffer);
            } catch (err) {
              console.error(`Failed to send packet to ${mIdStr}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to send Steam P2P packet:", err);
      }
    }
    
    this.p2p.sendToRenderer('net-players-update', this.players);
    return { success: true, players: this.players };
  }

  async sendReady(playerId, ready) {
    const p = this.players.find(player => player.id === playerId);
    if (p) {
      p.ready = ready;
    }
    
    if (!this.p2p.isMock && this.p2p.steamClient && this.steamLobby) {
      try {
        const payload = JSON.stringify({
          type: 'READY_UPDATE',
          playerId,
          ready
        });
        const buffer = Buffer.from(payload);
        const members = this.steamLobby.getMembers();
        const steamIdStr = this.p2p.getLocalSteamId();
        for (const m of members) {
          const mIdStr = m.steamId64.toString();
          if (mIdStr !== steamIdStr) {
            try {
              this.p2p.steamClient.networking.sendP2PPacket(m.steamId64, this.p2p.steamClient.networking.SendType.Reliable, buffer);
            } catch (err) {
              console.error(`Failed to send ready update to ${mIdStr}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to send Steam P2P ready update:", err);
      }
    }
    
    this.p2p.sendToRenderer('net-players-update', this.players);
    return { success: true, players: this.players };
  }

  async simulateJoin() {
    if (!this.p2p.isMock && !this.lobbyId) return { success: false, error: "No active lobby" };

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

    const match = MOCK_LOBBIES.find(l => l.id === this.lobbyId);
    if (match) {
      match.players = JSON.parse(JSON.stringify(this.players));
      match.memberCount = this.players.length;
    }

    this.p2p.sendToRenderer('net-players-update', this.players);
    return { success: true, players: this.players };
  }

  async simulateFriendMove() {
    this.players.forEach(p => {
      if (p.id.includes('mock')) {
        p.x += Math.floor(Math.random() * 40 - 20);
        p.y += Math.floor(Math.random() * 40 - 20);
        
        if (p.x < 50) p.x = 50;
        if (p.x > 750) p.x = 750;
        if (p.y < 50) p.y = 350;
        if (p.y > 350) p.y = 350;
      }
    });
    this.p2p.sendToRenderer('net-players-update', this.players);
    return { success: true, players: this.players };
  }

  async leaveLobby() {
    if (!this.p2p.isMock && this.p2p.steamClient && this.steamLobby) {
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

  resetReadyState() {
    this.players.forEach(p => p.ready = false);
    this.p2p.sendToRenderer('net-players-update', this.players);
  }
}

module.exports = HostLobbyManager;
