import React from 'react';

export default function CombatVictoryDefeatOverlay({ 
  victory, 
  localPlayer, 
  onReturnToLobby 
}) {
  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col justify-center items-center z-40 animate-fade-in p-4">
      <div className="ff-window max-w-md w-full p-8 text-center flex flex-col items-center gap-4 shadow-2xl animate-scale-in">
        
        {/* Retro Header Icon */}
        <span className="text-6xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          {victory ? "🏆" : "💀"}
        </span>

        {/* JRPG Title */}
        <h3 className={`font-retro text-xl md:text-2xl font-black tracking-widest mt-2 text-shadow-retro uppercase ${
          victory 
            ? 'text-yellow-400' 
            : 'text-red-500'
        }`}>
          {victory ? "VICTORY!" : "DEFEAT"}
        </h3>
        
        {/* Retro Subtext */}
        <p className="font-sans text-slate-200 mt-2 text-sm max-w-xs leading-relaxed">
          {victory 
            ? "The dungeon threat has been vanquished! Glorious treasure awaits the guild."
            : "Your party has been wiped out in combat. Regroup and prepare to return!"}
        </p>

        {/* Action Button */}
        <div className="mt-6 w-full flex justify-center">
          {localPlayer?.isHost ? (
            <button 
              onClick={onReturnToLobby} 
              className="font-retro text-xs px-6 py-3.5 border-2 border-white hover:bg-white hover:text-blue-950 text-white rounded-md bg-blue-900/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all duration-200 cursor-pointer uppercase tracking-wider"
            >
              Return to Hall
            </button>
          ) : (
            <div className="font-retro text-[9px] text-slate-400 animate-pulse tracking-wide uppercase pt-2">
              Waiting for Host to return party...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
