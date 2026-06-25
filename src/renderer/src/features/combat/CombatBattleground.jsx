import React from 'react';

const CLASS_PRESETS = {
  Warrior: { icon: "⚔️", color: "text-amber-400" },
  Mage: { icon: "🔥", color: "text-cyan-400" },
  Rogue: { icon: "⚡", color: "text-violet-400" },
  Cleric: { icon: "🌟", color: "text-emerald-400" }
};

const STAGGER_STYLES = [
  { top: '12%', right: '28%' }, // Back-row top
  { top: '34%', right: '16%' }, // Mid-row
  { top: '56%', right: '24%' }, // Back-row bottom
  { top: '78%', right: '8%' }   // Front-row
];

export default function CombatBattleground({ bossState, playersState }) {
  return (
    <div className="relative w-full h-[320px] md:h-[400px] jrpg-battleground p-6 select-none flex-shrink-0">
      {/* Background Arena Label */}
      <div className="absolute top-4 left-4 text-shadow-retro font-retro text-[10px] tracking-widest text-slate-500 uppercase">
        Active Battle Zone
      </div>

      {/* Boss / Enemy Side (Left Side, Centered Vertically) */}
      <div className="absolute left-[8%] md:left-[12%] top-[50%] -translate-y-1/2 flex flex-col items-center">
        {/* Boss Floating Texts */}
        <div className="relative w-full flex justify-center">
          {bossState.floatTexts.map(f => (
            <span 
              key={f.id} 
              className={`absolute -top-10 font-retro text-shadow-retro text-xl md:text-2xl z-30 animate-float-fade ${
                f.type === 'crit' 
                  ? 'text-yellow-400 scale-125' 
                  : 'text-red-500'
              }`}
            >
              {f.text} {f.type === 'crit' && '💥'}
            </span>
          ))}
        </div>

        {/* Boss Avatar */}
        <div 
          className={`w-28 h-28 md:w-36 md:h-36 rounded-full border-4 flex items-center justify-center shadow-2xl relative transition-all duration-300 animate-breathe ${
            bossState.isDead 
              ? 'border-slate-800 bg-slate-950 grayscale opacity-40' 
              : bossState.flashDamage 
                ? 'border-red-500 bg-red-950/40 animate-shake scale-95' 
                : 'border-red-600 bg-slate-900/90 shadow-red-900/10'
          }`}
        >
          <span className="text-5xl md:text-7xl">
            {bossState.isDead ? "💀" : bossState.icon}
          </span>
        </div>

        {/* Boss Name Tag */}
        <h4 className={`font-retro text-shadow-retro text-xs md:text-sm mt-4 tracking-wider uppercase ${
          bossState.isDead ? 'text-slate-500' : 'text-red-500'
        }`}>
          {bossState.name}
        </h4>
        <div className="text-[8px] font-retro text-slate-400 mt-1 uppercase text-shadow-retro">
          {bossState.isDead ? 'Vanquished' : `HP ${Math.round(bossState.hp)} / ${bossState.maxHp}`}
        </div>
      </div>

      {/* Guild Heroes Side (Right Side, Diagonal Formation) */}
      <div className="absolute inset-y-0 right-0 left-1/2 pointer-events-none">
        {playersState.map((hero, idx) => {
          const preset = CLASS_PRESETS[hero.class] || CLASS_PRESETS.Warrior;
          const stagger = STAGGER_STYLES[idx] || STAGGER_STYLES[3];
          
          return (
            <div 
              key={hero.id} 
              className="absolute -translate-y-1/2 flex items-center gap-3 transition-all duration-500"
              style={{ top: stagger.top, right: stagger.right }}
            >
              {/* Hero Avatar Box */}
              <div className="relative">
                {/* Hero Floating Damage / Heals */}
                {hero.floatTexts.map(f => (
                  <span 
                    key={f.id} 
                    className={`absolute -top-10 left-1/2 -translate-x-1/2 font-retro text-shadow-retro text-base z-30 animate-float-fade ${
                      f.type === 'heal' ? 'text-emerald-400' : 'text-red-500'
                    }`}
                  >
                    {f.text}
                  </span>
                ))}

                <div 
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-lg border-3 flex items-center justify-center shadow-lg relative transition-all duration-300 animate-breathe ${
                    hero.isDead 
                      ? 'border-slate-800 bg-slate-950/80 grayscale opacity-40' 
                      : hero.flashDamage 
                        ? 'border-red-500 bg-red-950/40 animate-shake scale-95' 
                        : 'border-white bg-slate-900'
                  }`}
                  style={{ animationDelay: `${idx * 0.4}s` }}
                >
                  <span className="text-2xl md:text-3xl">
                    {hero.isDead ? "💀" : preset.icon}
                  </span>

                  {/* Character Name Tag above/beside avatar */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-retro text-[8px] text-shadow-retro text-white tracking-wide uppercase">
                    {hero.name}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
