# Dungeon Guild Battler

A phase-based, multiplayer 2D auto-battler built as a desktop application. Players form a guild party, enter dungeons, watch automated combat, draft loot interactively, level up, and vote on progression routes.

---

## 🛠️ Tech Stack

- **Client App Shell**: [Electron](https://www.electronjs.org/) (Strict separation of Main and Renderer processes)
- **Client UI**: [React](https://react.dev/) + [Vite](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Steam Integration**: `steamworks.js` (Lobbies, P2P Networking, Overlay)
- **Networking Layer**: Steam P2P Networking (Fallback to Local Mock mode if Steam client is not active)
- **Packaging & Updates**: `electron-builder` + `electron-updater`

---

## 📁 Project Structure

```
/project-root
├── /src
│   ├── /main                  # Electron Main Process (System & Host Server)
│   │   ├── index.js           # Electron initialization & window loader
│   │   ├── preload.js         # IPC Bridge API
│   │   ├── updater.js         # electron-updater logic (GitHub releases)
│   │   └── /host_server       # Host Authoritative Logic
│   │       └── SteamP2PManager.js # Steamworks P2P & simulated fallback logic
│   ├── /renderer              # Electron Renderer Process (React App)
│   │   ├── /src
│   │   │   ├── /features      # Sliced game phase features
│   │   │   │   └── /lobby     # STATE_LOBBY UI & logic
│   │   │   └── App.jsx        # Main UI wrapper
│   │   └── index.html         # UI HTML entry point
│   └── /shared                # Shared constants and state definitions
├── package.json
└── tailwind.config.js
```

---

## 🚀 Getting Started

### Prerequisites
1. [Node.js](https://nodejs.org/) (v18+ recommended)
2. Steam Client running (optional, falls back to Mock simulation mode automatically if Steam is offline)

### Installation
Install dependencies in the root project and the renderer directory:

```bash
# Install root dependencies (Electron, Steamworks, Builder)
npm install

# Install UI dependencies (React, Vite, Tailwind CSS v4)
cd src/renderer
npm install
```

### Running Development Environment
To run the project with hot-reloading support, you need to spin up the React development server first, then launch the Electron shell.

1. **Start the React dev server**:
   ```bash
   cd src/renderer
   npm run dev
   ```
2. **Start the Electron app** (in a separate terminal inside the project root):
   ```bash
   npm start
   ```

---

## 🔄 Deployment & Updates

The project uses a two-phase rollout strategy:
- **Phase 1: Alpha/Beta Testing (GitHub Releases)**: Updates are polled from GitHub Releases via `electron-updater`.
- **Phase 2: Steam Production Release**: Custom updater logic is bypassed. To compile for Steam, build with `STEAM_BUILD=true` environmental variable set.
