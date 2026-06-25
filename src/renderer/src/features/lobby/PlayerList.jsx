import React from 'react';

export default function PlayerList({ lobbyPlayers, presets }) {
  return (
    <div className="bg-[rgba(18,14,32,0.65)] backdrop-blur-md border border-[rgba(255,255,255,0.07)] rounded-xl p-5 flex flex-col overflow-hidden">
      <h3 className="font-['Cinzel'] text-sm font-bold text-white mb-4 tracking-wider uppercase border-b border-white/5 pb-2 flex justify-between items-center">
        <span>Active Guild Roster</span>
        <span className="text-xs text-cyan-400 font-mono">({lobbyPlayers.length})</span>
      </h3>
      <div className="flex-grow overflow-y-auto flex flex-col gap-3">
        {lobbyPlayers.map(p => {
          const presetData = presets[p.class] || presets.Warrior;
          return (
            <div key={p.id} className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{presetData.icon}</div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {p.name}
                    {p.isHost && <span className="text-[10px] text-amber-400">👑</span>}
                  </span>
                  <span className="text-[10px] text-slate-400">{p.class}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[9px] text-slate-500 font-mono">x: {p.x}, y: {p.y}</span>
                {p.ready ? (
                  <span className="text-[9px] px-1.5 py-0.5 font-extrabold uppercase rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">Ready</span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 font-extrabold uppercase rounded bg-slate-950 text-slate-500 border border-slate-900">Drafting</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
