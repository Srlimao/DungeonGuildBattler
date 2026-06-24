import React, { useState, useEffect, useRef } from 'react';
import CharacterSelect from './CharacterSelect';
import LobbyPortal from './LobbyPortal';
import PlayerList from './PlayerList';

const CLASS_PRESETS = {
  Warrior: { hp: 140, atk: 18, def: 15, spd: 7, description: "Heavy frontline defender with high health and physical power.", icon: "⚔️", maxHp: 200, maxAtk: 30, maxDef: 30, maxSpd: 20, colorClass: "text-amber-400" },
  Mage: { hp: 85, atk: 25, def: 6, spd: 10, description: "Fragile spellcaster dealing devastating area magic damage.", icon: "🔥", maxHp: 200, maxAtk: 30, maxDef: 30, maxSpd: 20, colorClass: "text-cyan-400" },
  Rogue: { hp: 100, atk: 20, def: 8, spd: 15, description: "Swift assassin excelling in critical hits and evasion.", icon: "⚡", maxHp: 200, maxAtk: 30, maxDef: 30, maxSpd: 20, colorClass: "text-violet-400" },
  Cleric: { hp: 110, atk: 12, def: 10, spd: 9, description: "Holy supporter keeping the party alive with powerful heals.", icon: "🌟", maxHp: 200, maxAtk: 30, maxDef: 30, maxSpd: 20, colorClass: "text-emerald-400" }
};

