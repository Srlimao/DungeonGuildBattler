const { ipcMain } = require('electron');
const { MOCK_LOBBIES, START_POSITIONS } = require('./mockData');
const SKILL_DATA = require('../../shared/skill_data.json');

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

    // Real-time combat states
    this.boss = null;
    this.combatPlayers = [];
    this.activeCombos = {};
    this.combatTickInterval = null;
    this.bossAiInterval = null;
    this.manaRegenCounter = 0;
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
        this.isMock = true;
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
          if (l.getData('gameId') !== 'DungeonGuildBattler') {
            continue;
          }
          const lobbyName = l.getData('lobbyName') || `${l.getData('hostName') || 'Steam'}'s Guild`;
          const hostName = l.getData('hostName') || 'Steam Player';
          const memberCount = Number(l.getMemberCount() || 1n);
          const maxPlayers = Number(l.getMemberLimit() || 10n);
          
          results.push({
            id: l.id.toString(), // The actual Steam Lobby ID to join
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
    if (this.isMock) {
      // Support matching by standard id (case-insensitive for easier pasting)
      const query = (targetLobbyId || '').toUpperCase().trim();
      const match = MOCK_LOBBIES.find(l => 
        l.id && l.id.toUpperCase() === query
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
          if (l.id.toString() === query) {
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

  async startCombat() {
    const bossList = [
      { name: "Cinder Claw the Red Drake", hp: 300, maxHp: 300, atk: 22, def: 18, spd: 8, icon: "🐉", colorClass: "text-red-400" },
      { name: "Gorgon the Cryptkeeper", hp: 380, maxHp: 380, atk: 17, def: 24, spd: 5, icon: "🧟", colorClass: "text-emerald-400" },
      { name: "Tenebris the Shadow Stalker", hp: 260, maxHp: 260, atk: 28, def: 12, spd: 14, icon: "👤", colorClass: "text-purple-400" }
    ];
    const baseBoss = bossList[Math.floor(Math.random() * bossList.length)];
    const partySize = this.players.length;
    const scaledHp = baseBoss.hp + (partySize - 1) * 80;
    
    this.boss = {
      name: baseBoss.name,
      hp: scaledHp,
      maxHp: scaledHp,
      atk: baseBoss.atk,
      def: baseBoss.def,
      spd: baseBoss.spd,
      icon: baseBoss.icon,
      colorClass: baseBoss.colorClass,
      isDead: false
    };

    const CLASS_PRESETS = {
      Warrior: { hp: 140, maxHp: 140, mana: 100, maxMana: 100 },
      Mage: { hp: 85, maxHp: 85, mana: 100, maxMana: 100 },
      Rogue: { hp: 100, maxHp: 100, mana: 100, maxMana: 100 },
      Cleric: { hp: 110, maxHp: 110, mana: 100, maxMana: 100 }
    };

    this.combatPlayers = this.players.map(p => {
      const preset = CLASS_PRESETS[p.class] || CLASS_PRESETS.Warrior;
      return {
        id: p.id,
        name: p.name,
        class: p.class,
        hp: preset.hp,
        maxHp: preset.maxHp,
        mana: preset.mana,
        maxMana: preset.maxMana,
        isDead: false,
        lastAutoAttack: Date.now() + Math.random() * 1000
      };
    });

    this.activeCombos = {};
    this.manaRegenCounter = 0;

    this.stopCombatLoops();
    this.combatTickInterval = setInterval(() => this.tickCombat(), 100);
    this.bossAiInterval = setInterval(() => this.tickBoss(), 3500);

    const combatData = {
      boss: this.boss,
      players: this.combatPlayers,
      activeCombos: this.activeCombos
    };

    this.broadcastPacket('START_COMBAT', { combatData });
    return { success: true };
  }

  async clientCastSkill(playerId, skillId) {
    if (this.isMock) {
      return await this.castSkill(playerId, skillId);
    }
    const isHost = this.players.find(p => p.id === playerId)?.isHost;
    if (isHost) {
      return await this.castSkill(playerId, skillId);
    } else {
      if (this.steamClient && this.steamLobby) {
        try {
          const payload = JSON.stringify({
            type: 'CAST_SKILL',
            playerId,
            skillId
          });
          const buffer = Buffer.from(payload);
          const ownerId = this.steamLobby.getOwner()?.steamId64;
          if (ownerId) {
            this.steamClient.networking.sendP2PPacket(ownerId, this.steamClient.networking.SendType.Reliable, buffer);
          }
        } catch (e) {
          console.error("Failed to send guest client skill cast to host:", e);
        }
      }
      return { success: true };
    }
  }

  async castSkill(playerId, skillId) {
    const p = this.combatPlayers.find(x => x.id === playerId);
    if (!p || p.isDead || !this.boss || this.boss.isDead) return { success: false };

    const classSkills = SKILL_DATA[p.class] || [];
    const skill = classSkills.find(s => s.id === skillId);
    if (!skill || p.mana < skill.manaCost) return { success: false };

    p.mana -= skill.manaCost;

    let rawDmg = skill.baseDmg;
    let finalDmg = Math.round(rawDmg * (0.9 + Math.random() * 0.2));
    let isCombo = false;
    let isSameSkill = false;
    let comboDmg = 0;

    if (skill.executeTag && this.activeCombos[skill.executeTag]) {
      const activeCombo = this.activeCombos[skill.executeTag];
      if (Date.now() <= activeCombo.endTime) {
        isCombo = true;
        isSameSkill = (activeCombo.primedBySkillId === skillId);
        
        const multiplier = isSameSkill ? 0.6 : 1.0;
        comboDmg = Math.round(skill.comboBonusDmg * multiplier);
        finalDmg += comboDmg;
      }
    }

    let eventText = "";
    if (p.class === 'Cleric' && skillId === 'cleric_active') {
      const lowestHero = this.combatPlayers
        .filter(h => !h.isDead)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      
      let healVal = Math.round(skill.baseDmg * 1.25);
      if (lowestHero) {
        lowestHero.hp = Math.min(lowestHero.maxHp, lowestHero.hp + healVal);
      }

      this.boss.hp = Math.max(0, this.boss.hp - finalDmg);

      eventText = `✨ ${p.name} casts Holy Bolt dealing ${finalDmg} damage to ${this.boss.name} and restoring ${healVal} HP to ${lowestHero ? lowestHero.name : 'the party'}!`;
      if (isCombo) {
        eventText = `💥 COMBO! ✨ ${p.name} triggers Holy Bolt combo on ${this.boss.name} for ${finalDmg} damage! (Healed ${lowestHero ? lowestHero.name : 'party'} for ${healVal} HP) ${isSameSkill ? '[Same-skill penalty]' : ''}`;
      }
    } else {
      this.boss.hp = Math.max(0, this.boss.hp - finalDmg);
      if (isCombo) {
        eventText = `💥 COMBO! ${p.name} detonates ${skill.name} on primed target, dealing ${finalDmg} damage to ${this.boss.name}! ${isSameSkill ? '[Same-skill penalty]' : ''}`;
      } else {
        eventText = `${p.name} casts ${skill.name} dealing ${finalDmg} damage to ${this.boss.name}.`;
      }
    }

    if (skill.primeTag) {
      this.activeCombos[skill.primeTag] = {
        endTime: Date.now() + skill.primeDuration,
        primedBySkillId: skillId
      };
    }

    this.broadcastPacket('COMBAT_EVENT', {
      event: {
        type: isCombo ? 'crit' : 'spell',
        actor: p.name,
        actorClass: p.class,
        target: this.boss.name,
        value: finalDmg,
        bossHp: this.boss.hp,
        text: eventText
      },
      boss: this.boss,
      players: this.combatPlayers,
      activeCombos: this.getActiveCombosList()
    });

    if (this.boss.hp <= 0) {
      this.handleVictory();
    }

    return { success: true };
  }

  getActiveCombosList() {
    const list = {};
    const now = Date.now();
    for (const tag in this.activeCombos) {
      const combo = this.activeCombos[tag];
      const remaining = combo.endTime - now;
      if (remaining > 0) {
        list[tag] = {
          remaining,
          primedBySkillId: combo.primedBySkillId
        };
      }
    }
    return list;
  }

  tickCombat() {
    if (!this.boss || this.boss.isDead) return;

    const now = Date.now();

    let comboExpired = false;
    for (const tag in this.activeCombos) {
      if (now > this.activeCombos[tag].endTime) {
        delete this.activeCombos[tag];
        comboExpired = true;
      }
    }

    this.manaRegenCounter = (this.manaRegenCounter || 0) + 1;
    let statsChanged = false;
    if (this.manaRegenCounter >= 10) {
      this.manaRegenCounter = 0;
      this.combatPlayers.forEach(p => {
        if (!p.isDead && p.mana < p.maxMana) {
          p.mana = Math.min(p.maxMana, p.mana + 5);
          statsChanged = true;
        }
      });
    }

    let autoAttackTriggered = false;
    this.combatPlayers.forEach(p => {
      if (p.isDead) return;
      const classSkills = SKILL_DATA[p.class] || [];
      const autoSkill = classSkills.find(s => s.isAutoAttack);
      if (!autoSkill) return;

      if (now - p.lastAutoAttack >= autoSkill.cooldown) {
        autoAttackTriggered = true;
        p.lastAutoAttack = now;

        const dmg = Math.round(autoSkill.baseDmg * (0.9 + Math.random() * 0.2));
        this.boss.hp = Math.max(0, this.boss.hp - dmg);

        this.broadcastPacket('COMBAT_EVENT', {
          event: {
            type: 'attack',
            actor: p.name,
            actorClass: p.class,
            target: this.boss.name,
            value: dmg,
            bossHp: this.boss.hp,
            text: `${p.name} performs auto-attack: ${autoSkill.name} for ${dmg} damage.`
          },
          boss: this.boss,
          players: this.combatPlayers,
          activeCombos: this.getActiveCombosList()
        });

        if (this.boss.hp <= 0) {
          this.handleVictory();
        }
      }
    });

    if ((statsChanged || comboExpired) && !autoAttackTriggered && !this.boss.isDead) {
      this.broadcastPacket('STATE_UPDATE', {
        boss: this.boss,
        players: this.combatPlayers,
        activeCombos: this.getActiveCombosList()
      });
    }
  }

  tickBoss() {
    if (!this.boss || this.boss.isDead) return;

    const alivePlayers = this.combatPlayers.filter(p => !p.isDead);
    if (alivePlayers.length === 0) return;

    const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    const rawDmg = this.boss.atk * (0.85 + Math.random() * 0.3);
    const finalDmg = Math.round(Math.max(5, rawDmg - (target.class === 'Warrior' ? 12 : 5)));
    target.hp = Math.max(0, target.hp - finalDmg);

    this.broadcastPacket('COMBAT_EVENT', {
      event: {
        type: 'boss_attack',
        actor: this.boss.name,
        target: target.name,
        targetClass: target.class,
        value: finalDmg,
        targetHp: target.hp,
        text: `👹 ${this.boss.name} strikes ${target.name} for ${finalDmg} damage!`
      },
      boss: this.boss,
      players: this.combatPlayers,
      activeCombos: this.getActiveCombosList()
    });

    if (target.hp <= 0) {
      target.isDead = true;
      this.broadcastPacket('COMBAT_EVENT', {
        event: {
          type: 'death',
          target: target.name,
          targetClass: target.class,
          text: `💀 ${target.name} has fallen in battle!`
        },
        boss: this.boss,
        players: this.combatPlayers,
        activeCombos: this.getActiveCombosList()
      });

      const remainingAlive = this.combatPlayers.filter(p => !p.isDead);
      if (remainingAlive.length === 0) {
        this.handleDefeat();
      }
    }
  }

  handleVictory() {
    this.boss.isDead = true;
    this.boss.hp = 0;
    this.stopCombatLoops();

    this.broadcastPacket('RESOLVE_COMBAT', {
      victory: true,
      text: `🏆 ${this.boss.name} has been vanquished! Victory is ours!`
    });
  }

  handleDefeat() {
    this.stopCombatLoops();

    this.broadcastPacket('RESOLVE_COMBAT', {
      victory: false,
      text: `💀 Your party has been wiped out! Defeat.`
    });
  }

  broadcastPacket(type, data) {
    if (!this.isMock && this.steamClient && this.steamLobby) {
      try {
        const payload = JSON.stringify({ type, ...data });
        const buffer = Buffer.from(payload);
        const members = this.steamLobby.getMembers();
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

  stopCombatLoops() {
    if (this.combatTickInterval) {
      clearInterval(this.combatTickInterval);
      this.combatTickInterval = null;
    }
    if (this.bossAiInterval) {
      clearInterval(this.bossAiInterval);
      this.bossAiInterval = null;
    }
  }

  async returnToLobby() {
    this.stopCombatLoops();
    this.boss = null;
    this.combatPlayers = [];
    this.activeCombos = {};
    
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
              } else if (payload.type === 'CAST_SKILL') {
                this.castSkill(payload.playerId, payload.skillId);
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
    this.stopCombatLoops();
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
