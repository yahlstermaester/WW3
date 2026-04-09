# WW III — Multiplayer Post-Apocalyptic FPS

A real-time multiplayer first-person combat game built with **Next.js**, **Three.js**, and **Socket.io**.

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or newer
- npm (comes with Node.js)

### Setup

```bash
# 1. Extract the zip and enter the folder
cd ww3-multiplayer

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open **http://localhost:3000** in your browser. Share the URL with friends on the same network to play together!

### For LAN Multiplayer
Find your local IP (e.g. `192.168.1.x`) and have others open `http://YOUR_IP:3000`

### For Online Multiplayer
Deploy to a cloud provider:

```bash
# Build for production
npm run build

# Start production server
npm start
```

**Recommended hosts:** Railway, Render, Fly.io, or a VPS (DigitalOcean, Linode)
- Vercel won't work for the WebSocket server — use a host that supports custom Node.js servers

## How to Play

### Controls
| Action | Key |
|--------|-----|
| Move | W A S D |
| Look | Mouse |
| Shoot | Left Click |
| Block | Right Click / F |
| Dodge | Space |
| Switch Weapon | Q |
| Scoreboard | Hold Tab |
| Chat | Enter |

### Multiplayer Flow
1. Enter your name on the main menu
2. **Create Room** to host a game, or **Find Game** to join
3. In the lobby, the host clicks **Start Game**
4. All players spawn in the same level and fight together
5. Clear all enemies and vehicles to complete the level

### Weapons
**Melee:** Combat Knife → Bowie Knife → Machete → Katana
**Ranged:** Pistol → Shotgun → SMG → Rifle → Sniper

### Features
- Real-time multiplayer with Socket.io
- Server-authoritative enemy AI
- Co-op PvE across 12 levels
- Tanks & Jeeps with AI
- Enterable buildings with loot (med kits, ammo)
- Bullet tracers and muzzle flash effects
- In-game chat
- Live scoreboard
- Kill feed

## Project Structure

```
ww3-multiplayer/
├── server.js              # Express + Socket.io multiplayer server
├── next.config.js         # Next.js configuration
├── package.json           # Dependencies
├── src/
│   ├── app/
│   │   ├── layout.js      # Root layout
│   │   ├── page.js        # Main page (loads Game)
│   │   └── globals.css    # All game styles
│   ├── components/
│   │   └── Game.jsx       # Three.js game + multiplayer client
│   └── game/
│       ├── network.js     # Socket.io client wrapper
│       └── levels.json    # Level definitions
└── README.md
```

## Architecture

- **Server** (`server.js`): Runs the Next.js app + Socket.io. Manages rooms, syncs player positions, runs enemy AI on a 20Hz tick, and handles authoritative hit detection for enemies.
- **Client** (`Game.jsx`): React component that initializes Three.js, handles input, renders the 3D world, and communicates with the server.
- **Network** (`network.js`): Clean Socket.io client API with event callbacks.

## Customization

- Edit `src/game/levels.json` to add/modify levels
- Weapon stats are in `WEAPON_DATA` at the top of `Game.jsx`
- Server tick rate: `TICK_RATE` in `server.js` (default: 20)
- Max players per room: `MAX_PLAYERS_PER_ROOM` in `server.js` (default: 8)
