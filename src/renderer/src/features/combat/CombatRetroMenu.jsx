import React from 'react';

export default function CombatRetroMenu({ 
  localPlayer, 
  playersState, 
  activeSkill, 
  cooldownRemaining, 
  activeCombos, 
  bossState, 
  handleCastSkill 
}) {
  const localHeroState = playersState.find(p => p.id === localPlayer?.id);
  const hasMana = localHeroState ? localHeroState.mana >= (activeSkill?.manaCost || 0) : false;
  const isComboPrimeActive = activeSkill?.executeTag && activeCombos[activeSkill.executeTag] && (activeCombos[activeSkill.executeTag].remaining > 0);
  const isSkillDisabled = cooldownRemaining > 0 || !hasMana || localHeroState?.isDead || bossState.isDead;

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 p-4 ff-window select-none min-h-[160px] flex-shrink-0">
      
      {/* LEFT COLUMN: Classic JRPG Command Box */}
      <div className="border-r border-white/20 pr-4 flex flex-col justify-between h-full">
        <div>
          <div className="font-retro text-[10px] text-yellow-400 mb-3 tracking-widest text-shadow-retro-small">
            COMMAND
          </div>
          
          <div className="space-y-2.5">
            {/* Auto-Attack Display */}
            <div className="flex items-center gap-2 text-slate-400 font-retro text-[9px] px-2 py-1 bg-black/35 rounded border border-transparent">
              <span>⚔️</span>
              <span className="uppercase">Auto-attacking...</span>
            </div>

            {/* Active Skill Command Option */}
            {activeSkill ? (
              <button
                onClick={handleCastSkill}
                disabled={isSkillDisabled}
                className={`w-full text-left font-retro text-[10px] px-3 py-2.5 rounded-lg border-2 flex flex-col justify-center relative overflow-hidden transition-all duration-150 cursor-pointer ${
                  isSkillDisabled
                    ? 'bg-black/50 border-slate-700/60 text-slate-500 opacity-60 cursor-not-allowed'
                    : isComboPrimeActive
                      ? 'bg-amber-950/40 text-amber-300 animate-combo-pulse border-amber-400'
                      : 'bg-blue-900/40 hover:bg-blue-800/80 text-white border-white/25 hover:border-white shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                }`}
              >
                {cooldownRemaining > 0 && (
                  <div 
                    className="absolute inset-0 bg-black/80 flex items-center justify-center text-[10px] font-retro text-yellow-400 font-bold z-10"
                    style={{ clipPath: `inset(${(1 - cooldownRemaining / activeSkill.cooldown) * 100}% 0px 0px 0px)` }}
                  >
                    CD {(cooldownRemaining / 1000).toFixed(1)}s
                  </div>
                )}
                
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    <span>{activeSkill.icon}</span>
                    <span className="font-bold tracking-wider uppercase text-[10px] text-shadow-retro-small">
                      {activeSkill.name}
                    </span>
                  </div>
                  <span className="text-[8px] text-cyan-300 font-bold text-shadow-retro-small">
                    {activeSkill.manaCost} MP
                  </span>
                </div>

                {isComboPrimeActive && (
                  <span className="text-[7px] text-amber-400 font-black tracking-widest mt-1 uppercase text-shadow-retro-small animate-pulse">
                    ✨ COMBO PRIMED ✨
                  </span>
                )}
              </button>
            ) : (
              <div className="text-[9px] font-retro text-slate-500 italic text-center p-2">
                No active skill
              </div>
            )}
          </div>
        </div>

        {/* Local Character Tag */}
        {localHeroState && (
          <div className="font-retro text-[8px] text-slate-400 mt-2 uppercase text-shadow-retro-small border-t border-white/10 pt-2 flex justify-between items-center">
            <span>Actor: {localHeroState.name}</span>
            <span className="text-yellow-500">{localHeroState.isDead ? 'KO' : 'ACTIVE'}</span>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Classic JRPG Status Box */}
      <div className="pl-0 md:pl-2 flex flex-col justify-center">
        {/* Table Headers */}
        <div className="grid grid-cols-[110px_1fr_1fr] md:grid-cols-[140px_1fr_1fr] gap-4 border-b border-white/20 pb-1.5 mb-2.5 text-slate-400 font-retro text-[9px] tracking-widest text-shadow-retro-small">
          <span>NAME</span>
          <span>HP</span>
          <span>MP</span>
        </div>

        {/* Party Status List */}
        <div className="space-y-3">
          {playersState.map(hero => {
            const hpPercent = Math.max(0, (hero.hp / hero.maxHp) * 100);
            const manaPercent = Math.max(0, (hero.mana / 100) * 100);
            const isLocal = hero.id === localPlayer?.id;
            
            return (
              <div 
                key={hero.id} 
                className={`grid grid-cols-[110px_1fr_1fr] md:grid-cols-[140px_1fr_1fr] gap-4 items-center ${
                  hero.isDead ? 'opacity-40 text-red-500' : 'text-white'
                }`}
              >
                {/* Character Name + Tag */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {isLocal && <span className="text-yellow-400 animate-pulse font-retro text-[9px]">▶</span>}
                  <span className={`font-retro text-[11px] truncate uppercase text-shadow-retro-small ${
                    isLocal ? 'text-yellow-400' : 'text-white'
                  }`}>
                    {hero.name}
                  </span>
                </div>

                {/* HP Status Column */}
                <div className="flex flex-col gap-1 pr-2">
                  <div className="flex justify-between font-retro text-[9px] text-shadow-retro-small text-slate-200">
                    <span>{hero.isDead ? 'KO' : `${Math.round(hero.hp)}/${hero.maxHp}`}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 border border-white/20 rounded-sm p-[1px] overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        hpPercent < 25 
                          ? 'bg-red-600' 
                          : hpPercent < 50 
                            ? 'bg-yellow-500' 
                            : 'bg-emerald-500'
                      }`} 
                      style={{ width: `${hpPercent}%` }} 
                    />
                  </div>
                </div>

                {/* MP Status Column */}
                <div className="flex flex-col gap-1 pr-2">
                  <div className="flex justify-between font-retro text-[9px] text-shadow-retro-small text-slate-200">
                    <span>{hero.isDead ? '0' : `${Math.round(hero.mana)}/100`}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 border border-white/20 rounded-sm p-[1px] overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 transition-all duration-300" 
                      style={{ width: `${manaPercent}%` }} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
