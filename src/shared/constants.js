// Game Loop Phases
export const STATE_LOBBY = 'STATE_LOBBY';
export const STATE_DUNGEON_SELECT = 'STATE_DUNGEON_SELECT';
export const STATE_COMBAT = 'STATE_COMBAT';
export const STATE_LOOT_DRAFT = 'STATE_LOOT_DRAFT';
export const STATE_INTERMISSION = 'STATE_INTERMISSION';
export const STATE_PATH_SELECT = 'STATE_PATH_SELECT';

// WebSocket Events
export const EVENTS = {
  // Client -> Server
  JOIN_ROOM: 'join_room',
  CLAIM_LOOT: 'claim_loot',
  VOTE_PATH: 'vote_path',
  SET_READY_STATUS: 'set_ready_status',
  COMBAT_VIEW_COMPLETE: 'combat_view_complete',

  // Server -> Client
  STATE_CHANGE: 'state_change',
  PARTY_UPDATE: 'party_update',
  LOOT_POOL_UPDATE: 'loot_pool_update',
  COMBAT_PLAYBACK_DATA: 'combat_playback_data'
};
