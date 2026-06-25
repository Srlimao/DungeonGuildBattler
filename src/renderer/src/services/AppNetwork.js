import SKILL_DATA from '../../../shared/skill_data.json';

let playersUpdateCallbacks = new Set();
let updateStatusCallbacks = new Set();
let gameStateCallbacks = new Set();
let combatEventCallbacks = new Set();
let combatStateUpdateCallbacks = new Set();
let combatResolveCallbacks = new Set();

let mockBoss = null;
let mockCombatPlayers = [];
let mockActiveCombos = {};
let mockCombatTickInterval = null;
let mockBossAiInterval = null;
let mockFriendsActionInterval = null;
let mockManaRegenCounter = 0;

let mockLobbyPlayers = [];
let mockLobbies = [
  { id: "MOCK_LOBBY_1", name: "Valiant Shields Guild", hostName: "Soren", memberCount: 3, maxPlayers: 10, players: [
    { id: "mock_host_1", name: "Soren (Host)", class: "Warrior", x: 150, y: 200, isHost: true, ready: true },
    { id: "mock_guest_1a", name: "Kaelen", class: "Mage", x: 280, y: 260, isHost: false, ready: true },
    { id: "mock_guest_1b", name: "Lira", class: "Rogue", x: 410, y: 190, isHost: false, ready: true }
  ] },
  { id: "MOCK_LOBBY_2", name: "Arcane Spells Sanctum", hostName: "Eldrin", memberCount: 5, maxPlayers: 10, players: [
    { id: "mock_host_2", name: "Eldrin (Host)", class: "Mage", x: 150, y: 200, isHost: true, ready: true },
    { id: "mock_guest_2a", name: "Garrick", class: "Warrior", x: 300, y: 310, isHost: false, ready: true },
    { id: "mock_guest_2b", name: "Jumina", class: "Cleric", x: 220, y: 150, isHost: false, ready: true },
    { id: "mock_guest_2c", name: "Varis", class: "Rogue", x: 500, y: 280, isHost: false, ready: true },
    { id: "mock_guest_2d", name: "Faelar", class: "Warrior", x: 450, y: 200, isHost: false, ready: true }
  ] },
  { id: "MOCK_LOBBY_3", name: "Dagger in the Dark", hostName: "Valera", memberCount: 2, maxPlayers: 10, players: [
    { id: "mock_host_3", name: "Valera (Host)", class: "Rogue", x: 150, y: 200, isHost: true, ready: true },
    { id: "mock_guest_3a", name: "Darek", class: "Warrior", x: 300, y: 250, isHost: false, ready: true }
  ] }
];

let activeLobbyId = null;
let localPlayerId = null;
let isMockEnvironment = typeof window.api === 'undefined';
let simulationInterval = null;

// Helper to start the dynamic mock player movements
function startSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  
  simulationInterval = setInterval(async () => {
    if (isMockEnvironment) {
      let changed = false;
      mockLobbyPlayers = mockLobbyPlayers.map(p => {
        if (p.id !== localPlayerId && (p.id.startsWith('mock') || p.id.startsWith('browser_mock'))) {
          changed = true;
          let newX = p.x + Math.floor(Math.random() * 40 - 20);
          let newY = p.y + Math.floor(Math.random() * 40 - 20);
          if (newX < 50) newX = 50;
          if (newX > 750) newX = 750;
          if (newY < 50) newY = 350;
          if (newY > 350) newY = 350;
          return { ...p, x: newX, y: newY };
        }
        return p;
      });
      if (changed) {
        playersUpdateCallbacks.forEach(cb => cb([...mockLobbyPlayers]));
      }
    } else {
      // Electron environment: trigger main-process friend move if we have mock players
      const hasMockFriends = mockLobbyPlayers.some(p => p.id && p.id.includes('mock'));
      if (hasMockFriends && window.api.simulateFriendMove) {
        try {
          const res = await window.api.simulateFriendMove();
          if (res.success) {
            mockLobbyPlayers = res.players;
            playersUpdateCallbacks.forEach(cb => cb(mockLobbyPlayers));
          }
        } catch (e) {
          console.error("Simulation error in Electron:", e);
        }
      }
    }
  }, 3000);
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

