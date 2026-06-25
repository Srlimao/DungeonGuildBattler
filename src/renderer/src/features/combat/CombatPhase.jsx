import React, { useState, useEffect, useRef } from 'react';

const CLASS_PRESETS = {
  Warrior: { icon: "⚔️", color: "text-amber-400", bg: "bg-amber-950/20", border: "border-amber-500/20", hp: 140 },
  Mage: { icon: "🔥", color: "text-cyan-400", bg: "bg-cyan-950/20", border: "border-cyan-500/20", hp: 85 },
  Rogue: { icon: "⚡", color: "text-violet-400", bg: "bg-violet-950/20", border: "border-violet-500/20", hp: 100 },
  Cleric: { icon: "🌟", color: "text-emerald-400", bg: "bg-emerald-950/20", border: "border-emerald-500/20", hp: 110 }
};

export default function CombatPhase({ combatData, lobbyPlayers, localPlayer, onReturnToLobby }) {
  const { monster, combatLog, victory } = combatData;
  
  const [currentLogIdx, setCurrentLogIdx] = useState(0);
  const [logs, setLogs] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Set up local state for heroes
  const [heroes, setHeroes] = useState(() => {
    return lobbyPlayers.map(p => {
      const preset = CLASS_PRESETS[p.class] || CLASS_PRESETS.Warrior;
      return {
        id: p.id,
        name: p.name,
        class: p.class,
        hp: preset.hp,
        maxHp: preset.hp,
        isDead: false,
        floatTexts: [],
        flashDamage: false
      };
    });
  });

  // Set up local state for boss
  const [boss, setBoss] = useState({
    name: monster.name,
    hp: monster.maxHp,
    maxHp: monster.maxHp,
    icon: monster.icon,
    colorClass: monster.colorClass,
    isDead: false,
    floatTexts: [],
    flashDamage: false
  });

  const logContainerRef = useRef(null);

  // Scroll to bottom of log terminal
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Main combat playback interval
  useEffect(() => {
    if (currentLogIdx >= combatLog.length) {
      setIsCompleted(true);
      return;
    }

    const interval = setInterval(() => {
      const step = combatLog[currentLogIdx];
      
      if (step.type === 'round_start') {
        setLogs(prev => [...prev, { text: `--- ROUND ${step.value} ---`, isDivider: true }]);
      } else if (step.type === 'attack' || step.type === 'spell' || step.type === 'crit') {
        // Hero attack boss
        setBoss(prev => {
          const type = step.type === 'crit' ? 'crit' : 'dmg';
          return {
            ...prev,
            hp: step.bossHp,
            isDead: step.bossHp <= 0,
            flashDamage: true,
            floatTexts: [...prev.floatTexts, { id: Date.now(), text: `-${step.value}`, type }]
          };
        });
        
        // Trigger a flash timeout
        setTimeout(() => {
          setBoss(prev => ({ ...prev, flashDamage: false }));
        }, 300);

        setLogs(prev => [...prev, { text: step.text, class: 'text-slate-200' }]);
      } else if (step.type === 'boss_attack') {
        // Boss hits hero
        setHeroes(prev => prev.map(h => {
          if (h.name === step.target) {
            return {
              ...h,
              hp: step.targetHp,
              flashDamage: true,
              floatTexts: [...h.floatTexts, { id: Date.now(), text: `-${step.value}`, type: 'dmg' }]
            };
          }
          return h;
        }));

        setTimeout(() => {
          setHeroes(prev => prev.map(h => h.name === step.target ? { ...h, flashDamage: false } : h));
        }, 300);

        setLogs(prev => [...prev, { text: step.text, class: 'text-red-400 font-medium' }]);
      } else if (step.type === 'heal') {
        // Cleric heals hero
        setHeroes(prev => prev.map(h => {
          if (h.name === step.target) {
            return {
              ...h,
              hp: step.targetHp,
              floatTexts: [...h.floatTexts, { id: Date.now(), text: `+${step.value}`, type: 'heal' }]
            };
          }
          return h;
        }));

        setLogs(prev => [...prev, { text: step.text, class: 'text-emerald-400' }]);
      } else if (step.type === 'death') {
        setHeroes(prev => prev.map(h => h.name === step.target ? { ...h, isDead: true, hp: 0 } : h));
        setLogs(prev => [...prev, { text: step.text, class: 'text-red-600 font-bold' }]);
      } else if (step.type === 'victory') {
        setLogs(prev => [...prev, { text: step.text, class: 'text-yellow-400 font-black tracking-wider text-sm mt-2' }]);
        setIsCompleted(true);
      } else if (step.type === 'defeat') {
        setLogs(prev => [...prev, { text: step.text, class: 'text-red-500 font-black tracking-wider text-sm mt-2' }]);
        setIsCompleted(true);
      }

      setCurrentLogIdx(prev => prev + 1);
    }, 1200);

    return () => clearInterval(interval);
  }, [currentLogIdx, combatLog]);

  // Clean up floating text components after 1 second
  useEffect(() => {
    const handle = setInterval(() => {
      const now = Date.now();
      setHeroes(prev => prev.map(h => ({
        ...h,
        floatTexts: h.floatTexts.filter(f => now - f.id < 900)
      })));
      setBoss(prev => ({
        ...prev,
        floatTexts: prev.floatTexts.filter(f => now - f.id < 900)
      }));
    }, 200);

    return () => clearInterval(handle);
  }, []);

  const isLocalPlayerHost = localPlayer?.isHost;

  return (
    <div className="flex-grow flex flex-col p-8 overflow-hidden w-full max-h-[85vh]">
      <header className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h2 className="font-['Cinzel'] text-3xl font-bold tracking-wide text-white drop-shadow">Dungeon Combat</h2>
          <p className="text-slate-400 text-sm mt-1">Defeat the creature to claim the dungeon's treasures!</p>
        </div>
      </header>

      {/* Main Grid: Heroes vs Boss */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6 min-h-0 flex-grow-[2]">
        
        {/* Left Side: Party Members */}
        <div className="bg-slate-950/45 border border-violet-950/40 rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto">
          <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">Guild Party</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {heroes.map(hero => {
              const preset = CLASS_PRESETS[hero.class] || CLASS_PRESETS.Warrior;
              const hpPercent = (hero.hp / hero.maxHp) * 100;
              
              return (
                <div key={hero.id} className={`p-4 rounded-xl border relative transition-all duration-300 ${hero.isDead ? 'bg-red-950/10 border-red-950/40 opacity-40' : `${preset.bg} ${preset.border}`} ${hero.flashDamage ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] scale-[0.98]' : ''}`}>
                  
                  {/* Floating Damage/Healing Numbers */}
                  {hero.floatTexts.map(f => (
                    <span key={f.id} className={`absolute top-2 right-4 font-black text-xl animate-float-fade ${f.type === 'heal' ? 'text-emerald-400' : 'text-red-500'}`}>
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
                      <div className="mt-2.5">
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-950">
                          <div className={`h-full transition-all duration-500 ${hpPercent < 25 ? 'bg-red-500' : hpPercent < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${hpPercent}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                          <span>HP</span>
                          <span>{Math.round(hero.hp)} / {hero.maxHp}</span>
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
          {boss.floatTexts.map(f => (
            <span key={f.id} className={`absolute text-3xl font-black z-30 animate-float-fade ${f.type === 'crit' ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] scale-125' : 'text-red-500'}`}>
              {f.text} {f.type === 'crit' && '⚡'}
            </span>
          ))}

          <div className="flex flex-col items-center w-full max-w-sm text-center">
            {/* Boss Avatar */}
            <div className={`text-7xl w-28 h-28 rounded-full bg-slate-900 border-3 flex items-center justify-center shadow-2xl relative transition-all duration-300 ${boss.isDead ? 'border-red-950/40 grayscale opacity-45' : 'border-red-500/30'} ${boss.flashDamage ? 'border-red-500 bg-red-950/20 scale-[0.95]' : ''}`}>
              {boss.isDead ? "💀" : boss.icon}
            </div>

            <h4 className={`font-['Cinzel'] text-xl font-bold mt-4 tracking-wide ${boss.colorClass}`}>{boss.name}</h4>
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider mt-1">Dungeon Guardian</span>

            {/* Boss HP Bar */}
            <div className="w-full mt-6 px-4">
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-950">
                <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
                <span>HP Bar</span>
                <span>{Math.round(boss.hp)} / {boss.maxHp}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Half: Console Terminal Logs */}
      <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 flex flex-col min-h-[140px] max-h-[180px] flex-grow flex-shrink overflow-hidden font-mono shadow-inner">
        <div className="text-[10px] text-slate-500 border-b border-slate-900/60 pb-2 mb-2 flex items-center justify-between">
          <span>COMBAT LOG CONSOLE v1.0.0</span>
          <span className="animate-pulse flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> LIVE FEED</span>
        </div>
        
        <div ref={logContainerRef} className="flex-grow overflow-y-auto pr-2 text-xs leading-relaxed space-y-1">
          {logs.map((log, idx) => (
            <div key={idx} className={log.isDivider ? 'text-slate-500 font-bold border-y border-slate-900/40 py-1 text-center text-[10px]' : log.class || 'text-slate-300'}>
              {log.text}
            </div>
          ))}
        </div>
      </div>

      {/* Victory/Defeat Modal/Overlay */}
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
              {isLocalPlayerHost ? (
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
