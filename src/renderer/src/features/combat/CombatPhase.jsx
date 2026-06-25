import React, { useState, useEffect } from 'react';
import SKILL_DATA from '../../../../shared/skill_data.json';
import { CombatNetwork } from './CombatNetwork';
import CombatBattleground from './CombatBattleground';
import CombatRetroMenu from './CombatRetroMenu';
import CombatVictoryDefeatOverlay from './CombatVictoryDefeatOverlay';

export default function CombatPhase({ combatData, localPlayer, onReturnToLobby }) {
  const [bossState, setBossState] = useState(() => ({
    ...combatData.boss,
    floatTexts: [],
    flashDamage: false
  }));

  const [playersState, setPlayersState] = useState(() => {
    return combatData.players.map(p => ({
      ...p,
      floatTexts: [],
      flashDamage: false
    }));
  });

  const [activeCombos, setActiveCombos] = useState(combatData.activeCombos || {});
  const [isCompleted, setIsCompleted] = useState(false);
  const [victory, setVictory] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Retrieve active skill for local player
  const classSkills = SKILL_DATA[localPlayer?.class] || [];
  const activeSkill = classSkills.find(s => !s.isAutoAttack);

  // Cooldown timer loop
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 100));
    }, 100);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Real-time P2P Combat event subscriptions
  useEffect(() => {
    const unsubEvent = CombatNetwork.onCombatEvent((event) => {
      if (event.type === 'attack' || event.type === 'spell' || event.type === 'crit') {
        handleFloatText(null, true, `-${event.value}`, event.type === 'crit' ? 'crit' : 'dmg');
      } else if (event.type === 'boss_attack') {
        const targetHero = playersState.find(h => h.name === event.target);
        if (targetHero) {
          handleFloatText(targetHero.id, false, `-${event.value}`, 'dmg');
        }
      } else if (event.type === 'heal') {
        const targetHero = playersState.find(h => h.name === event.target);
        if (targetHero) {
          handleFloatText(targetHero.id, false, `+${event.value}`, 'heal');
        }
      }
    });

    const unsubState = CombatNetwork.onCombatStateUpdate((data) => {
      if (data.boss) {
        setBossState(prev => ({ ...prev, hp: data.boss.hp, isDead: data.boss.isDead }));
      }
      if (data.players) {
        setPlayersState(prev => prev.map(h => {
          const updated = data.players.find(x => x.id === h.id);
          return updated ? { ...h, hp: updated.hp, mana: updated.mana, isDead: updated.isDead } : h;
        }));
      }
      if (data.activeCombos) {
        setActiveCombos(data.activeCombos);
      }
    });

    const unsubResolve = CombatNetwork.onCombatResolve((data) => {
      setVictory(data.victory);
      setIsCompleted(true);
    });

    return () => {
      unsubEvent();
      unsubState();
      unsubResolve();
    };
  }, [playersState]);

  // Clean up floating text animations
  useEffect(() => {
    const handle = setInterval(() => {
      const now = Date.now();
      setPlayersState(prev => prev.map(h => ({
        ...h,
        floatTexts: h.floatTexts.filter(f => now - f.id < 900)
      })));
      setBossState(prev => ({
        ...prev,
        floatTexts: prev.floatTexts.filter(f => now - f.id < 900)
      }));
    }, 200);
    return () => clearInterval(handle);
  }, []);

  const handleFloatText = (targetId, isBoss, text, type) => {
    const floatObj = { id: Date.now() + Math.random(), text, type };
    if (isBoss) {
      setBossState(prev => ({ ...prev, flashDamage: true, floatTexts: [...prev.floatTexts, floatObj] }));
      setTimeout(() => setBossState(prev => ({ ...prev, flashDamage: false })), 300);
    } else {
      setPlayersState(prev => prev.map(p => {
        if (p.id === targetId) {
          return { ...p, flashDamage: true, floatTexts: [...p.floatTexts, floatObj] };
        }
        return p;
      }));
      setTimeout(() => setPlayersState(prev => prev.map(p => p.id === targetId ? { ...p, flashDamage: false } : p)), 300);
    }
  };

  const handleCastSkill = async () => {
    if (cooldownRemaining > 0 || !activeSkill) return;
    const localHero = playersState.find(p => p.id === localPlayer?.id);
    if (!localHero || localHero.isDead || localHero.mana < activeSkill.manaCost) return;

    setCooldownRemaining(activeSkill.cooldown);
    setPlayersState(prev => prev.map(h => h.id === localPlayer?.id ? { ...h, mana: Math.max(0, h.mana - activeSkill.manaCost) } : h));

    try {
      await CombatNetwork.castSkill(activeSkill.id);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-grow flex flex-col p-4 md:p-6 overflow-hidden w-full max-h-[92vh] gap-4">
      {/* Visual Arena / Battleground Grid */}
      <CombatBattleground 
        bossState={bossState} 
        playersState={playersState} 
      />

      {/* Retro Command Menu & Status Board */}
      <CombatRetroMenu
        localPlayer={localPlayer}
        playersState={playersState}
        activeSkill={activeSkill}
        cooldownRemaining={cooldownRemaining}
        activeCombos={activeCombos}
        bossState={bossState}
        handleCastSkill={handleCastSkill}
      />

      {/* Victory/Defeat Overlay */}
      {isCompleted && (
        <CombatVictoryDefeatOverlay
          victory={victory}
          localPlayer={localPlayer}
          onReturnToLobby={onReturnToLobby}
        />
      )}
    </div>
  );
}

