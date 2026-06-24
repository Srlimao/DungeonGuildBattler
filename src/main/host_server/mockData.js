// Preset positions in Guild Hall for new joins
const START_POSITIONS = [
  { x: 200, y: 300 },
  { x: 300, y: 250 },
  { x: 400, y: 320 },
  { x: 500, y: 280 },
  { x: 600, y: 240 },
  { x: 450, y: 180 },
  { x: 350, y: 150 },
  { x: 250, y: 220 },
  { x: 180, y: 190 }
];

// Simulated Lobbies List (Mock mode)
const MOCK_LOBBIES = [
  {
    id: "MOCK_LOBBY_1",
    name: "Valiant Shields Guild",
    hostName: "Soren",
    memberCount: 3,
    maxPlayers: 10,
    players: [
      { id: "mock_host_1", name: "Soren (Host)", class: "Warrior", x: 150, y: 200, isHost: true },
      { id: "mock_guest_1a", name: "Kaelen", class: "Mage", x: 280, y: 260, isHost: false },
      { id: "mock_guest_1b", name: "Lira", class: "Rogue", x: 410, y: 190, isHost: false }
    ]
  },
  {
    id: "MOCK_LOBBY_2",
    name: "Arcane Spells Sanctum",
    hostName: "Eldrin",
    memberCount: 5,
    maxPlayers: 10,
    players: [
      { id: "mock_host_2", name: "Eldrin (Host)", class: "Mage", x: 150, y: 200, isHost: true },
      { id: "mock_guest_2a", name: "Garrick", class: "Warrior", x: 300, y: 310, isHost: false },
      { id: "mock_guest_2b", name: "Jumina", class: "Cleric", x: 220, y: 150, isHost: false },
      { id: "mock_guest_2c", name: "Varis", class: "Rogue", x: 500, y: 280, isHost: false },
      { id: "mock_guest_2d", name: "Faelar", class: "Warrior", x: 450, y: 200, isHost: false }
    ]
  },
  {
    id: "MOCK_LOBBY_3",
    name: "Dagger in the Dark",
    hostName: "Valera",
    memberCount: 8,
    maxPlayers: 10,
    players: [
      { id: "mock_host_3", name: "Valera (Host)", class: "Rogue", x: 150, y: 200, isHost: true },
      { id: "mock_guest_3a", name: "Darek", class: "Warrior", x: 300, y: 250, isHost: false },
      { id: "mock_guest_3b", name: "Orin", class: "Mage", x: 400, y: 320, isHost: false },
      { id: "mock_guest_3c", name: "Sylvia", class: "Cleric", x: 500, y: 280, isHost: false },
      { id: "mock_guest_3d", name: "Brog", class: "Warrior", x: 220, y: 300, isHost: false },
      { id: "mock_guest_3e", name: "Celeste", class: "Mage", x: 450, y: 180, isHost: false },
      { id: "mock_guest_3f", name: "Talon", class: "Rogue", x: 600, y: 240, isHost: false },
      { id: "mock_guest_3g", name: "Zael", class: "Cleric", x: 350, y: 150, isHost: false }
    ]
  }
];

module.exports = {
  START_POSITIONS,
  MOCK_LOBBIES
};
