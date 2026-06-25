const SKILL_DATA = require('../../shared/skill_data.json');

class HostCombatEngine {
  constructor(p2pManager) {
    this.p2p = p2pManager;
    this.boss = null;
    this.combatPlayers = [];
    this.activeCombos = {};
    this.combatTickInterval = null;
    this.bossAiInterval = null;
    this.manaRegenCounter = 0;
  }

  startCombat(players) {
    const bossList = [
      { name: "Cinder Claw the Red Drake", hp: 300, maxHp: 300, atk: 22, def: 18, spd: 8, icon: "🐉", colorClass: "text-red-400" },
      { name: "Gorgon the Cryptkeeper", hp: 380, maxHp: 380, atk: 17, def: 24, spd: 5, icon: "🧟", colorClass: "text-emerald-400" },
      { name: "Tenebris the Shadow Stalker", hp: 260, maxHp: 260, atk: 28, def: 12, spd: 14, icon: "👤", colorClass: "text-purple-400" }
    ];
    const baseBoss = bossList[Math.floor(Math.random() * bossList.length)];
    const partySize = players.length;
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

    this.combatPlayers = players.map(p => {
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

    this.p2p.broadcastPacket('START_COMBAT', { combatData });
  }

  async clientCastSkill(playerId, skillId, players) {
    if (this.p2p.isMock) {
      return await this.castSkill(playerId, skillId);
    }
    const isHost = players.find(p => p.id === playerId)?.isHost;
    if (isHost) {
      return await this.castSkill(playerId, skillId);
    } else {
      if (this.p2p.steamClient && this.p2p.lobbyManager && this.p2p.lobbyManager.steamLobby) {
        try {
          const payload = JSON.stringify({
            type: 'CAST_SKILL',
            playerId,
            skillId
          });
          const buffer = Buffer.from(payload);
          const ownerId = this.p2p.lobbyManager.steamLobby.getOwner()?.steamId64;
          if (ownerId) {
            this.p2p.steamClient.networking.sendP2PPacket(ownerId, this.p2p.steamClient.networking.SendType.Reliable, buffer);
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

    this.p2p.broadcastPacket('COMBAT_EVENT', {
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

        this.p2p.broadcastPacket('COMBAT_EVENT', {
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
      this.p2p.broadcastPacket('STATE_UPDATE', {
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

    this.p2p.broadcastPacket('COMBAT_EVENT', {
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
      this.p2p.broadcastPacket('COMBAT_EVENT', {
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

    this.p2p.broadcastPacket('RESOLVE_COMBAT', {
      victory: true,
      text: `🏆 ${this.boss.name} has been vanquished! Victory is ours!`
    });
  }

  handleDefeat() {
    this.stopCombatLoops();

    this.p2p.broadcastPacket('RESOLVE_COMBAT', {
      victory: false,
      text: `💀 Your party has been wiped out! Defeat.`
    });
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

  reset() {
    this.stopCombatLoops();
    this.boss = null;
    this.combatPlayers = [];
    this.activeCombos = {};
  }
}

module.exports = HostCombatEngine;