// Forward updates from electron main process if available
if (!isMockEnvironment) {
  window.api.onPlayersUpdate((players) => {
    mockLobbyPlayers = players;
    playersUpdateCallbacks.forEach(cb => cb(players));
  });
  window.api.onGameStateChange((data) => {
    gameStateCallbacks.forEach(cb => cb(data));
  });
  window.api.onCombatEvent((data) => {
    combatEventCallbacks.forEach(cb => cb(data.event));
    if (data.boss) mockBoss = data.boss;
    if (data.players) mockCombatPlayers = data.players;
    if (data.activeCombos) mockActiveCombos = data.activeCombos;
    combatStateUpdateCallbacks.forEach(cb => cb({ boss: mockBoss, players: mockCombatPlayers, activeCombos: mockActiveCombos }));
  });
  window.api.onCombatStateUpdate((data) => {
    if (data.boss) mockBoss = data.boss;
    if (data.players) mockCombatPlayers = data.players;
    if (data.activeCombos) mockActiveCombos = data.activeCombos;
    combatStateUpdateCallbacks.forEach(cb => cb({ boss: mockBoss, players: mockCombatPlayers, activeCombos: mockActiveCombos }));
  });
  window.api.onCombatResolve((data) => {
    combatResolveCallbacks.forEach(cb => cb(data));
  });
  window.api.onUpdateStatus((statusInfo) => {
    updateStatusCallbacks.forEach(cb => cb(statusInfo));
  });
}

