let playersUpdateCallbacks = new Set();
let updateStatusCallbacks = new Set();

let mockLobbyPlayers = [];
let mockLobbies = [
  { id: "MOCK_LOBBY_1", name: "Valiant Shields Guild", hostName: "Soren", memberCount: 3, maxPlayers: 10, players: [
    { id: "mock_host_1", name: "Soren (Host)", class: "Warrior", x: 150, y: 200, isHost: true },
    { id: "mock_guest_1a", name: "Kaelen", class: "Mage", x: 280, y: 260, isHost: false },
    { id: "mock_guest_1b", name: "Lira", class: "Rogue", x: 410, y: 190, isHost: false }
  ] },
  { id: "MOCK_LOBBY_2", name: "Arcane Spells Sanctum", hostName: "Eldrin", memberCount: 5, maxPlayers: 10, players: [
    { id: "mock_host_2", name: "Eldrin (Host)", class: "Mage", x: 150, y: 200, isHost: true },
    { id: "mock_guest_2a", name: "Garrick", class: "Warrior", x: 300, y: 310, isHost: false },
    { id: "mock_guest_2b", name: "Jumina", class: "Cleric", x: 220, y: 150, isHost: false },
    { id: "mock_guest_2c", name: "Varis", class: "Rogue", x: 500, y: 280, isHost: false },
    { id: "mock_guest_2d", name: "Faelar", class: "Warrior", x: 450, y: 200, isHost: false }
  ] },
  { id: "MOCK_LOBBY_3", name: "Dagger in the Dark", hostName: "Valera", memberCount: 2, maxPlayers: 10, players: [
    { id: "mock_host_3", name: "Valera (Host)", class: "Rogue", x: 150, y: 200, isHost: true },
    { id: "mock_guest_3a", name: "Darek", class: "Warrior", x: 300, y: 250, isHost: false }
  ] }
];

let activeLobbyId = null;
let localPlayerId = null;
let isMockEnvironment = typeof window.api === 'undefined';
let simulationInterval = null;

// Helper to start the dynamic mock player movements
function startSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  
  simulationInterval = setInterval(async () => {
    if (isMockEnvironment) {
      let changed = false;
      mockLobbyPlayers = mockLobbyPlayers.map(p => {
        if (p.id !== localPlayerId && (p.id.startsWith('mock') || p.id.startsWith('browser_mock'))) {
          changed = true;
          let newX = p.x + Math.floor(Math.random() * 40 - 20);
          let newY = p.y + Math.floor(Math.random() * 40 - 20);
          if (newX < 50) newX = 50;
          if (newX > 750) newX = 750;
          if (newY < 50) newY = 350;
          if (newY > 350) newY = 350;
          return { ...p, x: newX, y: newY };
        }
        return p;
      });
      if (changed) {
        playersUpdateCallbacks.forEach(cb => cb([...mockLobbyPlayers]));
      }
    } else {
      // Electron environment: trigger main-process friend move if we have mock players
      const hasMockFriends = mockLobbyPlayers.some(p => p.id && p.id.includes('mock'));
      if (hasMockFriends && window.api.simulateFriendMove) {
        try {
          const res = await window.api.simulateFriendMove();
          if (res.success) {
            mockLobbyPlayers = res.players;
            playersUpdateCallbacks.forEach(cb => cb(mockLobbyPlayers));
          }
        } catch (e) {
          console.error("Simulation error in Electron:", e);
        }
      }
    }
  }, 3000);
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

// Forward updates from electron main process if available
if (!isMockEnvironment) {
  window.api.onPlayersUpdate((players) => {
    mockLobbyPlayers = players;
    playersUpdateCallbacks.forEach(cb => cb(players));
  });
  window.api.onUpdateStatus((statusInfo) => {
    updateStatusCallbacks.forEach(cb => cb(statusInfo));
  });
}

