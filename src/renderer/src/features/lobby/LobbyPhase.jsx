import React, { useState, useEffect, useRef } from 'react';

const CLASS_PRESETS = {
  Warrior: {
    hp: 140,
    atk: 18,
    def: 15,
    spd: 7,
    description: "Heavy frontline defender with high health and physical power.",
    icon: "⚔️",
    maxHp: 200,
    maxAtk: 30,
    maxDef: 30,
    maxSpd: 20,
    colorClass: "text-amber-400"
  },
  Mage: {
    hp: 85,
    atk: 25,
    def: 6,
    spd: 10,
    description: "Fragile spellcaster dealing devastating area magic damage.",
    icon: "🔥",
    maxHp: 200,
    maxAtk: 30,
    maxDef: 30,
    maxSpd: 20,
    colorClass: "text-cyan-400"
  },
  Rogue: {
    hp: 100,
    atk: 20,
    def: 8,
    spd: 15,
    description: "Swift assassin excelling in critical hits and evasion.",
    icon: "⚡",
    maxHp: 200,
    maxAtk: 30,
    maxDef: 30,
    maxSpd: 20,
    colorClass: "text-violet-400"
  },
  Cleric: {
    hp: 110,
    atk: 12,
    def: 10,
    spd: 9,
    description: "Holy supporter keeping the party alive with powerful heals.",
    icon: "🌟",
    maxHp: 200,
    maxAtk: 30,
    maxDef: 30,
    maxSpd: 20,
    colorClass: "text-emerald-400"
  }
};

