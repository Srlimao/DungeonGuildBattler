const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  environment: 'development',
  
  createLobby: (hostData) => ipcRenderer.invoke('net-create-lobby', hostData),
  listLobbies: () => ipcRenderer.invoke('net-list-lobbies'),
  joinLobby: (lobbyId, playerData) => ipcRenderer.invoke('net-join-lobby', { lobbyId, playerData }),
  sendPosition: (playerId, x, y) => ipcRenderer.invoke('net-send-position', { playerId, x, y }),
  sendReady: (playerId, ready) => ipcRenderer.invoke('net-send-ready', { playerId, ready }),
  startCombat: (combatData) => ipcRenderer.invoke('net-start-combat', { combatData }),
  castSkill: (playerId, skillId) => ipcRenderer.invoke('net-cast-skill', { playerId, skillId }),
  returnToLobby: () => ipcRenderer.invoke('net-return-to-lobby'),
  simulateJoin: () => ipcRenderer.invoke('net-simulate-join'),
  simulateFriendMove: () => ipcRenderer.invoke('net-simulate-friend-move'),
  leaveLobby: () => ipcRenderer.invoke('net-leave-lobby'),
  
  onPlayersUpdate: (callback) => {
    const handler = (event, players) => callback(players);
    ipcRenderer.on('net-players-update', handler);
    return () => ipcRenderer.removeListener('net-players-update', handler);
  },
  
  onGameStateChange: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('net-game-state-change', handler);
    return () => ipcRenderer.removeListener('net-game-state-change', handler);
  },
  
  onCombatEvent: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('net-combat-event', handler);
    return () => ipcRenderer.removeListener('net-combat-event', handler);
  },

  onCombatStateUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('net-combat-state-update', handler);
    return () => ipcRenderer.removeListener('net-combat-state-update', handler);
  },

  onCombatResolve: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('net-combat-resolve', handler);
    return () => ipcRenderer.removeListener('net-combat-resolve', handler);
  },
  
  onUpdateStatus: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
  
  installUpdate: () => ipcRenderer.invoke('install-update')
});
