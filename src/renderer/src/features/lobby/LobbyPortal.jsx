import React from 'react';

export default function LobbyPortal({ 
  selectedCharacter, 
  availableLobbies, 
  fetchLobbies, 
  handleHostLobby, 
  handleJoinLobby, 
  setScreen 
}) {
  return (
    <div className="flex-grow flex flex-col p-10 overflow-hidden">
      <header className="flex justify-between items-center mb-8 flex-shrink-0">
        <div>
          <h2 className="font-['Cinzel'] text-3xl font-bold tracking-wide text-white drop-shadow">Matchmaking Portal</h2>
          <p className="text-slate-400 text-sm mt-1">Host a new guild session or join an active one</p>
        </div>
        <button 
          onClick={() => setScreen('list')}
          className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-transform duration-200 hover:-translate-x-1"
        >
          ← Back to Roster
        </button>
      </header>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-10 min-h-0">
        
        {/* Host Panel */}
        <div className="bg-[rgba(18,14,32,0.65)] backdrop-blur-md border border-[rgba(255,255,255,0.07)] hover:border-violet-500/40 rounded-2xl p-8 flex flex-col justify-between shadow-lg">
          <div>
            <h3 className="font-['Cinzel'] text-2xl font-bold text-white mb-4">Host New Session</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Initialize a new secure matchmaking lobby. Your local system will act as the authoritative game host. Friends can join you directly via Steam or Mock code.
            </p>
            {selectedCharacter && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="text-4xl">🛡️</div>
                <div>
                  <div className="text-sm font-bold text-white">{selectedCharacter.name}</div>
                  <div className="text-xs text-slate-400">Class: {selectedCharacter.class} | Level: {selectedCharacter.level}</div>
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={handleHostLobby}
            className="w-full font-semibold py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer text-center mt-6"
          >
            Create Lobby (Max 10 Players)
          </button>
        </div>

        {/* Join Panel (Lobbies list) */}
        <div className="bg-[rgba(18,14,32,0.65)] backdrop-blur-md border border-[rgba(255,255,255,0.07)] hover:border-cyan-500/35 rounded-2xl p-8 flex flex-col overflow-hidden shadow-lg">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h3 className="font-['Cinzel'] text-2xl font-bold text-white">Browse Active Lobbies</h3>
            <button 
              onClick={fetchLobbies}
              className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1"
            >
              🔄 Refresh List
            </button>
          </div>

          <div className="flex-grow overflow-y-auto flex flex-col gap-4 pr-1">
            {availableLobbies.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <span className="text-4xl mb-3 opacity-60">🌌</span>
                <p className="text-sm text-slate-400">No active lobbies detected on the network.</p>
              </div>
            ) : (
              availableLobbies.map(lobby => (
                <div key={lobby.id} className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl p-5 flex justify-between items-center transition-all duration-200">
                  <div>
                    <div className="font-bold text-white text-sm flex items-center gap-2">
                      <span>{lobby.name}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-normal">
                        Max 10
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Host: {lobby.hostName}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400 font-mono">
                      {lobby.memberCount} / 10
                    </span>
                    <button 
                      onClick={() => handleJoinLobby(lobby.id)}
                      disabled={lobby.memberCount >= 10}
                      className={`px-4 py-2 text-xs font-bold rounded transition-all duration-200 ${
                        lobby.memberCount >= 10 
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer shadow-sm hover:shadow'
                      }`}
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
