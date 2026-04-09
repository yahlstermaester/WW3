import { io } from 'socket.io-client';

let socket = null;
const callbacks = {};

export function connect() {
  if (socket && socket.connected) return socket;
  socket = io(window.location.origin, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
    if (callbacks.onConnect) callbacks.onConnect(socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    if (callbacks.onDisconnect) callbacks.onDisconnect();
  });

  socket.on('room_list', (rooms) => { if (callbacks.onRoomList) callbacks.onRoomList(rooms); });
  socket.on('room_joined', (data) => { if (callbacks.onRoomJoined) callbacks.onRoomJoined(data); });
  socket.on('player_joined', (p) => { if (callbacks.onPlayerJoined) callbacks.onPlayerJoined(p); });
  socket.on('player_left', (p) => { if (callbacks.onPlayerLeft) callbacks.onPlayerLeft(p); });
  socket.on('game_started', (state) => { if (callbacks.onGameStarted) callbacks.onGameStarted(state); });
  socket.on('player_moved', (data) => { if (callbacks.onPlayerMoved) callbacks.onPlayerMoved(data); });
  socket.on('player_shot', (data) => { if (callbacks.onPlayerShot) callbacks.onPlayerShot(data); });
  socket.on('player_died', (data) => { if (callbacks.onPlayerDied) callbacks.onPlayerDied(data); });
  socket.on('enemy_killed', (data) => { if (callbacks.onEnemyKilled) callbacks.onEnemyKilled(data); });
  socket.on('enemy_damaged', (data) => { if (callbacks.onEnemyDamaged) callbacks.onEnemyDamaged(data); });
  socket.on('enemy_shoot', (data) => { if (callbacks.onEnemyShoot) callbacks.onEnemyShoot(data); });
  socket.on('enemy_melee', (data) => { if (callbacks.onEnemyMelee) callbacks.onEnemyMelee(data); });
  socket.on('enemies_update', (data) => { if (callbacks.onEnemiesUpdate) callbacks.onEnemiesUpdate(data); });
  socket.on('vehicle_killed', (data) => { if (callbacks.onVehicleKilled) callbacks.onVehicleKilled(data); });
  socket.on('vehicle_damaged', (data) => { if (callbacks.onVehicleDamaged) callbacks.onVehicleDamaged(data); });
  socket.on('level_complete', (data) => { if (callbacks.onLevelComplete) callbacks.onLevelComplete(data); });
  socket.on('chat_msg', (data) => { if (callbacks.onChat) callbacks.onChat(data); });
  socket.on('error_msg', (msg) => { if (callbacks.onError) callbacks.onError(msg); });

  return socket;
}

export function on(event, callback) { callbacks[event] = callback; }
export function emit(event, data) { if (socket) socket.emit(event, data); }
export function getSocket() { return socket; }
export function getMyId() { return socket ? socket.id : null; }

// Convenience methods
export function listRooms() { emit('list_rooms'); }
export function createRoom(name, level, difficulty, player) {
  emit('create_room', { name, level, difficulty, player });
}
export function joinRoom(roomId, player) { emit('join_room', { roomId, player }); }
export function startGame() { emit('start_game'); }

export function sendPosition(x, y, z, rotY, rotX, weapon, health, alive) {
  emit('player_update', { x, y, z, rotY, rotX, weapon, health, alive });
}
export function sendShoot(origin, direction, weapon, damage) {
  emit('player_shoot', { origin, direction, weapon, damage });
}
export function sendEnemyHit(enemyId, damage) { emit('enemy_hit', { enemyId, damage }); }
export function sendVehicleHit(vehicleId, damage) { emit('vehicle_hit', { vehicleId, damage }); }
export function sendPlayerDamaged(health) { emit('player_damaged', { health }); }
export function sendChat(text) { emit('chat_msg', text); }