export default function LobbyPhase() {
  const [screen, setScreen] = useState('welcome'); // 'welcome' | 'list' | 'create' | 'lobby-portal' | 'guild-lobby'
  const [characters, setCharacters] = useState([]);
  const [selectedClass, setSelectedClass] = useState('Warrior');
  const [charName, setCharName] = useState('');
  const [validationMsg, setValidationMsg] = useState('');
  const [removingIds, setRemovingIds] = useState(new Set());

  // Lobby Portal Browse & Guest states
  const [availableLobbies, setAvailableLobbies] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  // Active Lobby players & host states
  const [activeLobbyId, setActiveLobbyId] = useState(null);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [activeHero, setActiveHero] = useState(null);
  const [isNetworkMock, setIsNetworkMock] = useState(true);

  // Auto-Updater status state
  const [updateInfo, setUpdateInfo] = useState(null);

  const guildHallRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('guild_characters');
    if (stored) {
      try { setCharacters(JSON.parse(stored)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (window.api?.onPlayersUpdate) {
      return window.api.onPlayersUpdate((updatedPlayers) => setLobbyPlayers(updatedPlayers));
    }
  }, []);

  useEffect(() => {
    if (window.api?.onUpdateStatus) {
      return window.api.onUpdateStatus((info) => setUpdateInfo(info));
    }
  }, []);

  useEffect(() => {
    let interval;
    const hasMockFriends = lobbyPlayers.some(p => p.id && p.id.includes('mock'));
    if (hasMockFriends && window.api?.simulateFriendMove) {
      interval = setInterval(() => window.api.simulateFriendMove(), 3000);
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
    if (name.length < 3) return setValidationMsg("Name must be at least 3 characters.");
    if (characters.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      return setValidationMsg("A hero with this name already exists.");
    }
    const newChar = { id: 'char_' + Date.now(), name, class: selectedClass, level: 1, stats: { ...CLASS_PRESETS[selectedClass] } };
    saveAndSetCharacters([...characters, newChar]);
    setCharName('');
    setValidationMsg('');
    setScreen('list');
  };

  const handleDelete = (id) => {
    setRemovingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      saveAndSetCharacters(characters.filter(c => c.id !== id));
      setRemovingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, 400);
  };

  const enterGuildLobby = async (char) => {
    setSelectedCharacter(char);
    setScreen('lobby-portal');
    await fetchLobbies();
  };

  const fetchLobbies = async () => {
    if (!window.api) {
      setAvailableLobbies([
        { id: "MOCK_LOBBY_1", name: "Valiant Shields Guild", hostName: "Soren", memberCount: 3, maxPlayers: 10 },
        { id: "MOCK_LOBBY_2", name: "Arcane Spells Sanctum", hostName: "Eldrin", memberCount: 5, maxPlayers: 10 },
        { id: "MOCK_LOBBY_3", name: "Dagger in the Dark", hostName: "Valera", memberCount: 2, maxPlayers: 10 }
      ]);
      return;
    }
    try {
      const list = await window.api.listLobbies();
      setAvailableLobbies(list || []);
    } catch (e) { console.error(e); }
  };

  const handleHostLobby = async () => {
    if (!selectedCharacter) return;
    if (!window.api) {
      const mockLobbyId = 'MOCK_BROWSER_' + Math.floor(Math.random() * 900000 + 100000);
      const hostData = { id: selectedCharacter.id, name: selectedCharacter.name, class: selectedCharacter.class, x: 150, y: 200, isHost: true };
      setActiveHero(hostData);
      setLobbyPlayers([hostData]);
      setActiveLobbyId(mockLobbyId);
      setScreen('guild-lobby');
      return;
    }
    try {
      const res = await window.api.createLobby({ id: selectedCharacter.id, name: selectedCharacter.name, class: selectedCharacter.class });
      if (res.success) {
        setActiveHero(res.players.find(p => p.isHost));
        setLobbyPlayers(res.players);
        setActiveLobbyId(res.lobbyId);
        setIsNetworkMock(res.isMock);
        setScreen('guild-lobby');
      }
    } catch (e) { console.error(e); }
  };

  const handleJoinLobby = async (lobbyIdToJoin) => {
    if (!selectedCharacter) return;
    if (!window.api) {
      const joinData = { id: selectedCharacter.id, name: selectedCharacter.name, class: selectedCharacter.class, x: 350, y: 280, isHost: false };
      const startPlayers = lobbyIdToJoin === 'MOCK_LOBBY_1' ? [
        { id: "mock_host_1", name: "Soren (Host)", class: "Warrior", x: 150, y: 200, isHost: true },
        { id: "mock_guest_1a", name: "Kaelen", class: "Mage", x: 280, y: 260, isHost: false }
      ] : [{ id: "mock_host_gen", name: "Eldrin (Host)", class: "Mage", x: 150, y: 200, isHost: true }];
      setActiveHero(joinData);
      setLobbyPlayers([...startPlayers, joinData]);
      setActiveLobbyId(lobbyIdToJoin);
      setScreen('guild-lobby');
      return;
    }
    try {
      const res = await window.api.joinLobby(lobbyIdToJoin, { id: selectedCharacter.id, name: selectedCharacter.name, class: selectedCharacter.class });
      if (res.success) {
        setActiveHero(res.players.find(p => p.id === selectedCharacter.id));
        setLobbyPlayers(res.players);
        setActiveLobbyId(res.lobbyId);
        setIsNetworkMock(res.isMock);
        setScreen('guild-lobby');
      } else { alert("Failed: " + res.error); }
    } catch (e) { console.error(e); }
  };

  const handleGuildHallClick = async (e) => {
    if (!activeHero || !guildHallRef.current) return;
    const rect = guildHallRef.current.getBoundingClientRect();
    const clickX = Math.max(20, Math.min(Math.round(e.clientX - rect.left), rect.width - 20));
    const clickY = Math.max(20, Math.min(Math.round(e.clientY - rect.top), rect.height - 20));
    setLobbyPlayers(prev => prev.map(p => p.id === activeHero.id ? { ...p, x: clickX, y: clickY } : p));
    if (window.api) {
      try { await window.api.sendPosition(activeHero.id, clickX, clickY); } catch (err) { console.error(err); }
    }
  };

  const addSimulatedFriend = async () => {
    if (window.api) {
      try {
        const res = await window.api.simulateJoin();
        if (res.success) setLobbyPlayers(res.players);
      } catch (e) { console.error(e); }
    } else {
      const names = ["Mika", "Soren", "Eldrin", "Valera"];
      const classes = ["Mage", "Rogue", "Cleric", "Warrior"];
      const newFriend = { id: 'browser_mock_' + Date.now(), name: names[Math.floor(Math.random() * names.length)] + ` #${lobbyPlayers.length}`, class: classes[Math.floor(Math.random() * classes.length)], x: Math.random() * 300 + 100, y: Math.random() * 200 + 100, isHost: false };
      setLobbyPlayers(prev => [...prev, newFriend]);
    }
  };

  return (
    <div className="w-full h-full relative flex flex-col justify-between overflow-hidden">
      {updateInfo && (updateInfo.status === 'available' || updateInfo.status === 'downloading' || updateInfo.status === 'downloaded') && (
        <div className="bg-gradient-to-r from-violet-900 to-indigo-950 border-b border-violet-500/30 px-6 py-2.5 text-center text-xs flex justify-between items-center z-50">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">🔄</span>
            {updateInfo.status === 'available' && <span>A new update (v{updateInfo.version}) is available. Starting download...</span>}
            {updateInfo.status === 'downloading' && <span>Downloading new update: {Math.round(updateInfo.percent)}%</span>}
            {updateInfo.status === 'downloaded' && <span>Update v{updateInfo.version} downloaded successfully!</span>}
          </div>
          {updateInfo.status === 'downloaded' && (
            <button onClick={() => window.api?.installUpdate()} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1 rounded transition-colors duration-200 cursor-pointer">Restart & Install</button>
          )}
        </div>
      )}
      
      {screen === 'welcome' && (
        <div className="flex-1 flex flex-col justify-center items-center p-6">
          <div className="bg-[rgba(18,14,32,0.65)] backdrop-blur-md border border-[rgba(255,255,255,0.07)] hover:border-[rgba(138,92,246,0.25)] rounded-2xl p-12 flex flex-col items-center max-w-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all duration-300">
            <h1 className="font-['Cinzel'] text-5xl font-black tracking-widest text-center bg-gradient-to-br from-white to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(167,139,250,0.15)] leading-none">DUNGEON GUILD</h1>
            <h2 className="font-['Cinzel'] text-3xl font-bold tracking-[0.3em] text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.35)] text-center mt-2 mb-6 pl-[0.3em]">BATTLER</h2>
            <p className="text-slate-400 text-center leading-relaxed max-w-md mb-8 font-light">Assemble your party, conquer dangerous depths, draft mythical loot, and lead your guild to absolute glory.</p>
            <button onClick={() => setScreen('list')} className="font-['Cinzel'] font-bold text-lg px-12 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg shadow-[0_4px_20px_rgba(124,58,237,0.3)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group">Enter Guild</button>
          </div>
        </div>
      )}

      {(screen === 'list' || screen === 'create') && (
        <CharacterSelect viewMode={screen} characters={characters} removingIds={removingIds} handleDelete={handleDelete} enterGuildLobby={enterGuildLobby} setScreen={setScreen} presets={CLASS_PRESETS} selectedClass={selectedClass} setSelectedClass={setSelectedClass} charName={charName} setCharName={setCharName} validationMsg={validationMsg} setValidationMsg={setValidationMsg} handleCreate={handleCreate} />
      )}

      {screen === 'lobby-portal' && (
        <LobbyPortal selectedCharacter={selectedCharacter} availableLobbies={availableLobbies} fetchLobbies={fetchLobbies} handleHostLobby={handleHostLobby} handleJoinLobby={handleJoinLobby} setScreen={setScreen} />
      )}

      {screen === 'guild-lobby' && (
        <div className="flex-grow flex flex-col p-8 overflow-hidden">
          <header className="flex justify-between items-center mb-6 flex-shrink-0">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-['Cinzel'] text-3xl font-bold tracking-wide text-white drop-shadow">Guild Hall</h2>
                <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded ${isNetworkMock ? 'bg-amber-600 text-white' : 'bg-green-600 text-white'}`}>{isNetworkMock ? 'Mock Network' : 'Steamworks P2P'}</span>
              </div>
              <p className="text-slate-400 text-sm mt-1">Lobby ID: <span className="text-cyan-400 font-mono font-semibold">{activeLobbyId}</span></p>
            </div>
            <button onClick={() => { setActiveLobbyId(null); setScreen('list'); }} className="px-5 py-2 bg-red-950/20 border border-red-900/40 text-red-300 hover:text-white hover:bg-red-900/40 rounded transition-all duration-200 cursor-pointer">Leave Party</button>
          </header>

          <div className="flex-grow grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 min-h-0">
            <div className="flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase">Click inside the hall to move your hero</span>
                {isNetworkMock && <button onClick={addSimulatedFriend} className="px-3 py-1 bg-violet-900/40 hover:bg-violet-900/70 border border-violet-800/40 text-violet-300 hover:text-white rounded text-xs font-bold transition-all duration-200 cursor-pointer">Simulate Friend Join</button>}
              </div>

              <div ref={guildHallRef} onClick={handleGuildHallClick} className="flex-grow bg-slate-950/80 border border-violet-950/60 rounded-xl relative overflow-hidden bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:24px_24px] cursor-crosshair shadow-inner">
                <div className="absolute top-[30%] left-[45%] w-32 h-32 rounded-full border border-violet-500/5 bg-violet-500/[0.01] flex items-center justify-center pointer-events-none">
                  <span className="text-xs text-violet-500/20 font-['Cinzel'] tracking-wider">Muster Circle</span>
                </div>

                {lobbyPlayers.map(p => {
                  const presetData = CLASS_PRESETS[p.class] || CLASS_PRESETS.Warrior;
                  return (
                    <div key={p.id} className="absolute w-12 h-12 -ml-6 -mt-6 flex flex-col items-center select-none" style={{ left: `${p.x}px`, top: `${p.y}px`, transition: 'left 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl bg-slate-900 border-2 shadow-lg relative group ${p.isHost ? 'border-amber-400 shadow-amber-500/10' : 'border-violet-500'}`}>
                        {presetData.icon}
                        {p.isHost && <span className="absolute -top-3.5 text-xs text-amber-400 drop-shadow">👑</span>}
                        <div className="absolute bottom-11 scale-0 group-hover:scale-100 bg-slate-900 border border-slate-700/60 text-[10px] px-2 py-0.5 rounded text-white font-semibold whitespace-nowrap shadow-md transition-all duration-150 z-20 pointer-events-none">{p.name}</div>
                      </div>
                      <span className="text-[10px] text-slate-300 font-semibold bg-black/65 px-1.5 py-0.2 rounded mt-1 shadow-sm whitespace-nowrap">{p.name.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <PlayerList lobbyPlayers={lobbyPlayers} presets={CLASS_PRESETS} />
          </div>
        </div>
      )}
    </div>
  );
}
