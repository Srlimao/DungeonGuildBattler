# Technical Architecture & Network Specification

**Project:** 2D Multiplayer Co-op Auto-Battler  
**Platform:** Desktop (Electron)  
**Architecture:** Host-Authoritative Listen Server (P2P via Steamworks)  

---

## 1. Technical Stack

-   **Client App Shell:** Electron (Node.js Main Process + Chromium Renderer Process).
-   **Steam Integration:** `steamworks.js` (Handles Lobbies, P2P Networking, and overlay API directly in the Node.js Main Process).
-   **Client UI Framework:** React (Vite-based bundling for the renderer process).
-   **Styling:** Tailwind CSS (utility-first CSS engine).
-   **Networking Layer:** Steam Networking Sockets (P2P packets securely routed via Steam relay servers, bypassing firewall/NAT issues).
-   **Packaging & Deployment:** `electron-builder` (distributes portable/installable Windows target binaries).
-   **Auto-Update Pipeline:** `electron-updater` (pulls updates from GitHub Releases).

---

## 2. The Steamworks P2P Model

To bypass the need for a costly, centralized cloud infrastructure, the game operates on a **Listen Server** architecture:

-   **The Host:** The player hosting the session creates a Lobby. The host's Electron **Main Process** acts as the server authority, running the lobby synchronization engine (`HostLobbyManager.js`) and the real-time combat engine (`HostCombatEngine.js`).
-   **The Clients:** Connected players send user inputs/actions (e.g. `{ type: 'CAST_SKILL', playerId: '...', skillId: '...' }`) over Steam P2P to the host.
-   **Host-Authoritative State:** The Host calculates the game/combat tick calculations (10Hz combat loops, auto-attacks, HP/MP shifts, and combo triggers) and broadcasts the verified state truth (`COMBAT_EVENT`, `STATE_UPDATE`) back to all clients. Clients update their local React state and play animations based strictly on these server-sent truths.

---

## 3. Host State Machine & Transitions

The game transitions through the following architectural states over the P2P connection:

1.  **Lobby Syncing**: Players join, choose characters, and toggle readiness. The Host's lobby manager synchronizes the roster.
2.  **Combat Loop**: The Host spins up the tick ticker (10Hz). Clients stream key inputs (active skill triggers), and the Host broadcasts combat delta events to all clients.
3.  **Loot Draft**: Contested items are claimed. The host generates secure, server-side rolls to determine who wins each item, preventing client cheating.
4.  **Intermission/Vote**: Clients submit path choices. The host aggregates votes, breaks ties, and transitions the party.

---

## 4. Agent-Optimized Project Structure

The folder structure organizes files by feature slicing (vertical domain segregation) and technical responsibility:

```
/auto-battler-project
├── /src
│   ├── /main                  # Electron Main Process (System & Host Server)
│   │   ├── index.js           # Electron init and IPC registrations
│   │   ├── preload.js         # IPC bridge expose API
│   │   ├── updater.js         # electron-updater config (GitHub releases)
│   │   └── /host_server       # The Authoritative Listen Server logic
│   │       ├── SteamP2PManager.js   # P2P packet multiplexer & bridge controller
│   │       ├── HostLobbyManager.js  # Manages lobby joins, moves, readiness, and mock lobbies
│   │       ├── HostCombatEngine.js  # Runs 10Hz tick, Boss AI, combat logs, and combo validations
│   │       └── mockData.js          # Mock lobbies templates and start positions
│   ├── /renderer              # Electron Renderer Process (Browser/Game UI)
│   │   └── /src
│   │       ├── /services
│   │       │   └── AppNetwork.js    # Routes UI requests to main process IPC or simulated mock loops
│   │       └── /features            # Vertically sliced feature domains
│   │           └── /combat          # Combat features (JRPG view, status overlay)
│   │               ├── CombatPhase.jsx           # Main feature entry, networking subscriber
│   │               ├── CombatBattleground.jsx    # Visual battlefield viewport, JRPG formation
│   │               ├── CombatRetroMenu.jsx       # FF-style status panel, commands, actions
│   │               ├── CombatVictoryDefeatOverlay.jsx # End-game victory/defeat panels
│   │               ├── CombatNetwork.js          # Encapsulated combat IPC network hooks
│   │               └── combat.md                 # Localized combat design and styles map
│   └── /shared                # Shared assets and static structures
│       ├── skill_data.json    # Configured skill database (auto & active skills)
│       └── constants.js       # Shared static definitions
├── package.json
└── tailwind.config.js
```

---

## 5. Deployment & Auto-Update Strategy

The project utilizes a two-phase update strategy to accommodate both alpha testing and the final Steam release.

-   **Phase 1: Alpha/Beta Testing (GitHub Releases)**
    -   The app uses `electron-builder` to package the executable and publish it to a GitHub repository's "Releases" page.
    -   The `updater.js` file uses `electron-updater` to poll GitHub on startup. If a new version exists, it downloads it in the background and prompts the user via IPC to restart the app.
-   **Phase 2: Steam Production Release**
    -   **CRITICAL:** When packaging for the final Steam release, the `electron-updater` logic **must be disabled** via an environment variable (e.g., `STEAM_BUILD=true`). Steam requires all game updates to be pushed through the Steamworks pipeline, and custom updaters violate Steam's store policies.

---

## 6. AI Development Guidelines

-   **Colocation Rule:** Keep markup, components, and logic in the exact same directory under `/features`. Keep file lengths strictly under 300 lines (refactor monolithic views into colocated sub-components).
-   **Network Agnosticism in UI:** The React components should not care if they are communicating with a remote server or a local mock network loop. They must dispatch requests via `AppNetwork` and respond to callbacks.
-   **Steam App ID:** Use App ID `480` (Spacewar) during development to test the Steam overlay and lobbies without having to pay the Steam Direct fee.