export const AppNetwork = {
  isMock: () => isMockEnvironment,
  
  createLobby: async (hostData) => {
    if (isMockEnvironment) {
      activeLobbyId = 'DG-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      localPlayerId = hostData.id;
      const hostPlayer = {
        id: hostData.id,
        name: hostData.name,
        class: hostData.class,
        x: 150,
        y: 200,
        isHost: true
      };
      mockLobbyPlayers = [hostPlayer];
      
      mockLobbies.push({
        id: activeLobbyId,
        name: hostData.lobbyName || `${hostData.name}'s Guild`,
        hostName: hostData.name,
        memberCount: 1,
        maxPlayers: 10,
        players: mockLobbyPlayers
      });
      
      playersUpdateCallbacks.forEach(cb => cb(mockLobbyPlayers));
      startSimulation();
      return { success: true, lobbyId: activeLobbyId, players: mockLobbyPlayers, isMock: true, localPlayerId: localPlayerId };
    } else {
      const res = await window.api.createLobby(hostData);
      if (res.success) {
        mockLobbyPlayers = res.players;
        localPlayerId = res.localPlayerId;
        if (res.isMock) {
          startSimulation();
        }
      }
      return res;
    }
  },

  listLobbies: async () => {
    if (isMockEnvironment) {
      return mockLobbies.map(l => ({
        id: l.id,
        name: l.name,
        hostName: l.hostName,
        memberCount: l.players.length,
        maxPlayers: l.maxPlayers
      }));
    } else {
      return await window.api.listLobbies();
    }
  },

  joinLobby: async (lobbyId, playerData) => {
    if (isMockEnvironment) {
      const query = (lobbyId || '').toUpperCase().trim();
      const match = mockLobbies.find(l => l.id.toUpperCase() === query);
      if (!match) return { success: false, error: "Lobby not found" };
      if (match.players.length >= 10) return { success: false, error: "Lobby is full (Max 10 players)" };
      
      activeLobbyId = match.id;
      localPlayerId = playerData.id;
      mockLobbyPlayers = JSON.parse(JSON.stringify(match.players));
      
      if (!mockLobbyPlayers.some(p => p.id === localPlayerId)) {
        const guestPlayer = {
          id: localPlayerId,
          name: playerData.name || 'Guild Guest',
          class: playerData.class || 'Mage',
          x: 350,
          y: 280,
          isHost: false
        };
        mockLobbyPlayers.push(guestPlayer);
        match.players = JSON.parse(JSON.stringify(mockLobbyPlayers));
        match.memberCount = mockLobbyPlayers.length;
      }
      
      playersUpdateCallbacks.forEach(cb => cb(mockLobbyPlayers));
      startSimulation();
      return { success: true, lobbyId: activeLobbyId, players: mockLobbyPlayers, isMock: true, localPlayerId: localPlayerId };
    } else {
      const res = await window.api.joinLobby(lobbyId, playerData);
      if (res.success) {
        mockLobbyPlayers = res.players;
        localPlayerId = res.localPlayerId;
        if (res.isMock) {
          startSimulation();
        }
      }
      return res;
    }
  },

  sendPosition: async (playerId, x, y) => {
    if (isMockEnvironment) {
      const p = mockLobbyPlayers.find(player => player.id === playerId);
      if (p) {
        p.x = x;
        p.y = y;
      }
      playersUpdateCallbacks.forEach(cb => cb([...mockLobbyPlayers]));
      return { success: true, players: mockLobbyPlayers };
    } else {
      const res = await window.api.sendPosition(playerId, x, y);
      if (res.success) {
        mockLobbyPlayers = res.players;
      }
      return res;
    }
  },

  leaveLobby: async () => {
    stopSimulation();
    mockLobbyPlayers = [];
    activeLobbyId = null;
    localPlayerId = null;
    
    if (!isMockEnvironment) {
      return await window.api.leaveLobby();
    }
    return { success: true };
  },

  simulateJoin: async () => {
    if (isMockEnvironment) {
      if (mockLobbyPlayers.length >= 10) return { success: false, error: "Lobby is full" };
      const names = ["Alex", "Jordan", "Morgan", "Taylor", "Casey", "Sam", "Pat", "Robin", "Finley"];
      const classes = ["Warrior", "Mage", "Rogue", "Cleric"];
      
      const newFriend = {
        id: 'browser_mock_' + Date.now(),
        name: names[Math.floor(Math.random() * names.length)] + ` #${mockLobbyPlayers.length}`,
        class: classes[Math.floor(Math.random() * classes.length)],
        x: Math.random() * 300 + 100,
        y: Math.random() * 200 + 100,
        isHost: false
      };
      
      mockLobbyPlayers.push(newFriend);
      playersUpdateCallbacks.forEach(cb => cb([...mockLobbyPlayers]));
      return { success: true, players: mockLobbyPlayers };
    } else {
      const res = await window.api.simulateJoin();
      if (res.success) {
        mockLobbyPlayers = res.players;
      }
      return res;
    }
  },

  onPlayersUpdate: (callback) => {
    playersUpdateCallbacks.add(callback);
    // Fire initially if players exist
    if (mockLobbyPlayers.length > 0) {
      callback(mockLobbyPlayers);
    }
    return () => {
      playersUpdateCallbacks.delete(callback);
    };
  },

  onUpdateStatus: (callback) => {
    updateStatusCallbacks.add(callback);
    return () => {
      updateStatusCallbacks.delete(callback);
    };
  },

  installUpdate: () => {
    if (!isMockEnvironment) {
      window.api.installUpdate();
    }
  }
};
