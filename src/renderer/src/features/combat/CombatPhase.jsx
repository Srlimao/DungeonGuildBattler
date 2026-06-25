import React, { useState, useEffect, useRef } from 'react';
import SKILL_DATA from '../../../../shared/skill_data.json';
import { AppNetwork } from '../../services/AppNetwork';

const CLASS_PRESETS = {
  Warrior: { icon: "⚔️", color: "text-amber-400", bg: "bg-amber-950/20", border: "border-amber-500/20" },
  Mage: { icon: "🔥", color: "text-cyan-400", bg: "bg-cyan-950/20", border: "border-cyan-500/20" },
  Rogue: { icon: "⚡", color: "text-violet-400", bg: "bg-violet-950/20", border: "border-violet-500/20" },
  Cleric: { icon: "🌟", color: "text-emerald-400", bg: "bg-emerald-950/20", border: "border-emerald-500/20" }
};

export default function CombatPhase({ combatData, lobbyPlayers, localPlayer, onReturnToLobby }) {
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
  const [logs, setLogs] = useState([{ text: "⚔️ Combat Commenced! Prepare your skills.", class: "text-yellow-500 font-bold" }]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [victory, setVictory] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const logContainerRef = useRef(null);

  // Retrieve active skill for local player
  const classSkills = SKILL_DATA[localPlayer?.class] || [];
  const activeSkill = classSkills.find(s => !s.isAutoAttack);

  // Scroll log feed
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

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
    const unsubEvent = AppNetwork.onCombatEvent((event) => {
      // 1. Add log feed entry
      setLogs(prev => [...prev, { text: event.text, class: getLogStyle(event.type) }]);

      // 2. Trigger floating texts & card flashes
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

    const unsubState = AppNetwork.onCombatStateUpdate((data) => {
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

    const unsubResolve = AppNetwork.onCombatResolve((data) => {
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

    // Optimistic UI updates
    setCooldownRemaining(activeSkill.cooldown);
    setPlayersState(prev => prev.map(h => h.id === localPlayer?.id ? { ...h, mana: Math.max(0, h.mana - activeSkill.manaCost) } : h));

    try {
      await AppNetwork.castSkill(activeSkill.id);
    } catch (e) {
      console.error(e);
    }
  };

  const getLogStyle = (type) => {
    if (type === 'boss_attack') return 'text-red-400 font-medium';
    if (type === 'heal') return 'text-emerald-400';
    if (type === 'death') return 'text-red-600 font-bold';
    if (type === 'crit') return 'text-yellow-400 font-extrabold';
    return 'text-slate-300';
  };

  // Determine if combo is active and matching the player's active skill
  const isComboPrimeActive = activeSkill?.executeTag && activeCombos[activeSkill.executeTag] && (activeCombos[activeSkill.executeTag].remaining > 0);
  const localHeroState = playersState.find(p => p.id === localPlayer?.id);
  const hasMana = localHeroState ? localHeroState.mana >= (activeSkill?.manaCost || 0) : false;
  const isSkillDisabled = cooldownRemaining > 0 || !hasMana || localHeroState?.isDead || bossState.isDead;

  return (
    <div className="flex-grow flex flex-col p-8 overflow-hidden w-full max-h-[85vh]">
      <header className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h2 className="font-['Cinzel'] text-3xl font-bold tracking-wide text-white drop-shadow">Dungeon Combat</h2>
          <p className="text-slate-400 text-sm mt-1">Coordinate skills to trigger powerful combos!</p>
        </div>
      </header>

      {/* Main Grid: Heroes vs Boss */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 mb-6 min-h-0 flex-grow-[2]">
        
        {/* Left Side: Party Members */}
        <div className="bg-slate-950/45 border border-violet-950/40 rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto">
          <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">Guild Party</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playersState.map(hero => {
              const preset = CLASS_PRESETS[hero.class] || CLASS_PRESETS.Warrior;
              const hpPercent = (hero.hp / hero.maxHp) * 100;
              const manaPercent = (hero.mana / 100) * 100;
              
              return (
                <div key={hero.id} className={`p-4 rounded-xl border relative transition-all duration-300 ${hero.isDead ? 'bg-red-950/10 border-red-950/40 opacity-40' : `${preset.bg} ${preset.border}`} ${hero.flashDamage ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] scale-[0.98]' : ''}`}>
                  
                  {/* Floating Damage/Healing Numbers */}
                  {hero.floatTexts.map(f => (
                    <span key={f.id} className={`absolute top-2 right-4 font-black text-xl z-20 animate-float-fade ${f.type === 'heal' ? 'text-emerald-400' : 'text-red-500'}`}>
                      {f.text}
                    </span>
                  ))}

                  <div className="flex items-center gap-3">
                    <div className="text-2xl w-10 h-10 rounded-lg bg-slate-900 border border-slate-700/40 flex items-center justify-center">
                      {hero.isDead ? "💀" : preset.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <h4 className="font-bold text-slate-100 truncate text-sm">{hero.name}</h4>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">{hero.class}</span>
                      </div>
                      
                      {/* HP Bar */}
                      <div className="mt-2">
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-950">
                          <div className={`h-full transition-all duration-500 ${hpPercent < 25 ? 'bg-red-500' : hpPercent < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${hpPercent}%` }} />
                        </div>
                      </div>

                      {/* Mana Bar */}
                      <div className="mt-1.5">
                        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden border border-slate-950">
                          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${manaPercent}%` }} />
                        </div>
                        <div className="flex justify-between text-[8px] text-slate-400 mt-0.5 font-mono">
                          <span>HP {Math.round(hero.hp)}/{hero.maxHp}</span>
                          <span>MP {Math.round(hero.mana)}/100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Boss Monster */}
        <div className="bg-slate-950/45 border border-violet-950/40 rounded-2xl p-6 flex flex-col justify-center items-center relative overflow-hidden">
          <h3 className="absolute top-6 left-6 text-xs font-bold text-red-500 uppercase tracking-widest">Dungeon Threat</h3>
          
          {/* Floating Boss Damage/Healing Numbers */}
          {bossState.floatTexts.map(f => (
            <span key={f.id} className={`absolute text-3xl font-black z-30 animate-float-fade ${f.type === 'crit' ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] scale-125' : 'text-red-500'}`}>
              {f.text} {f.type === 'crit' && '⚡'}
            </span>
          ))}

          <div className="flex flex-col items-center w-full max-w-sm text-center">
            {/* Boss Avatar */}
            <div className={`text-7xl w-28 h-28 rounded-full bg-slate-900 border-3 flex items-center justify-center shadow-2xl relative transition-all duration-300 ${bossState.isDead ? 'border-red-950/40 grayscale opacity-45' : 'border-red-500/30'} ${bossState.flashDamage ? 'border-red-500 bg-red-950/20 scale-[0.95]' : ''}`}>
              {bossState.isDead ? "💀" : bossState.icon}
            </div>

            <h4 className={`font-['Cinzel'] text-xl font-bold mt-4 tracking-wide ${bossState.colorClass}`}>{bossState.name}</h4>
            
            {/* Boss HP Bar */}
            <div className="w-full mt-4 px-4">
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-950">
                <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${(bossState.hp / bossState.maxHp) * 100}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>HP {Math.round(bossState.hp)}/{bossState.maxHp}</span>
              </div>
            </div>

            {/* Boss Active Primed Combos Status Bar */}
            <div className="mt-4 flex flex-wrap gap-2 justify-center min-h-[25px]">
              {Object.keys(activeCombos).map(tag => {
                const combo = activeCombos[tag];
                if (combo.remaining <= 0) return null;
                return (
                  <span key={tag} className="text-[10px] px-2 py-0.5 font-bold uppercase rounded bg-amber-950/40 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 animate-pulse shadow-sm">
                    ✨ {tag} Primed ({(combo.remaining / 1000).toFixed(1)}s)
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Interface: Clickable Skills & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 min-h-0 flex-grow flex-shrink overflow-hidden">
        
        {/* Terminal log console */}
        <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 flex flex-col overflow-hidden font-mono shadow-inner">
          <div className="text-[9px] text-slate-500 border-b border-slate-900/60 pb-1.5 mb-1.5 flex items-center justify-between">
            <span>COMBAT LOG CONSOLE</span>
            <span className="animate-pulse flex items-center gap-1.5 font-sans"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> LIVE</span>
          </div>
          <div ref={logContainerRef} className="flex-grow overflow-y-auto pr-2 text-xs leading-relaxed space-y-1 max-h-[120px]">
            {logs.map((log, idx) => (
              <div key={idx} className={log.isDivider ? 'text-slate-500 font-bold border-y border-slate-900/40 py-0.5 text-center text-[9px]' : log.class || 'text-slate-300'}>
                {log.text}
              </div>
            ))}
          </div>
        </div>

        {/* Hotbar Skill Button */}
        <div className="flex flex-col justify-center items-center p-3 bg-slate-950/30 border border-violet-950/20 rounded-xl">
          <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2">Active Combat Skill</span>
          
          {activeSkill ? (
            <button
              onClick={handleCastSkill}
              disabled={isSkillDisabled}
              className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center relative select-none border-2 transition-all duration-200 cursor-pointer ${isSkillDisabled ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed' : 'bg-slate-900/80 hover:bg-slate-950 border-violet-500/40 text-slate-200'} ${isComboPrimeActive ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse' : ''}`}
            >
              {/* Cooldown Overlay */}
              {cooldownRemaining > 0 && (
                <div 
                  className="absolute inset-0 bg-black/75 rounded-lg flex items-center justify-center text-xs font-mono font-bold text-white z-10"
                  style={{ clipPath: `inset(${(1 - cooldownRemaining / activeSkill.cooldown) * 100}% 0px 0px 0px)` }}
                >
                  {(cooldownRemaining / 1000).toFixed(1)}s
                </div>
              )}

              <span className="text-3xl mb-1">{activeSkill.icon}</span>
              <span className="text-[9px] font-bold tracking-wide truncate max-w-[70px] uppercase">{activeSkill.name}</span>
              <span className="text-[8px] text-red-400 font-semibold absolute bottom-1 left-2">Dmg {activeSkill.baseDmg}</span>
              <span className="text-[8px] text-cyan-400 font-semibold absolute bottom-1 right-2">Cost {activeSkill.manaCost}</span>
            </button>
          ) : (
            <div className="text-xs text-slate-500 font-semibold">No skills loaded</div>
          )}
        </div>
      </div>

      {/* Victory/Defeat Overlay */}
      {isCompleted && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-center items-center z-40 animate-fade-in">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl animate-scale-in">
            <span className="text-6xl">{victory ? "🏆" : "💀"}</span>
            <h3 className={`font-['Cinzel'] text-4xl font-black tracking-widest mt-4 ${victory ? 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'text-red-500'}`}>
              {victory ? "VICTORY" : "DEFEAT"}
            </h3>
            <p className="text-slate-400 mt-2 text-sm max-w-xs mx-auto leading-relaxed">
              {victory 
                ? "The Guardian has been slain! The paths ahead glow with magical energy."
                : "Your characters fell in combat. Retreat and regroup to strike again!"}
            </p>
            
            <div className="mt-8">
              {localPlayer?.isHost ? (
                <button onClick={onReturnToLobby} className="font-['Cinzel'] font-bold text-sm px-8 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg transition-all duration-300 cursor-pointer shadow-lg shadow-violet-900/20">
                  Return to Guild Hall
                </button>
              ) : (
                <p className="text-xs text-slate-500 animate-pulse font-semibold">Waiting for Host to return party to lobby...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