export default function LobbyPhase() {
  const [screen, setScreen] = useState('welcome'); // 'welcome' | 'list' | 'create' | 'guild-lobby'
  const [characters, setCharacters] = useState([]);
  const [selectedClass, setSelectedClass] = useState('Warrior');
  const [charName, setCharName] = useState('');
  const [validationMsg, setValidationMsg] = useState('');
  const [removingIds, setRemovingIds] = useState(new Set());

  // Lobby States
  const [activeLobbyId, setActiveLobbyId] = useState(null);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [activeHero, setActiveHero] = useState(null);
  const [isNetworkMock, setIsNetworkMock] = useState(true);

  // Auto-Updater state
  const [updateInfo, setUpdateInfo] = useState(null);

  const guildHallRef = useRef(null);

  // Load characters from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('guild_characters');
    if (stored) {
      try {
        setCharacters(JSON.parse(stored));
      } catch (e) {
        console.error("Failed loading characters:", e);
      }
    }
  }, []);

  // Listen for P2P player state sync updates from Electron Main Process
  useEffect(() => {
    if (window.api && window.api.onPlayersUpdate) {
      const unsubscribe = window.api.onPlayersUpdate((updatedPlayers) => {
        setLobbyPlayers(updatedPlayers);
      });
      return unsubscribe;
    }
  }, []);

  // Listen for Auto-Updater status events
  useEffect(() => {
    if (window.api && window.api.onUpdateStatus) {
      const unsubscribe = window.api.onUpdateStatus((info) => {
        console.log("Updater status event received in React:", info);
        setUpdateInfo(info);
      });
      return unsubscribe;
    }
  }, []);

  // Set up periodic mock movement when simulated players join
  useEffect(() => {
    let interval;
    const hasMockFriends = lobbyPlayers.some(p => !p.isHost);
    if (hasMockFriends && window.api && window.api.simulateFriendMove) {
      interval = setInterval(() => {
        window.api.simulateFriendMove();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [lobbyPlayers]);

  const saveAndSetCharacters = (newChars) => {
    setCharacters(newChars);
    localStorage.setItem('guild_characters', JSON.stringify(newChars));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const name = charName.trim();
    if (name.length < 3) {
      setValidationMsg("Name must be at least 3 characters.");
      return;
    }
    const duplicate = characters.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setValidationMsg("A hero with this name already exists.");
      return;
    }

    const newChar = {
      id: 'char_' + Date.now(),
      name: name,
      class: selectedClass,
      level: 1,
      stats: { ...CLASS_PRESETS[selectedClass] }
    };

    const updated = [...characters, newChar];
    saveAndSetCharacters(updated);
    setCharName('');
    setValidationMsg('');
    setScreen('list');
  };

  const handleDelete = (id) => {
    setRemovingIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setTimeout(() => {
      const updated = characters.filter(c => c.id !== id);
      saveAndSetCharacters(updated);
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400);
  };

  // Create Steam/Mock Lobby
  const enterGuildLobby = async (char) => {
    if (!window.api) {
      // Direct Web Browser Fallback Mock
      const mockLobbyId = 'MOCK_BROWSER_' + Math.floor(Math.random() * 900000 + 100000);
      const hostData = {
        id: char.id,
        name: char.name,
        class: char.class,
        x: 150,
        y: 200,
        isHost: true
      };
      setActiveHero(hostData);
      setLobbyPlayers([hostData]);
      setActiveLobbyId(mockLobbyId);
      setIsNetworkMock(true);
      setScreen('guild-lobby');
      return;
    }

    try {
      const response = await window.api.createLobby({
        id: char.id,
        name: char.name,
        class: char.class
      });

      if (response.success) {
        const host = response.players.find(p => p.isHost);
        setActiveHero(host);
        setLobbyPlayers(response.players);
        setActiveLobbyId(response.lobbyId);
        setIsNetworkMock(response.isMock);
        setScreen('guild-lobby');
      }
    } catch (error) {
      console.error("IPC Create Lobby failed:", error);
    }
  };

  // Handle Guild Hall Canvas click to move local avatar
  const handleGuildHallClick = async (e) => {
    if (!activeHero || !guildHallRef.current) return;

    const rect = guildHallRef.current.getBoundingClientRect();
    const clickX = Math.round(e.clientX - rect.left);
    const clickY = Math.round(e.clientY - rect.top);

    // Enforce local coordinate bounds
    const boundedX = Math.max(20, Math.min(clickX, rect.width - 20));
    const boundedY = Math.max(20, Math.min(clickY, rect.height - 20));

    // Update locally immediately for instant feedback
    setLobbyPlayers(prev => prev.map(p => {
      if (p.id === activeHero.id) {
        return { ...p, x: boundedX, y: boundedY };
      }
      return p;
    }));

    if (window.api) {
      try {
        await window.api.sendPosition(activeHero.id, boundedX, boundedY);
      } catch (err) {
        console.error("IPC Send position failed:", err);
      }
    }
  };

  // Helper to trigger Simulated Friend Join
  const addSimulatedFriend = async () => {
    if (window.api) {
      try {
        const res = await window.api.simulateJoin();
        if (res.success) {
          setLobbyPlayers(res.players);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Browser Mock
      const names = ["Mika", "Soren", "Eldrin", "Valera"];
      const classes = ["Mage", "Rogue", "Cleric", "Warrior"];
      const randomName = names[Math.floor(Math.random() * names.length)] + ` #${lobbyPlayers.length}`;
      const randomClass = classes[Math.floor(Math.random() * classes.length)];
      const newFriend = {
        id: 'browser_mock_' + Date.now(),
        name: randomName,
        class: randomClass,
        x: Math.random() * 300 + 100,
        y: Math.random() * 200 + 100,
        isHost: false
      };
      setLobbyPlayers(prev => [...prev, newFriend]);
    }
  };

  const preset = CLASS_PRESETS[selectedClass];

  return (
    <div className="w-full h-full relative flex flex-col justify-between overflow-hidden">
      
      {/* Auto-Updater Status Banner */}
      {updateInfo && (updateInfo.status === 'available' || updateInfo.status === 'downloading' || updateInfo.status === 'downloaded') && (
        <div className="bg-gradient-to-r from-violet-900 to-indigo-950 border-b border-violet-500/30 px-6 py-2.5 text-center text-xs flex justify-between items-center z-50">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">🔄</span>
            {updateInfo.status === 'available' && <span>A new update (v{updateInfo.version}) is available. Starting download...</span>}
            {updateInfo.status === 'downloading' && <span>Downloading new update: {Math.round(updateInfo.percent)}%</span>}
            {updateInfo.status === 'downloaded' && <span>Update v{updateInfo.version} downloaded successfully!</span>}
          </div>
          {updateInfo.status === 'downloaded' && (
            <button 
              onClick={() => window.api?.installUpdate()}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1 rounded transition-colors duration-200 cursor-pointer"
            >
              Restart & Install
            </button>
          )}
        </div>
      )}
      
      {/* SECTION 1: WELCOME SCREEN */}
      {screen === 'welcome' && (
        <div className="flex-1 flex flex-col justify-center items-center p-6">
          <div className="bg-[rgba(18,14,32,0.65)] backdrop-blur-md border border-[rgba(255,255,255,0.07)] hover:border-[rgba(138,92,246,0.25)] rounded-2xl p-12 flex flex-col items-center max-w-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-300">
            <h1 className="font-['Cinzel'] text-5xl font-black tracking-widest text-center bg-gradient-to-br from-white to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(167,139,250,0.15)] leading-none">
              DUNGEON GUILD
            </h1>
            <h2 className="font-['Cinzel'] text-3xl font-bold tracking-[0.3em] text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.35)] text-center mt-2 mb-6 pl-[0.3em]">
              BATTLER
            </h2>
            <p className="text-slate-400 text-center leading-relaxed max-w-md mb-8 font-light">
              Assemble your party, conquer dangerous depths, draft mythical loot, and lead your guild to absolute glory.
            </p>
            <button 
              onClick={() => setScreen('list')}
              className="font-['Cinzel'] font-bold text-lg px-12 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg shadow-[0_4px_20px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer overflow-hidden relative group"
            >
              <span className="relative z-10">Enter Guild</span>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 2: CHARACTER LIST SCREEN */}
      {screen === 'list' && (
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
                  const presetData = CLASS_PRESETS[char.class] || CLASS_PRESETS.Warrior;
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

      {/* SECTION 3: CHARACTER CREATION SCREEN */}
      {screen === 'create' && (
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
                {Object.entries(CLASS_PRESETS).map(([className, details]) => (
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

      {/* SECTION 4: ACTIVE GUILD LOBBY SCREEN (Steam P2P / Mock) */}
      {screen === 'guild-lobby' && (
        <div className="flex-grow flex flex-col p-8 overflow-hidden">
          <header className="flex justify-between items-center mb-6 flex-shrink-0">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-['Cinzel'] text-3xl font-bold tracking-wide text-white drop-shadow">Guild Hall</h2>
                <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded ${isNetworkMock ? 'bg-amber-600 text-white' : 'bg-green-600 text-white'}`}>
                  {isNetworkMock ? 'Mock Network' : 'Steamworks P2P'}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">Lobby ID: <span className="text-cyan-400 select-text font-mono font-semibold">{activeLobbyId}</span></p>
            </div>
            <button 
              onClick={() => {
                setActiveLobbyId(null);
                setScreen('list');
              }}
              className="px-5 py-2 bg-red-950/20 border border-red-900/40 text-red-300 hover:text-white hover:bg-red-900/40 rounded transition-all duration-200 cursor-pointer"
            >
              Leave Party
            </button>
          </header>

          <div className="flex-grow grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 min-h-0">
            
            {/* The interactive Guild Hall canvas floor */}
            <div className="flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase">Click inside the hall to move your hero</span>
                {isNetworkMock && (
                  <button 
                    onClick={addSimulatedFriend}
                    className="px-3 py-1 bg-violet-900/40 hover:bg-violet-900/70 border border-violet-800/40 text-violet-300 hover:text-white rounded text-xs font-bold transition-all duration-200 cursor-pointer"
                  >
                    Simulate Friend Join
                  </button>
                )}
              </div>

              <div 
                ref={guildHallRef}
                onClick={handleGuildHallClick}
                className="flex-grow bg-slate-950/80 border border-violet-950/60 rounded-xl relative overflow-hidden bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:24px_24px] cursor-crosshair shadow-inner"
              >
                {/* Visual room markers / rugs */}
                <div className="absolute top-[30%] left-[45%] w-32 h-32 rounded-full border border-violet-500/5 bg-violet-500/[0.01] flex items-center justify-center pointer-events-none">
                  <span className="text-xs text-violet-500/20 font-['Cinzel'] tracking-wider">Muster Circle</span>
                </div>

                {/* Render players */}
                {lobbyPlayers.map(p => {
                  const presetData = CLASS_PRESETS[p.class] || CLASS_PRESETS.Warrior;
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
                      {/* Character Token */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl bg-slate-900 border-2 shadow-lg relative group ${p.isHost ? 'border-amber-400 shadow-amber-500/10' : 'border-violet-500'}`}>
                        {presetData.icon}
                        
                        {/* Host Crown Icon */}
                        {p.isHost && (
                          <span className="absolute -top-3.5 text-xs text-amber-400 drop-shadow">👑</span>
                        )}

                        {/* Name Tooltip */}
                        <div className="absolute bottom-11 scale-0 group-hover:scale-100 bg-slate-900 border border-slate-700/60 text-[10px] px-2 py-0.5 rounded text-white font-semibold whitespace-nowrap shadow-md transition-all duration-150 z-20 pointer-events-none">
                          {p.name}
                        </div>
                      </div>

                      {/* Name Label */}
                      <span className="text-[10px] text-slate-300 font-semibold bg-black/65 px-1.5 py-0.2 rounded mt-1 shadow-sm whitespace-nowrap">
                        {p.name.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Guild Members list sidebar */}
            <div className="bg-[rgba(18,14,32,0.65)] backdrop-blur-md border border-[rgba(255,255,255,0.07)] rounded-xl p-5 flex flex-col overflow-hidden">
              <h3 className="font-['Cinzel'] text-sm font-bold text-white mb-4 tracking-wider uppercase border-b border-white/5 pb-2 flex justify-between items-center">
                <span>Active Guild Roster</span>
                <span className="text-xs text-cyan-400 font-mono">({lobbyPlayers.length})</span>
              </h3>
              <div className="flex-grow overflow-y-auto flex flex-col gap-3">
                {lobbyPlayers.map(p => {
                  const presetData = CLASS_PRESETS[p.class] || CLASS_PRESETS.Warrior;
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
                      <span className="text-[10px] text-slate-500 font-mono">x: {p.x}, y: {p.y}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
