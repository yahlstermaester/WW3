const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const next = require('next');
const { v4: uuidv4 } = require('uuid');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

// ===== GAME STATE =====
const rooms = new Map();
const players = new Map();

const TICK_RATE = 20; // Server updates per second
const MAX_PLAYERS_PER_ROOM = 8;

class GameRoom {
  constructor(id, name, hostId, level, difficulty) {
    this.id = id;
    this.name = name;
    this.hostId = hostId;
    this.level = level;
    this.difficulty = difficulty;
    this.players = new Map();
    this.enemies = [];
    this.vehicles = [];
    this.items = [];
    this.projectiles = [];
    this.state = 'lobby'; // lobby | playing | finished
    this.createdAt = Date.now();
  }

  addPlayer(socket, playerData) {
    const player = {
      id: socket.id,
      name: playerData.name || 'Survivor',
      x: (Math.random() - 0.5) * 10,
      y: 1.7,
      z: (Math.random() - 0.5) * 10,
      rotY: 0,
      rotX: 0,
      health: 100,
      maxHealth: 100,
      score: 0,
      weapon: 0,
      weapons: ['combat_knife', 'pistol'],
      alive: true,
      team: this.players.size % 2, // 0 or 1 for team modes
      kills: 0,
      deaths: 0,
      lastUpdate: Date.now()
    };
    this.players.set(socket.id, player);
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (socketId === this.hostId && this.players.size > 0) {
      this.hostId = this.players.keys().next().value;
    }
  }

  spawnEnemies(levelData) {
    const diffMult = [0.8, 1, 1.3][this.difficulty];
    const numEnemies = Math.floor((levelData.enemies || 8) * diffMult);
    this.enemies = [];
    for (let i = 0; i < numEnemies; i++) {
      const angle = (i / numEnemies) * Math.PI * 2;
      const dist = 15 + Math.random() * 25;
      this.enemies.push({
        id: uuidv4(),
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        y: 0,
        rotY: 0,
        health: (levelData.boss && i === 0 ? 150 : 40) * diffMult,
        maxHealth: (levelData.boss && i === 0 ? 150 : 40) * diffMult,
        speed: 3.5 * diffMult,
        damage: 10 * diffMult,
        isBoss: levelData.boss && i === 0,
        isRanged: Math.random() < 0.7,
        fireRange: 22,
        fireRate: 1.5 + Math.random(),
        fireDmg: 7 * diffMult,
        state: 'patrol',
        attackCd: 0,
        targetId: null
      });
    }

    // Spawn vehicles
    const vehCount = Math.min(Math.floor(this.level / 2), 4);
    this.vehicles = [];
    for (let i = 0; i < vehCount; i++) {
      const angle = (i / Math.max(vehCount, 1)) * Math.PI * 2 + Math.PI / 4;
      const dist = 25 + Math.random() * 15;
      this.vehicles.push({
        id: uuidv4(),
        type: (i === 0 && this.level >= 4) ? 'tank' : 'jeep',
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        rotY: 0,
        health: (i === 0 && this.level >= 4 ? 200 : 80) * diffMult,
        speed: (i === 0 && this.level >= 4 ? 4 : 8),
        damage: (i === 0 && this.level >= 4 ? 30 : 15) * diffMult,
        fireCd: 0,
        state: 'patrol',
        patrolAngle: Math.random() * Math.PI * 2
      });
    }
  }

  getState() {
    return {
      id: this.id,
      name: this.name,
      state: this.state,
      level: this.level,
      difficulty: this.difficulty,
      hostId: this.hostId,
      players: Object.fromEntries(this.players),
      enemies: this.enemies,
      vehicles: this.vehicles,
      items: this.items
    };
  }
}

