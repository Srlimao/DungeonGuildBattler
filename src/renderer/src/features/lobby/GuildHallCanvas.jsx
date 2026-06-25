import React, { useRef } from 'react';

export default function GuildHallCanvas({ lobbyPlayers, presets, activeHero, onMove }) {
  const guildHallRef = useRef(null);

  const handleCanvasClick = (e) => {
    if (!activeHero || !guildHallRef.current) return;
    const rect = guildHallRef.current.getBoundingClientRect();
    const clickX = Math.max(20, Math.min(Math.round(e.clientX - rect.left), rect.width - 20));
    const clickY = Math.max(20, Math.min(Math.round(e.clientY - rect.top), rect.height - 20));
    onMove(clickX, clickY);
  };

  return (
    <div 
      ref={guildHallRef} 
      onClick={handleCanvasClick} 
      className="flex-grow bg-slate-950/80 border border-violet-950/60 rounded-xl relative overflow-hidden bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:24px_24px] cursor-crosshair shadow-inner"
    >
      <div className="absolute top-[30%] left-[45%] w-32 h-32 rounded-full border border-violet-500/5 bg-violet-500/[0.01] flex items-center justify-center pointer-events-none">
        <span className="text-xs text-violet-500/20 font-['Cinzel'] tracking-wider">Muster Circle</span>
      </div>

      {lobbyPlayers.map(p => {
        const presetData = presets[p.class] || presets.Warrior;
        return (
          <div 
            key={p.id} 
            className="absolute w-12 h-12 -ml-6 -mt-6 flex flex-col items-center select-none" 
            style={{ 
              left: `${p.x}px`, 
              top: `${p.y}px`, 
              transition: 'left 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' 
            }}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl bg-slate-900 border-2 shadow-lg relative group ${p.isHost ? 'border-amber-400 shadow-amber-500/10' : 'border-violet-500'}`}>
              {presetData.icon}
              {p.isHost && <span className="absolute -top-3.5 text-xs text-amber-400 drop-shadow">👑</span>}
              {p.ready && (
                <span className="absolute -bottom-1 -right-1 text-[9px] bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center border border-slate-900 font-black shadow shadow-emerald-500/30">✓</span>
              )}
              <div className="absolute bottom-11 scale-0 group-hover:scale-100 bg-slate-900 border border-slate-700/60 text-[10px] px-2 py-0.5 rounded text-white font-semibold whitespace-nowrap shadow-md transition-all duration-150 z-20 pointer-events-none">
                {p.name}
              </div>
            </div>
            <span className="text-[10px] text-slate-300 font-semibold bg-black/65 px-1.5 py-0.2 rounded mt-1 shadow-sm whitespace-nowrap">
              {p.name.split(' ')[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
