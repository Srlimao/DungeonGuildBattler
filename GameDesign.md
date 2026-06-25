# Dungeon Guild Battler - Game Design Document

**Genre:** 2D Multiplayer Co-op Auto-Battler with Real-Time Action elements  
**Platform:** Desktop (Electron)  
**Session Model:** Host-Authoritative Listen Server (Steamworks P2P or Local Mock)  

---

## 1. Game Vision & Concept

*Dungeon Guild Battler* blends the strategic preparation of auto-battlers with the real-time decision-making of classic Action RPGs (like *Path of Exile*) and cooperative JRPGs (like *Chrono Trigger*). Players muster a party of heroes, venture into treacherous dungeons, coordinate active skill execution to trigger powerful combos, and draft epic loot.

---

## 2. Core Game Loop & Phase Design

Dungeon crawls progress through five distinct states, authorized by the lobby host:

### Phase A: Guild Hall (Lobby)
- Players assemble in the guild lobby. The hosting player creates a lobby (which registers a native Steamworks matchmaking lobby or a local mock lobby).
- Guild members select their character class (Warrior, Mage, Rogue, Cleric), select a custom name, and toggle their "Ready" status.
- Once all players are ready, the host can proceed to the Dungeon selection.

### Phase B: Roster / Dungeon Select
- The host selects the dungeon node to enter, which initializes the dungeon's monsters, path layout, and loot pool.

### Phase C: Active Combat (The Arena)
- The heart of the gameplay: a live, real-time battle against dungeon bosses.
- Unlike passive log-playback auto-battlers, this phase utilizes a **10Hz tick loop** calculated on the Host's system:
  - **Auto-Attacks**: Every hero automatically performs their basic attack on a set speed interval (cooldown) specific to their class. Auto-attacks require no player intervention.
  - **Active Skills**: Each player has access to one powerful class-specific active skill on their hotbar. Casting an active skill is manual, consumes Mana, and places the skill on a cooldown swipe timer.
  - **Combo Priming & Execution**: Active skills can apply a timed element/primer status on the boss, or execute off a primed status to trigger high-damage combos.
  - **Dungeon Threat (Boss AI)**: The boss acts on its own timer, automatically striking a random party member every 3.5 seconds.
  - **Resolution**: Combat ends in **Victory** if the Boss's health reaches 0, or **Defeat** if all party members are slain.

### Phase D: Loot Draft
- After vanquishing a boss, a selection of magical items is presented to the party.
- **Claim & Roll Mechanics**: Players can bid on or claim items. If multiple party members claim the same item, the Host's server rolls internal random numbers (1-100) to distribute the item to the highest roller, preventing clients from cheating.

### Phase E: Intermission & Path Select
- The guild rests between combat encounters and votes on which corridor or path to pursue next.
- Majority vote decides the route. Ties are broken by the host's decision.

---

## 3. Combat System Mechanics

Combat is real-time, action-oriented, and highly cooperative.

### The Mana System
- Mana (MP) is the universal resource for all active player skills.
- Basic auto-attacks cost 0 mana.
- Active skills consume a specified amount of mana.
- Every living hero regenerates **+5 Mana per second** automatically during combat.

### Combo Priming & Chaining (Option B)
Active skills are designed to interact through elemental and physical tags (e.g., `Fire`, `Cold`, `Physical`, `Lightning`). 

1. **Priming**: When a skill with a `primeTag` is cast, it applies that status tag to the boss for a set duration (e.g., 4.0s). The boss displays a timed status badge under its health bar.
2. **Execution**: If a skill with a matching `executeTag` is cast while the boss is primed, it detonates a **Combo**, dealing substantial bonus damage and showing floating combat text alerts.
3. **Same-Skill Penalty**:
   - To encourage party cooperation and prevent players from solo-spamming their own combos, executing a combo using the **exact same skill ID** that primed it applies a **40% penalty (0.6x combo damage multiplier)** to the bonus combo damage.
   - Executing a combo primed by a teammate's skill or a different skill ID grants **100% of the combo bonus damage**.
4. **Chaining (Non-Consumable Primes)**:
   - Executing a combo **does not remove** the primed tag from the boss.
   - The status remains active on the boss for its full duration, allowing multiple players in the party to chain execution skills off a single prime tag.

---

## 4. Class Archetypes & Skills Database

All character abilities are data-driven and loaded from [skill_data.json](file:///d:/Games/DungeonGuildBattler/src/shared/skill_data.json). This allows developers to balance damage numbers, mana costs, and cooldowns on the fly.

### 🛡️ Warrior
* **Auto-Attack:** *Slash* (Physical damage, fast auto-cooldown).
* **Active Skill:** *Shield Slam* (Consumes 40 MP. Cooldown: 6.0s. Deals physical damage. Primes `Physical` status. Executes off `Physical` status. Ideal for armor-breaking combos).

### 🔥 Mage
* **Auto-Attack:** *Flame Dart* (Fire damage, slow auto-cooldown).
* **Active Skill:** *Fireball* (Consumes 45 MP. Cooldown: 5.0s. Deals fire damage. Primes `Fire` status. Executes off `Fire` status. Pulsates golden when the boss is primed with `Fire`).

### ⚡ Rogue
* **Auto-Attack:** *Dagger Stab* (Physical damage, very fast auto-cooldown).
* **Active Skill:** *Ice Strike* (Consumes 30 MP. Cooldown: 4.0s. Deals cold damage. Primes `Cold` status. Executes off `Cold` status. Performs rapid cold combos).

### 🌟 Cleric
* **Auto-Attack:** *Holy Smite* (Lightning damage, medium auto-cooldown).
* **Active Skill:** *Holy Bolt* (Consumes 50 MP. Cooldown: 8.0s. Deals lightning damage. Primes `Lightning` status. Executes off `Lightning` status. Additionally heals the lowest health party member for massive HP).