export const AppNetwork = {
  isMock: () => isMockEnvironment,
  
  createLobby: async (hostData) => {
    if (isMockEnvironment) {
      activeLobbyId = 'DG-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      localPlayerId = hostData.id;
      const hostPlayer = {
        id: hostData.id,
        name: hostData.name,
        class: hostData.class,
        x: 150,
        y: 200,
        isHost: true,
        ready: false
      };
      mockLobbyPlayers = [hostPlayer];
      
      mockLobbies.push({
        id: activeLobbyId,
        name: hostData.lobbyName || `${hostData.name}'s Guild`,
        hostName: hostData.name,
        memberCount: 1,
        maxPlayers: 10,
        players: mockLobbyPlayers
      });
      
      playersUpdateCallbacks.forEach(cb => cb(mockLobbyPlayers));
      startSimulation();
      return { success: true, lobbyId: activeLobbyId, players: mockLobbyPlayers, isMock: true, localPlayerId: localPlayerId };
    } else {
      const res = await window.api.createLobby(hostData);
      if (res.success) {
        mockLobbyPlayers = res.players;
        localPlayerId = res.localPlayerId;
        if (res.isMock) {
          startSimulation();
        }
      }
      return res;
    }
  },

  listLobbies: async () => {
    if (isMockEnvironment) {
      return mockLobbies.map(l => ({
        id: l.id,
        name: l.name,
        hostName: l.hostName,
        memberCount: l.players.length,
        maxPlayers: l.maxPlayers
      }));
    } else {
      return await window.api.listLobbies();
    }
  },

  joinLobby: async (lobbyId, playerData) => {
    if (isMockEnvironment) {
      const query = (lobbyId || '').toUpperCase().trim();
      const match = mockLobbies.find(l => l.id.toUpperCase() === query);
      if (!match) return { success: false, error: "Lobby not found" };
      if (match.players.length >= 10) return { success: false, error: "Lobby is full (Max 10 players)" };
      
      activeLobbyId = match.id;
      localPlayerId = playerData.id;
      mockLobbyPlayers = JSON.parse(JSON.stringify(match.players));
      
      if (!mockLobbyPlayers.some(p => p.id === localPlayerId)) {
        const guestPlayer = {
          id: localPlayerId,
          name: playerData.name || 'Guild Guest',
          class: playerData.class || 'Mage',
          x: 350,
          y: 280,
          isHost: false,
          ready: false
        };
        mockLobbyPlayers.push(guestPlayer);
        match.players = JSON.parse(JSON.stringify(mockLobbyPlayers));
        match.memberCount = mockLobbyPlayers.length;
      }
      
      playersUpdateCallbacks.forEach(cb => cb(mockLobbyPlayers));
      startSimulation();
      return { success: true, lobbyId: activeLobbyId, players: mockLobbyPlayers, isMock: true, localPlayerId: localPlayerId };
    } else {
      const res = await window.api.joinLobby(lobbyId, playerData);
      if (res.success) {
        mockLobbyPlayers = res.players;
        localPlayerId = res.localPlayerId;
        if (res.isMock) {
          startSimulation();
        }
      }
      return res;
    }
  },

  sendPosition: async (playerId, x, y) => {
    if (isMockEnvironment) {
      const p = mockLobbyPlayers.find(player => player.id === playerId);
      if (p) {
        p.x = x;
        p.y = y;
      }
      playersUpdateCallbacks.forEach(cb => cb([...mockLobbyPlayers]));
      return { success: true, players: mockLobbyPlayers };
    } else {
      const res = await window.api.sendPosition(playerId, x, y);
      if (res.success) {
        mockLobbyPlayers = res.players;
      }
      return res;
    }
  },

  leaveLobby: async () => {
    stopSimulation();
    mockLobbyPlayers = [];
    activeLobbyId = null;
    localPlayerId = null;
    
    if (!isMockEnvironment) {
      return await window.api.leaveLobby();
    }
    return { success: true };
  },

  simulateJoin: async () => {
    if (isMockEnvironment) {
      if (mockLobbyPlayers.length >= 10) return { success: false, error: "Lobby is full" };
      const names = ["Alex", "Jordan", "Morgan", "Taylor", "Casey", "Sam", "Pat", "Robin", "Finley"];
      const classes = ["Warrior", "Mage", "Rogue", "Cleric"];
      
      const newFriend = {
        id: 'browser_mock_' + Date.now(),
        name: names[Math.floor(Math.random() * names.length)] + ` #${mockLobbyPlayers.length}`,
        class: classes[Math.floor(Math.random() * classes.length)],
        x: Math.random() * 300 + 100,
        y: Math.random() * 200 + 100,
        isHost: false,
        ready: false
      };
      
      mockLobbyPlayers.push(newFriend);
      playersUpdateCallbacks.forEach(cb => cb([...mockLobbyPlayers]));
      
      // Auto-ready after 2 seconds
      setTimeout(() => {
        const p = mockLobbyPlayers.find(x => x.id === newFriend.id);
        if (p) {
          p.ready = true;
          playersUpdateCallbacks.forEach(cb => cb([...mockLobbyPlayers]));
          
          // If we are a guest in a mock lobby and all players are now ready, auto-trigger combat
          const localHero = mockLobbyPlayers.find(x => x.id === localPlayerId);
          if (localHero && !localHero.isHost) {
            const allReady = mockLobbyPlayers.every(x => x.ready);
            if (allReady) {
              setTimeout(() => {
                AppNetwork.startCombat();
              }, 1000);
            }
          }
        }
      }, 2000);

      return { success: true, players: mockLobbyPlayers };
    } else {
      const res = await window.api.simulateJoin();
      if (res.success) {
        mockLobbyPlayers = res.players;
      }
      return res;
    }
  },

  sendReady: async (playerId, ready) => {
    if (isMockEnvironment) {
      const p = mockLobbyPlayers.find(player => player.id === playerId);
      if (p) {
        p.ready = ready;
      }
      playersUpdateCallbacks.forEach(cb => cb([...mockLobbyPlayers]));
      
      if (p && ready && !p.isHost) {
        const allReady = mockLobbyPlayers.every(x => x.ready);
        if (allReady) {
          setTimeout(() => {
            AppNetwork.startCombat();
          }, 1500);
        }
      }
      return { success: true, players: mockLobbyPlayers };
    } else {
      return await window.api.sendReady(playerId, ready);
    }
  },

  startCombat: async () => {
    if (isMockEnvironment) {
      const bossList = [
        { name: "Cinder Claw the Red Drake", hp: 300, maxHp: 300, atk: 22, def: 18, spd: 8, icon: "🐉", colorClass: "text-red-400" },
        { name: "Gorgon the Cryptkeeper", hp: 380, maxHp: 380, atk: 17, def: 24, spd: 5, icon: "🧟", colorClass: "text-emerald-400" },
        { name: "Tenebris the Shadow Stalker", hp: 260, maxHp: 260, atk: 28, def: 12, spd: 14, icon: "👤", colorClass: "text-purple-400" }
      ];
      const baseBoss = bossList[Math.floor(Math.random() * bossList.length)];
      const partySize = mockLobbyPlayers.length;
      const scaledHp = baseBoss.hp + (partySize - 1) * 80;
      
      mockBoss = {
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

      mockCombatPlayers = mockLobbyPlayers.map(p => {
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

      mockActiveCombos = {};
      mockManaRegenCounter = 0;

      stopMockCombatLoops();
      mockCombatTickInterval = setInterval(() => tickMockCombat(), 100);
      mockBossAiInterval = setInterval(() => tickMockBoss(), 3500);
      mockFriendsActionInterval = setInterval(() => tickMockFriends(), 2200);

      const combatData = {
        boss: mockBoss,
        players: mockCombatPlayers,
        activeCombos: mockActiveCombos
      };

      gameStateCallbacks.forEach(cb => cb({ screen: 'combat', combatData }));
      return { success: true };
    } else {
      return await window.api.startCombat();
    }
  },

  castSkill: async (skillId) => {
    if (isMockEnvironment) {
      return mockCastSkill(localPlayerId, skillId);
    } else {
      return await window.api.castSkill(localPlayerId, skillId);
    }
  },

  returnToLobby: async () => {
    if (isMockEnvironment) {
      stopMockCombatLoops();
      mockBoss = null;
      mockCombatPlayers = [];
      mockActiveCombos = {};

      mockLobbyPlayers.forEach(p => p.ready = false);
      playersUpdateCallbacks.forEach(cb => cb([...mockLobbyPlayers]));
      gameStateCallbacks.forEach(cb => cb({ screen: 'guild-lobby' }));
      return { success: true };
    } else {
      return await window.api.returnToLobby();
    }
  },

  onPlayersUpdate: (callback) => {
    playersUpdateCallbacks.add(callback);
    if (mockLobbyPlayers.length > 0) {
      callback(mockLobbyPlayers);
    }
    return () => {
      playersUpdateCallbacks.delete(callback);
    };
  },

  onGameStateChange: (callback) => {
    gameStateCallbacks.add(callback);
    return () => {
      gameStateCallbacks.delete(callback);
    };
  },

  onCombatEvent: (callback) => {
    combatEventCallbacks.add(callback);
    return () => {
      combatEventCallbacks.delete(callback);
    };
  },

  onCombatStateUpdate: (callback) => {
    combatStateUpdateCallbacks.add(callback);
    return () => {
      combatStateUpdateCallbacks.delete(callback);
    };
  },

  onCombatResolve: (callback) => {
    combatResolveCallbacks.add(callback);
    return () => {
      combatResolveCallbacks.delete(callback);
    };
  },

  onUpdateStatus: (callback) => {
    updateStatusCallbacks.add(callback);
    return () => {
      updateStatusCallbacks.delete(callback);
    };
  },

  installUpdate: () => {
    if (!isMockEnvironment) {
      window.api.installUpdate();
    }
  }
};

function stopMockCombatLoops() {
  if (mockCombatTickInterval) {
    clearInterval(mockCombatTickInterval);
    mockCombatTickInterval = null;
  }
  if (mockBossAiInterval) {
    clearInterval(mockBossAiInterval);
    mockBossAiInterval = null;
  }
  if (mockFriendsActionInterval) {
    clearInterval(mockFriendsActionInterval);
    mockFriendsActionInterval = null;
  }
}

function getMockActiveCombosList() {
  const list = {};
  const now = Date.now();
  for (const tag in mockActiveCombos) {
    const combo = mockActiveCombos[tag];
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

function mockCastSkill(playerId, skillId) {
  const p = mockCombatPlayers.find(x => x.id === playerId);
  if (!p || p.isDead || !mockBoss || mockBoss.isDead) return { success: false };

  const classSkills = SKILL_DATA[p.class] || [];
  const skill = classSkills.find(s => s.id === skillId);
  if (!skill || p.mana < skill.manaCost) return { success: false };

  p.mana -= skill.manaCost;

  let rawDmg = skill.baseDmg;
  let finalDmg = Math.round(rawDmg * (0.9 + Math.random() * 0.2));
  let isCombo = false;
  let isSameSkill = false;
  let comboDmg = 0;

  if (skill.executeTag && mockActiveCombos[skill.executeTag]) {
    const activeCombo = mockActiveCombos[skill.executeTag];
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
    const lowestHero = mockCombatPlayers
      .filter(h => !h.isDead)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    
    let healVal = Math.round(skill.baseDmg * 1.25);
    if (lowestHero) {
      lowestHero.hp = Math.min(lowestHero.maxHp, lowestHero.hp + healVal);
    }

    mockBoss.hp = Math.max(0, mockBoss.hp - finalDmg);

    eventText = `✨ ${p.name} casts Holy Bolt dealing ${finalDmg} damage to ${mockBoss.name} and restoring ${healVal} HP to ${lowestHero ? lowestHero.name : 'the party'}!`;
    if (isCombo) {
      eventText = `💥 COMBO! ✨ ${p.name} triggers Holy Bolt combo on ${mockBoss.name} for ${finalDmg} damage! (Healed ${lowestHero ? lowestHero.name : 'party'} for ${healVal} HP) ${isSameSkill ? '[Same-skill penalty]' : ''}`;
    }
  } else {
    mockBoss.hp = Math.max(0, mockBoss.hp - finalDmg);
    if (isCombo) {
      eventText = `💥 COMBO! ${p.name} detonates ${skill.name} on primed target, dealing ${finalDmg} damage to ${mockBoss.name}! ${isSameSkill ? '[Same-skill penalty]' : ''}`;
    } else {
      eventText = `${p.name} casts ${skill.name} dealing ${finalDmg} damage to ${mockBoss.name}.`;
    }
  }

  if (skill.primeTag) {
    mockActiveCombos[skill.primeTag] = {
      endTime: Date.now() + skill.primeDuration,
      primedBySkillId: skillId
    };
  }

  const event = {
    type: isCombo ? 'crit' : 'spell',
    actor: p.name,
    actorClass: p.class,
    target: mockBoss.name,
    value: finalDmg,
    bossHp: mockBoss.hp,
    text: eventText
  };

  combatEventCallbacks.forEach(cb => cb(event));
  combatStateUpdateCallbacks.forEach(cb => cb({ boss: mockBoss, players: mockCombatPlayers, activeCombos: getMockActiveCombosList() }));

  if (mockBoss.hp <= 0) {
    handleMockVictory();
  }

  return { success: true };
}

function tickMockCombat() {
  if (!mockBoss || mockBoss.isDead) return;
  const now = Date.now();

  let comboExpired = false;
  for (const tag in mockActiveCombos) {
    if (now > mockActiveCombos[tag].endTime) {
      delete mockActiveCombos[tag];
      comboExpired = true;
    }
  }

  mockManaRegenCounter = (mockManaRegenCounter || 0) + 1;
  let statsChanged = false;
  if (mockManaRegenCounter >= 10) {
    mockManaRegenCounter = 0;
    mockCombatPlayers.forEach(p => {
      if (!p.isDead && p.mana < p.maxMana) {
        p.mana = Math.min(p.maxMana, p.mana + 5);
        statsChanged = true;
      }
    });
  }

  let autoAttackTriggered = false;
  mockCombatPlayers.forEach(p => {
    if (p.isDead) return;
    const classSkills = SKILL_DATA[p.class] || [];
    const autoSkill = classSkills.find(s => s.isAutoAttack);
    if (!autoSkill) return;

    if (now - p.lastAutoAttack >= autoSkill.cooldown) {
      autoAttackTriggered = true;
      p.lastAutoAttack = now;

      const dmg = Math.round(autoSkill.baseDmg * (0.9 + Math.random() * 0.2));
      mockBoss.hp = Math.max(0, mockBoss.hp - dmg);

      const event = {
        type: 'attack',
        actor: p.name,
        actorClass: p.class,
        target: mockBoss.name,
        value: dmg,
        bossHp: mockBoss.hp,
        text: `${p.name} performs auto-attack: ${autoSkill.name} for ${dmg} damage.`
      };

      combatEventCallbacks.forEach(cb => cb(event));
      combatStateUpdateCallbacks.forEach(cb => cb({ boss: mockBoss, players: mockCombatPlayers, activeCombos: getMockActiveCombosList() }));

      if (mockBoss.hp <= 0) {
        handleMockVictory();
      }
    }
  });

  if ((statsChanged || comboExpired) && !autoAttackTriggered && !mockBoss.isDead) {
    combatStateUpdateCallbacks.forEach(cb => cb({ boss: mockBoss, players: mockCombatPlayers, activeCombos: getMockActiveCombosList() }));
  }
}

function tickMockBoss() {
  if (!mockBoss || mockBoss.isDead) return;

  const alivePlayers = mockCombatPlayers.filter(p => !p.isDead);
  if (alivePlayers.length === 0) return;

  const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  const rawDmg = mockBoss.atk * (0.85 + Math.random() * 0.3);
  const finalDmg = Math.round(Math.max(5, rawDmg - (target.class === 'Warrior' ? 12 : 5)));
  target.hp = Math.max(0, target.hp - finalDmg);

  const event = {
    type: 'boss_attack',
    actor: mockBoss.name,
    target: target.name,
    targetClass: target.class,
    value: finalDmg,
    targetHp: target.hp,
    text: `👹 ${mockBoss.name} strikes ${target.name} for ${finalDmg} damage!`
  };

  combatEventCallbacks.forEach(cb => cb(event));
  combatStateUpdateCallbacks.forEach(cb => cb({ boss: mockBoss, players: mockCombatPlayers, activeCombos: getMockActiveCombosList() }));

  if (target.hp <= 0) {
    target.isDead = true;
    const deathEvent = {
      type: 'death',
      target: target.name,
      targetClass: target.class,
      text: `💀 ${target.name} has fallen in battle!`
    };
    
    combatEventCallbacks.forEach(cb => cb(deathEvent));
    combatStateUpdateCallbacks.forEach(cb => cb({ boss: mockBoss, players: mockCombatPlayers, activeCombos: getMockActiveCombosList() }));

    const remainingAlive = mockCombatPlayers.filter(p => !p.isDead);
    if (remainingAlive.length === 0) {
      handleMockDefeat();
    }
  }
}

function tickMockFriends() {
  if (!mockBoss || mockBoss.isDead) return;

  mockCombatPlayers.forEach(p => {
    if (p.isDead || p.id === localPlayerId) return;

    const classSkills = SKILL_DATA[p.class] || [];
    const activeSkill = classSkills.find(s => !s.isAutoAttack);
    if (!activeSkill || p.mana < activeSkill.manaCost) return;

    // Simulated action cooldown check (cooldown + slight random lag)
    const timeSinceLast = Date.now() - (p.lastActiveSkillTime || 0);
    if (timeSinceLast >= activeSkill.cooldown + Math.random() * 1500) {
      p.lastActiveSkillTime = Date.now();
      mockCastSkill(p.id, activeSkill.id);
    }
  });
}

function handleMockVictory() {
  mockBoss.isDead = true;
  mockBoss.hp = 0;
  stopMockCombatLoops();

  combatResolveCallbacks.forEach(cb => cb({
    victory: true,
    text: `🏆 ${mockBoss.name} has been vanquished! Victory is ours!`
  }));
}

function handleMockDefeat() {
  stopMockCombatLoops();

  combatResolveCallbacks.forEach(cb => cb({
    victory: false,
    text: `💀 Your party has been wiped out! Defeat.`
  }));
}

function runCombatSimulation(players) {
  const bossList = [
    { name: "Cinder Claw the Red Drake", hp: 300, maxHp: 300, atk: 22, def: 18, spd: 8, icon: "🐉", colorClass: "text-red-400" },
    { name: "Gorgon the Cryptkeeper", hp: 380, maxHp: 380, atk: 17, def: 24, spd: 5, icon: "🧟", colorClass: "text-emerald-400" },
    { name: "Tenebris the Shadow Stalker", hp: 260, maxHp: 260, atk: 28, def: 12, spd: 14, icon: "👤", colorClass: "text-purple-400" }
  ];
  
  const baseBoss = bossList[Math.floor(Math.random() * bossList.length)];
  const partySize = players.length;
  const scaledHp = baseBoss.hp + (partySize - 1) * 80;
  const boss = {
    name: baseBoss.name,
    hp: scaledHp,
    maxHp: scaledHp,
    atk: baseBoss.atk,
    def: baseBoss.def,
    spd: baseBoss.spd,
    icon: baseBoss.icon,
    colorClass: baseBoss.colorClass
  };

  const CLASS_PRESETS = {
    Warrior: { hp: 140, atk: 18, def: 15, spd: 7, icon: "⚔️" },
    Mage: { hp: 85, atk: 25, def: 6, spd: 10, icon: "🔥" },
    Rogue: { hp: 100, atk: 20, def: 8, spd: 15, icon: "⚡" },
    Cleric: { hp: 110, atk: 12, def: 10, spd: 9, icon: "🌟" }
  };

  let heroes = players.map(p => {
    const preset = CLASS_PRESETS[p.class] || CLASS_PRESETS.Warrior;
    return {
      id: p.id,
      name: p.name,
      class: p.class,
      hp: preset.hp,
      maxHp: preset.hp,
      atk: preset.atk,
      def: preset.def,
      spd: preset.spd,
      icon: preset.icon,
      isDead: false
    };
  });

  const combatLog = [];
  let round = 1;
  const maxRounds = 50;

  while (round <= maxRounds) {
    let aliveHeroes = heroes.filter(h => !h.isDead);
    if (aliveHeroes.length === 0 || boss.hp <= 0) break;

    let turnOrder = [
      ...aliveHeroes.map(h => ({ type: 'hero', ref: h })),
      { type: 'boss', ref: boss }
    ].sort((a, b) => b.ref.spd - a.ref.spd);

    combatLog.push({ type: 'round_start', value: round });

    for (const current of turnOrder) {
      if (current.type === 'hero' && current.ref.isDead) continue;
      if (current.type === 'boss' && boss.hp <= 0) continue;

      if (current.type === 'hero') {
        const hero = current.ref;
        if (hero.class === 'Warrior') {
          const dmg = Math.max(5, Math.round(hero.atk * (0.9 + Math.random() * 0.2) - (boss.def * 0.3)));
          boss.hp = Math.max(0, boss.hp - dmg);
          combatLog.push({
            type: 'attack',
            actor: hero.name,
            actorClass: hero.class,
            target: boss.name,
            value: dmg,
            bossHp: boss.hp,
            text: `${hero.name} (Warrior) slashes ${boss.name} for ${dmg} damage!`
          });
        } else if (hero.class === 'Mage') {
          const dmg = Math.max(8, Math.round((hero.atk * 1.35) * (0.9 + Math.random() * 0.2) - (boss.def * 0.15)));
          boss.hp = Math.max(0, boss.hp - dmg);
          combatLog.push({
            type: 'spell',
            actor: hero.name,
            actorClass: hero.class,
            target: boss.name,
            value: dmg,
            bossHp: boss.hp,
            text: `${hero.name} (Mage) casts Fireball on ${boss.name} dealing ${dmg} magic damage!`
          });
        } else if (hero.class === 'Rogue') {
          const isCrit = Math.random() < 0.35;
          const baseDmg = hero.atk * (0.8 + Math.random() * 0.3);
          const finalDmg = Math.max(6, Math.round((isCrit ? baseDmg * 2.2 : baseDmg) - (boss.def * 0.2)));
          boss.hp = Math.max(0, boss.hp - finalDmg);
          combatLog.push({
            type: isCrit ? 'crit' : 'attack',
            actor: hero.name,
            actorClass: hero.class,
            target: boss.name,
            value: finalDmg,
            bossHp: boss.hp,
            text: isCrit 
              ? `💥 Critical Hit! ${hero.name} (Rogue) backstabs ${boss.name} for a massive ${finalDmg} damage!`
              : `${hero.name} (Rogue) stabs ${boss.name} for ${finalDmg} damage!`
          });
        } else if (hero.class === 'Cleric') {
          const damagedHeroes = heroes.filter(h => !h.isDead && h.hp < h.maxHp);
          if (damagedHeroes.length > 0) {
            damagedHeroes.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
            const targetHero = damagedHeroes[0];
            const healVal = Math.round(hero.atk * 1.25 + Math.random() * 5);
            targetHero.hp = Math.min(targetHero.maxHp, targetHero.hp + healVal);
            combatLog.push({
              type: 'heal',
              actor: hero.name,
              actorClass: hero.class,
              target: targetHero.name,
              value: healVal,
              targetHp: targetHero.hp,
              text: `✨ ${hero.name} (Cleric) casts Holy Light on ${targetHero.name}, restoring ${healVal} HP!`
            });
          } else {
            const dmg = Math.max(4, Math.round(hero.atk * 0.9 - boss.def * 0.2));
            boss.hp = Math.max(0, boss.hp - dmg);
            combatLog.push({
              type: 'spell',
              actor: hero.name,
              actorClass: hero.class,
              target: boss.name,
              value: dmg,
              bossHp: boss.hp,
              text: `${hero.name} (Cleric) smites ${boss.name} for ${dmg} holy damage.`
            });
          }
        }
      } else {
        const targetHero = aliveHeroes[Math.floor(Math.random() * aliveHeroes.length)];
        const rawDmg = boss.atk * (0.85 + Math.random() * 0.3);
        const finalDmg = Math.max(5, Math.round(rawDmg - targetHero.def));
        targetHero.hp = Math.max(0, targetHero.hp - finalDmg);
        
        combatLog.push({
          type: 'boss_attack',
          actor: boss.name,
          target: targetHero.name,
          targetClass: targetHero.class,
          value: finalDmg,
          targetHp: targetHero.hp,
          text: `👹 ${boss.name} strikes ${targetHero.name} for ${finalDmg} damage!`
        });

        if (targetHero.hp <= 0) {
          targetHero.isDead = true;
          combatLog.push({
            type: 'death',
            target: targetHero.name,
            targetClass: targetHero.class,
            text: `💀 ${targetHero.name} has fallen in battle!`
          });
          aliveHeroes = heroes.filter(h => !h.isDead);
          if (aliveHeroes.length === 0) break;
        }
      }

      if (boss.hp <= 0) {
        combatLog.push({
          type: 'victory',
          text: `🏆 ${boss.name} has been vanquished! Victory is ours!`
        });
        break;
      }
    }

    if (heroes.filter(h => !h.isDead).length === 0) {
      combatLog.push({
        type: 'defeat',
        text: `💀 Your party has been wiped out! Defeat.`
      });
      break;
    }

    round++;
  }

  return {
    monster: {
      name: boss.name,
      maxHp: boss.maxHp,
      icon: boss.icon,
      colorClass: boss.colorClass
    },
    combatLog,
    victory: boss.hp <= 0
  };
}
