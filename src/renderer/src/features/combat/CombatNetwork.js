import SKILL_DATA from '../../../../shared/skill_data.json';
import { LobbyNetwork, registerCombatNetwork } from '../lobby/LobbyNetwork';

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

let isMockEnvironment = typeof window.api === 'undefined';

if (!isMockEnvironment) {
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
}

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

  const localId = LobbyNetwork.getLocalPlayerId();
  mockCombatPlayers.forEach(p => {
    if (p.isDead || p.id === localId) return;

    const classSkills = SKILL_DATA[p.class] || [];
    const activeSkill = classSkills.find(s => !s.isAutoAttack);
    if (!activeSkill || p.mana < activeSkill.manaCost) return;

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

// Global handle for mock defeat
function handleMockDefeat() {
  stopMockCombatLoops();

  combatResolveCallbacks.forEach(cb => cb({
    victory: false,
    text: `💀 Your party has been wiped out! Defeat.`
  }));
}

export const CombatNetwork = {
  startCombat: async () => {
    if (isMockEnvironment) {
      const mockLobbyPlayers = LobbyNetwork.getMockPlayers();
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
    const localId = LobbyNetwork.getLocalPlayerId();
    if (isMockEnvironment) {
      return mockCastSkill(localId, skillId);
    } else {
      return await window.api.castSkill(localId, skillId);
    }
  },

  returnToLobby: async () => {
    if (isMockEnvironment) {
      stopMockCombatLoops();
      mockBoss = null;
      mockCombatPlayers = [];
      mockActiveCombos = {};

      LobbyNetwork.resetReadyState();
      gameStateCallbacks.forEach(cb => cb({ screen: 'guild-lobby' }));
      return { success: true };
    } else {
      return await window.api.returnToLobby();
    }
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
  }
};

registerCombatNetwork(CombatNetwork);
