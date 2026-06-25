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
To run both the React Vite development server and the Electron shell together in a single command, run the following from the project root directory:

```bash
npm run dev
```

This will spin up the Vite development server, wait for it to be active, and automatically launch the Electron window.

---

## 🔄 Packaging & Deployment

To compile the React frontend and package the entire desktop application into a distributable installer (located in the `/out` directory), run:

```bash
npm run build
```

The project uses a two-phase rollout strategy:
- **Phase 1: Alpha/Beta Testing (GitHub Releases)**: Updates are polled from GitHub Releases via `electron-updater`.
- **Phase 2: Steam Production Release**: Custom updater logic is bypassed. To compile for Steam, build with `STEAM_BUILD=true` environmental variable set.
