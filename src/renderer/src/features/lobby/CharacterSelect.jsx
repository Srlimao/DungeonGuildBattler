import React from 'react';

export default function CharacterSelect({
  viewMode, // 'list' | 'create'
  characters,
  removingIds,
  handleDelete,
  enterGuildLobby,
  setScreen,
  presets,
  selectedClass,
  setSelectedClass,
  charName,
  setCharName,
  validationMsg,
  setValidationMsg,
  handleCreate
}) {
  const preset = presets[selectedClass];

  return (
    <>
      {viewMode === 'list' && (
        <div className="flex-1 flex flex-col p-10">
          <header className="flex justify-between items-center mb-10 flex-shrink-0">
            <div>
              <h2 className="font-['Cinzel'] text-3xl font-bold tracking-wide text-white drop-shadow">Guild Roster</h2>
              <p className="text-slate-400 text-sm mt-1">Select a hero to Host or enter the active Guild Lobby</p>
            </div>
            <button 
              onClick={() => {
                setCharName('');
                setValidationMsg('');
                setSelectedClass('Warrior');
                setScreen('create');
              }}
              className="px-6 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] hover:border-violet-500 hover:bg-violet-900/10 text-slate-200 hover:text-white rounded-lg hover:shadow-[0_0_15px_rgba(139,92,246,0.25)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              + Recruit Hero
            </button>
          </header>

          <div className="flex-grow overflow-y-auto pr-2">
            {characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center max-w-md mx-auto bg-[rgba(18,14,32,0.65)] backdrop-blur-md border border-[rgba(255,255,255,0.07)] rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
                <div className="text-6xl mb-6 opacity-85 animate-pulse">🛡️</div>
                <h3 className="font-['Cinzel'] text-2xl font-bold text-white mb-3">No Heroes Recruited</h3>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">Your guild hall is currently empty. Recruit your first hero to start your adventure!</p>
                <button 
                  onClick={() => {
                    setCharName('');
                    setValidationMsg('');
                    setSelectedClass('Warrior');
                    setScreen('create');
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-lg shadow-md cursor-pointer"
                >
                  Recruit Hero
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {characters.map(char => {
                  const presetData = presets[char.class] || presets.Warrior;
                  const isRemoving = removingIds.has(char.id);

                  return (
                    <div 
                      key={char.id}
                      className={`bg-[rgba(18,14,32,0.65)] backdrop-blur-md border border-[rgba(255,255,255,0.07)] hover:border-[rgba(138,92,246,0.25)] rounded-2xl p-6 flex flex-col h-[320px] justify-between shadow-lg transition-all duration-300 ${
                        isRemoving ? 'opacity-0 scale-75 translate-y-5 duration-400 pointer-events-none' : ''
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col">
                            <span className="font-['Cinzel'] text-xl font-bold text-white truncate max-w-[160px]" title={char.name}>
                              {char.name}
                            </span>
                            <span className={`text-xs font-semibold uppercase tracking-wider mt-1 ${presetData.colorClass}`}>
                              {presetData.icon} {char.class}
                            </span>
                          </div>
                          <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-xs font-bold">
                            LVL {char.level}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5 mt-2">
                          {['hp', 'atk', 'def', 'spd'].map(stat => (
                            <div key={stat} className="flex justify-between text-xs text-slate-400">
                              <span className="uppercase">{stat}</span>
                              <span className="font-semibold text-slate-200">{char.stats[stat]}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                        <button 
                          onClick={() => handleDelete(char.id)}
                          className="text-slate-500 hover:text-red-400 flex items-center gap-1 text-xs cursor-pointer transition-colors duration-200"
                        >
                          🗑️ Dismiss
                        </button>
                        <button 
                          onClick={() => enterGuildLobby(char)}
                          className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded shadow transition-all duration-200"
                        >
                          🏰 Enter Lobby
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'create' && (
        <div className="flex-grow flex flex-col p-10 overflow-hidden">
          <header className="flex justify-between items-center mb-10 flex-shrink-0">
            <div>
              <h2 className="font-['Cinzel'] text-3xl font-bold tracking-wide text-white drop-shadow">Recruit New Hero</h2>
              <p className="text-slate-400 text-sm mt-1">Select a class and forge their identity</p>
            </div>
            <button 
              onClick={() => setScreen('list')}
              className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-transform duration-200 hover:-translate-x-1"
            >
              ← Back to Roster
            </button>
          </header>

          <div className="flex-grow grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 min-h-0 overflow-y-auto pr-2">
            
            {/* Class Cards List */}
            <div className="flex flex-col">
              <h3 className="font-['Cinzel'] text-lg font-bold text-white mb-5 tracking-wider">Choose Character Class</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(presets).map(([className, details]) => (
                  <div 
                    key={className}
                    onClick={() => {
                      setSelectedClass(className);
                      setValidationMsg('');
                    }}
                    className={`bg-white/[0.02] border hover:bg-white/[0.05] rounded-xl p-5 flex gap-4 cursor-pointer transition-all duration-300 ${
                      selectedClass === className 
                        ? 'border-violet-500 bg-violet-600/[0.08] shadow-[0_0_20px_rgba(139,92,246,0.15)]' 
                        : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="text-4xl flex items-center justify-center">{details.icon}</div>
                    <div className="flex flex-col">
                      <h4 className="font-['Cinzel'] text-lg font-bold text-white mb-1">{className}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{details.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Creation Form & Stats Preview */}
            <div className="bg-[rgba(18,14,32,0.65)] backdrop-blur-md border border-[rgba(255,255,255,0.07)] hover:border-[rgba(138,92,246,0.25)] rounded-2xl p-8 flex flex-col shadow-lg">
              <form onSubmit={handleCreate} className="flex flex-col h-full justify-between gap-6">
                
                <div className="flex flex-col gap-2">
                  <label htmlFor="char-name" className="text-xs font-bold uppercase tracking-wider text-slate-400">Hero Name</label>
                  <input 
                    type="text" 
                    id="char-name"
                    value={charName}
                    onChange={(e) => {
                      setCharName(e.target.value);
                      if (e.target.value.trim().length >= 3) {
                        setValidationMsg('');
                      }
                    }}
                    placeholder="Enter hero name..."
                    required
                    maxLength={16}
                    autoComplete="off"
                    className="bg-black/35 border border-white/5 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(6,182,212,0.2)] rounded-lg px-4 py-3 text-white text-base outline-none transition-all duration-300"
                  />
                  <span className="text-xs text-red-400 h-4 mt-1">{validationMsg}</span>
                </div>

                <div className="flex-grow mt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 pb-2 border-b border-white/5">
                    Starting Attributes
                  </h3>
                  <div className="flex flex-col gap-4">
                    {['hp', 'atk', 'def', 'spd'].map(stat => {
                      const val = preset[stat];
                      const max = preset[`max${stat.charAt(0).toUpperCase() + stat.slice(1)}`] || 100;
                      const percentage = Math.min((val / max) * 100, 100);

                      return (
                        <div key={stat} className="grid grid-cols-[100px_1fr_40px] items-center gap-4">
                          <span className="text-sm text-slate-300 capitalize">{stat === 'hp' ? 'Health' : stat === 'atk' ? 'Attack Power' : stat === 'def' ? 'Defense' : 'Speed'}</span>
                          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500 ease-out" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-white text-right">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full font-semibold py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer text-center"
                >
                  Sign Contract & Recruit
                </button>

              </form>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
