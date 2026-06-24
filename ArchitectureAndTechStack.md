# Technical Architecture & Game Design Document

**Project:** 2D Multiplayer Co-op Auto-Battler **Platform:** Desktop (Electron) **Architecture:** Host-Authoritative (P2P via Steamworks)

## 1\. Tech Stack

-   **Client App Shell:** Electron (Node.js Main Process + Chromium Renderer Process).
-   **Steam Integration:** `steamworks.js` (Handles Lobbies, P2P Networking, Overlay, and Achievements directly in Node.js).
-   **Client UI:** HTML/CSS with React/Vue.
-   **Client Game Engine:** Phaser 3 or PixiJS for auto-battle visualization.
-   **Styling:** Tailwind CSS.
-   **Networking Layer:** Steam Networking Sockets (Replaces WebSockets/Socket.io).
-   **Packaging & Updates:** `electron-builder` and `electron-updater`.

## 2\. The Steam P2P Architecture

By integrating Steamworks, we eliminate the need for a dedicated cloud server. The game relies on a "Listen Server" model.

-   **The Host:** When a player creates a party, their Electron **Main Process** spins up the `StateMachine.js` and `PartyManager.js`. They act as the absolute authority for the game session. Steam Matchmaking API creates a "Lobby" and assigns it a Steam ID.
-   **The Clients:** Other players see the Host in their Steam Friends list. They click "Join Game." Steam securely routes their connection directly to the Host's Electron app.
-   **Data Flow:** Clients send intent payloads (`{ action: 'CLAIM_LOOT', item_id: 12 }`) over the Steam P2P network to the Host. The Host calculates the result and broadcasts the truth back.

## 3\. Core Game Loop (Host State Machine)

1.  **`STATE_LOBBY`:**
    
    -   Host creates a Steam Lobby.
    -   Friends join via Steam overlay or invites.
2.  **`STATE_DUNGEON_SELECT`:**
    
    -   Host selects the dungeon configuration.
    -   Host's local machine initializes dungeon state.
3.  **`STATE_COMBAT`:**
    
    -   Host instantly calculates the battle outcome.
    -   Host sends the Combat Log over Steam P2P to clients.
    -   All clients animate the fight locally.
4.  **`STATE_LOOT_DRAFT`:**
    
    -   **Mechanic:** "Claim and Roll".
    -   **Resolution:** If multiple players claim an item, the _Host's machine_ rolls the internal dice to prevent cheating, and broadcasts the winner.
5.  **`STATE_INTERMISSION` & `STATE_PATH_SELECT`:**
    
    -   Majority vote for next path. Ties are broken by the Host's vote.

## 4\. Agent-Optimized Project Structure

Because the server now lives inside the Host's Electron app, the folder structure merges into one cohesive desktop application.

```
/auto-battler-project
├── /src
│   ├── /main                  # Electron Main Process (System & Host Server)
│   │   ├── index.js           # Electron init and steamworks.js setup
│   │   ├── updater.js         # electron-updater logic (GitHub Releases)
│   │   ├── /host_server       # The Authoritative Logic (Runs ONLY if player is Host)
│   │   │   ├── StateMachine.js
│   │   │   └── SteamP2PManager.js # Handles incoming P2P packets
│   │   └── /client_network    # Network logic for joining a host
│   ├── /renderer              # Electron Renderer Process (Browser/Game)
│   │   ├── /features          # UI Components
│   │   │   ├── /lobby
│   │   │   │   └── LobbyPhase.jsx 
│   │   │   └── /loot_draft
│   │   │       └── LootDraftPhase.jsx
│   │   ├── /combat_engine     # Phaser/Pixi visualizer
│   │   └── index.html
│   └── /shared                # Shared constants and data schemas
├── package.json
└── tailwind.config.js

```

## 5\. Deployment & Auto-Update Strategy

The project utilizes a two-phase update strategy to accommodate both alpha testing and the final Steam release.

-   **Phase 1: Alpha/Beta Testing (GitHub Releases)**
    
    -   The app uses `electron-builder` to package the executable and publish it to a GitHub repository's "Releases" page.
    -   The `updater.js` file uses `electron-updater` to poll GitHub on startup. If a new version exists, it downloads it in the background and prompts the user via IPC to restart the app.
-   **Phase 2: Steam Production Release**
    
    -   **CRITICAL:** When packaging for the final Steam release, the `electron-updater` logic **must be disabled** via an environment variable (e.g., `STEAM_BUILD=true`). Steam requires all game updates to be pushed through the Steamworks pipeline, and custom updaters violate Steam's store policies.

## 6\. AI Development Guidelines

-   **Colocation Rule:** Use Tailwind utility classes directly in UI components. No separate CSS files.
-   **Network Agnosticism in UI:** The React/Vue components should not care if they are communicating with a remote server or the local Host process. They should dispatch generic events (e.g., `AppNetwork.send('VOTE_PATH')`) and let the network layer route it through Steamworks.
-   **Steam App ID:** Use App ID `480` (Spacewar) during development to test the Steam overlay and lobbies without having to pay the Steam Direct fee yet.