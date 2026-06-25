# Combat Phase - Technical Documentation

This module defines the client-side JRPG-style visualization of the host-authoritative combat. The combat simulation runs instantly on the host's system and produces a deterministic list of chronological events. The client plays these events back with a slight delay, visualizing a classic JRPG real-time active battle.

## Component Architecture

To maintain clean context and comply with strict 300-line limitations, the Combat Phase is split into localized sub-components:

1.  **`CombatPhase.jsx`**
    *   **Role**: Primary controller shell.
    *   **Responsibilities**: Handles P2P networking hooks (`CombatNetwork` subscriptions), combat state, cooldown timers, active combos, and delegates layout rendering.
2.  **`CombatBattleground.jsx`**
    *   **Role**: Visual battle area.
    *   **Responsibilities**: Positions the Boss on the left/center-left, and staggers party members diagonally on the right in classic JRPG battle formation. Handles idle breathing, shake damage impacts, and floating status texts.
3.  **`CombatRetroMenu.jsx`**
    *   **Role**: Retro command & status panel.
    *   **Responsibilities**: Renders the Final Fantasy double-bordered blue HUD. The left column lists combat commands (auto-attack tag and active skill castings with mana/cooldown timers). The right column shows real-time party metrics (names, HP/MP fractional readouts, and retro progress bars).
4.  **`CombatVictoryDefeatOverlay.jsx`**
    *   **Role**: End-game pop-up.
    *   **Responsibilities**: Displays the victory celebration or defeat card in retro theme with returning lobby actions.

## Styling & Animations

The JRPG theme utilizes custom styles loaded via `index.css`:

*   **Retro Typography**: Loaded Google Font `'Press Start 2P'` selectively for combat numbers, HP/MP metrics, headers, and commands to maintain readability.
*   **Blue Window Style (`.ff-window`)**: Styled double-bordered classic blue gradient dialog panels.
*   **Grid Background (`.jrpg-battleground`)**: Styled with a grid layout representing a tactical arena floor.
*   **Combat Animations**:
    *   `animate-float-fade`: Animates floating damage `-12 DMG` / healing `+15 HP` texts scaling and fading upwards.
    *   `animate-breathe`: Idle breathing vertical scale/translate changes.
    *   `animate-shake`: Sudden X-axis translation shake triggered upon receiving damage.
    *   `animate-combo-pulse`: Glowing gold border transitions when active skills are primed for party combos.