// ===== SERVER SETUP =====
app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    pingInterval: 10000,
    pingTimeout: 5000
  });

  // ===== SOCKET HANDLERS =====
  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    players.set(socket.id, { roomId: null });

    // List available rooms
    socket.on('list_rooms', () => {
      const roomList = [];
      rooms.forEach((room, id) => {
        if (room.state === 'lobby' && room.players.size < MAX_PLAYERS_PER_ROOM) {
          roomList.push({
            id, name: room.name, players: room.players.size,
            maxPlayers: MAX_PLAYERS_PER_ROOM, level: room.level,
            difficulty: room.difficulty
          });
        }
      });
      socket.emit('room_list', roomList);
    });

    // Create a room
    socket.on('create_room', (data) => {
      const roomId = uuidv4().slice(0, 8);
      const room = new GameRoom(roomId, data.name || 'WW3 Battle', socket.id, data.level || 0, data.difficulty || 1);
      const player = room.addPlayer(socket, data.player || {});
      rooms.set(roomId, room);
      players.get(socket.id).roomId = roomId;
      socket.join(roomId);
      socket.emit('room_joined', { roomId, player, room: room.getState() });
      console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    // Join a room
    socket.on('join_room', (data) => {
      const room = rooms.get(data.roomId);
      if (!room) return socket.emit('error_msg', 'Room not found');
      if (room.players.size >= MAX_PLAYERS_PER_ROOM) return socket.emit('error_msg', 'Room is full');
      if (room.state !== 'lobby') return socket.emit('error_msg', 'Game already started');

      const player = room.addPlayer(socket, data.player || {});
      players.get(socket.id).roomId = data.roomId;
      socket.join(data.roomId);
      socket.emit('room_joined', { roomId: data.roomId, player, room: room.getState() });
      socket.to(data.roomId).emit('player_joined', player);
      console.log(`${socket.id} joined room ${data.roomId}`);
    });

    // Start the game (host only)
    socket.on('start_game', () => {
      const pData = players.get(socket.id);
      if (!pData || !pData.roomId) return;
      const room = rooms.get(pData.roomId);
      if (!room || room.hostId !== socket.id) return;

      room.state = 'playing';
      const LEVELS = require('./src/game/levels.json');
      room.spawnEnemies(LEVELS[room.level] || LEVELS[0]);
      io.to(pData.roomId).emit('game_started', room.getState());
      console.log(`Game started in room ${pData.roomId}`);
    });

    // Player movement update
    socket.on('player_update', (data) => {
      const pData = players.get(socket.id);
      if (!pData || !pData.roomId) return;
      const room = rooms.get(pData.roomId);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player) return;

      player.x = data.x;
      player.y = data.y;
      player.z = data.z;
      player.rotY = data.rotY;
      player.rotX = data.rotX;
      player.weapon = data.weapon;
      player.health = data.health;
      player.alive = data.alive;
      player.lastUpdate = Date.now();

      socket.to(pData.roomId).volatile.emit('player_moved', {
        id: socket.id, x: data.x, y: data.y, z: data.z,
        rotY: data.rotY, rotX: data.rotX, weapon: data.weapon,
        health: data.health, alive: data.alive
      });
    });

    // Player fired a shot
    socket.on('player_shoot', (data) => {
      const pData = players.get(socket.id);
      if (!pData || !pData.roomId) return;
      socket.to(pData.roomId).emit('player_shot', {
        id: socket.id,
        origin: data.origin,
        direction: data.direction,
        weapon: data.weapon,
        damage: data.damage
      });
    });

    // Enemy damaged (server-authoritative)
    socket.on('enemy_hit', (data) => {
      const pData = players.get(socket.id);
      if (!pData || !pData.roomId) return;
      const room = rooms.get(pData.roomId);
      if (!room) return;

      const enemy = room.enemies.find(e => e.id === data.enemyId);
      if (enemy && enemy.health > 0) {
        enemy.health -= data.damage;
        if (enemy.health <= 0) {
          const player = room.players.get(socket.id);
          if (player) {
            player.kills++;
            player.score += enemy.isBoss ? 500 : 100;
          }
          io.to(pData.roomId).emit('enemy_killed', { enemyId: data.enemyId, killerId: socket.id });

          // Check if all enemies dead
          const allDead = room.enemies.every(e => e.health <= 0) && room.vehicles.every(v => v.health <= 0);
          if (allDead) {
            room.state = 'finished';
            io.to(pData.roomId).emit('level_complete', {
              players: Object.fromEntries(room.players)
            });
          }
        } else {
          io.to(pData.roomId).emit('enemy_damaged', { enemyId: data.enemyId, health: enemy.health });
        }
      }
    });

    // Vehicle damaged
    socket.on('vehicle_hit', (data) => {
      const pData = players.get(socket.id);
      if (!pData || !pData.roomId) return;
      const room = rooms.get(pData.roomId);
      if (!room) return;

      const veh = room.vehicles.find(v => v.id === data.vehicleId);
      if (veh && veh.health > 0) {
        veh.health -= data.damage;
        if (veh.health <= 0) {
          const player = room.players.get(socket.id);
          if (player) { player.kills++; player.score += veh.type === 'tank' ? 800 : 400; }
          io.to(pData.roomId).emit('vehicle_killed', { vehicleId: data.vehicleId, killerId: socket.id });
        } else {
          io.to(pData.roomId).emit('vehicle_damaged', { vehicleId: data.vehicleId, health: veh.health });
        }
      }
    });

    // Player took damage from enemy
    socket.on('player_damaged', (data) => {
      const pData = players.get(socket.id);
      if (!pData || !pData.roomId) return;
      const room = rooms.get(pData.roomId);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (player) {
        player.health = data.health;
        if (data.health <= 0) {
          player.alive = false;
          player.deaths++;
          io.to(pData.roomId).emit('player_died', { id: socket.id });
        }
      }
    });

    // Chat message
    socket.on('chat_msg', (msg) => {
      const pData = players.get(socket.id);
      if (!pData || !pData.roomId) return;
      const room = rooms.get(pData.roomId);
      if (!room) return;
      const player = room.players.get(socket.id);
      const name = player ? player.name : 'Unknown';
      io.to(pData.roomId).emit('chat_msg', { sender: name, text: msg.slice(0, 200) });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const pData = players.get(socket.id);
      if (pData && pData.roomId) {
        const room = rooms.get(pData.roomId);
        if (room) {
          room.removePlayer(socket.id);
          io.to(pData.roomId).emit('player_left', { id: socket.id });
          if (room.players.size === 0) {
            rooms.delete(pData.roomId);
            console.log(`Room ${pData.roomId} deleted (empty)`);
          }
        }
      }
      players.delete(socket.id);
      console.log(`Player disconnected: ${socket.id}`);
    });
  });

  // ===== SERVER TICK (enemy AI broadcast) =====
  setInterval(() => {
    rooms.forEach((room, roomId) => {
      if (room.state !== 'playing') return;

      // Simple server-side enemy AI: pick nearest player as target
      const playerArr = Array.from(room.players.values()).filter(p => p.alive);
      if (playerArr.length === 0) return;

      room.enemies.forEach(e => {
        if (e.health <= 0) return;
        // Find nearest alive player
        let nearest = null, nearDist = Infinity;
        playerArr.forEach(p => {
          const d = Math.sqrt((p.x - e.x) ** 2 + (p.z - e.z) ** 2);
          if (d < nearDist) { nearDist = d; nearest = p; }
        });
        if (nearest) {
          e.targetId = nearest.id;
          const dx = nearest.x - e.x;
          const dz = nearest.z - e.z;
          e.rotY = Math.atan2(dx, dz);

          // Move toward target
          if (nearDist > (e.isRanged ? 8 : 2.5) && nearDist < 30) {
            const ms = e.speed * (1 / TICK_RATE);
            e.x += (dx / nearDist) * ms;
            e.z += (dz / nearDist) * ms;
          }

          // Fire
          e.attackCd -= 1 / TICK_RATE;
          if (e.isRanged && nearDist < e.fireRange && nearDist > 4 && e.attackCd <= 0) {
            e.attackCd = e.fireRate;
            io.to(roomId).emit('enemy_shoot', {
              enemyId: e.id,
              targetId: nearest.id,
              origin: { x: e.x, y: 1.4, z: e.z },
              damage: e.fireDmg
            });
          } else if (!e.isRanged && nearDist < 3 && e.attackCd <= 0) {
            e.attackCd = 1.2;
            io.to(roomId).emit('enemy_melee', {
              enemyId: e.id,
              targetId: nearest.id,
              damage: e.damage
            });
          }
        }
      });

      // Broadcast enemy positions
      io.to(roomId).volatile.emit('enemies_update', room.enemies.filter(e => e.health > 0).map(e => ({
        id: e.id, x: e.x, z: e.z, rotY: e.rotY, health: e.health
      })));
    });
  }, 1000 / TICK_RATE);

  // ===== CLEANUP stale rooms =====
  setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, id) => {
      if (room.players.size === 0 && now - room.createdAt > 60000) {
        rooms.delete(id);
      }
    });
  }, 30000);

  // Next.js handler
  server.all('*', (req, res) => handle(req, res));

  httpServer.listen(PORT, () => {
    console.log(`\n🎮 WW III Multiplayer Server running at http://localhost:${PORT}\n`);
  });
});
