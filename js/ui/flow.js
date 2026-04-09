// Game flow: new game, level start, cutscene launch, level complete, game over, pause, quit.
import { G } from '../state.js';
import { LEVELS, LORE_ENTRIES } from '../data/levels.js';
import { WEAPON_DATA } from '../data/weapons.js';
import { showScreen } from './screens.js';
import { showCutsceneLine } from './cutscene.js';
import { updateHUD } from './hud.js';
import { generateEnvironment } from '../world/environment.js';
import { createEnemy } from '../entities/enemies.js';
import { createVehicle, spawnDriveableVehicle } from '../entities/vehicles.js';
import { createAllyVehicle } from '../entities/allies.js';
import { spawnItem, spawnLore } from '../entities/items.js';
import { showTouchControls, hideTouchControls } from '../input/touch.js';

const PI = Math.PI;

export function startGame() {
  G.playerChar.name = document.getElementById('playerName').value || 'Survivor';
  G.score = 0; G.scrap = 0; G.xp = 0;
  G.health = 100; G.stamina = 100;
  G.weapons = ['combat_knife', 'pistol'];
  G.ammo = { pistol: 24, shells: 0, smg: 0, rifle: 0, sniper: 0 };
  G.currentWeapon = 0;
  G.alive = true;
  G.selectedLevel = 0;
  showScreen('levelScreen');
}

export function startLevel() {
  const lv = LEVELS[G.selectedLevel];
  G.currentLevel = G.selectedLevel;
  // Show cutscene
  G.cutsceneLines = [...lv.story];
  G.cutsceneIdx = 0;
  showScreen('cutsceneScreen');
  showCutsceneLine();
}

export function launchLevel() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('hud').classList.add('active');
  
  const lv = LEVELS[G.currentLevel];
  generateEnvironment(lv.env);
  
  // Reset player
  G.camera.position.set(0, 1.7, 0);
  G.camera.rotation.set(0, 0, 0);
  G.lookDir = { x: 0, y: 0 };
  G.alive = true;
  G.inGame = true;
  G.paused = false;
  G.blocking = false;
  G.attackCooldown = 0;
  G.dodgeCooldown = 0;
  G.jumpOffset = 0;
  G.jumpVelocity = 0;
  
  // Spawn enemies
  const diffMult = [1.5, 2, 3.5][G.difficulty];
  const numEnemies = Math.floor(lv.enemies * diffMult);
  for (let i = 0; i < numEnemies; i++) {
    const angle = (i / numEnemies) * PI * 2;
    const dist = 30 + Math.random() * 60;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    // Mix in special enemy types
    const roll = Math.random();
    if (roll < 0.12) createEnemy(x, z, false, 'sniper');
    else if (roll < 0.22) createEnemy(x, z, false, 'bomber');
    else if (roll < 0.32) createEnemy(x, z, false, 'shield');
    else createEnemy(x, z, false);
  }
  if (lv.boss) {
    createEnemy(0, -35, true);
    G.isBoss = true;
  } else {
    G.isBoss = false;
  }
  
  // Spawn vehicles based on level progression
  const vehCount = Math.min(Math.floor(G.currentLevel / 2), 4);
  for (let i = 0; i < vehCount; i++) {
    const angle = (i / Math.max(vehCount,1)) * PI * 2 + PI/4;
    const dist = 50 + Math.random() * 40;
    const vx = Math.cos(angle) * dist;
    const vz = Math.sin(angle) * dist;
    const vType = (i === 0 && G.currentLevel >= 4) ? 'tank' : 'jeep';
    createVehicle(vx, vz, vType);
  }
  
  // Spawn ally vehicle only on boss levels
  if (lv.boss) {
    const allyType = G.currentLevel >= 4 ? 'tank' : 'jeep';
    createAllyVehicle(2, 5, allyType);
  }
  
  // Spawn driveable vehicles for the player
  if (G.currentLevel >= 2) {
    spawnDriveableVehicle(8, 8, 'jeep');
    if (G.currentLevel >= 6) spawnDriveableVehicle(-10, 12, 'tank');
  }
  
  // Spawn outdoor items
  for (let i = 0; i < 4; i++) {
    const types = ['food', 'water', 'scrap', 'medkit', 'bullets'];
    spawnItem((Math.random()-0.5)*60, (Math.random()-0.5)*60, types[Math.floor(Math.random()*types.length)]);
  }
  
  // Spawn lore (1 per level)
  const loreIdx = G.currentLevel % LORE_ENTRIES.length;
  if (!G.collectedLore.includes(loreIdx)) {
    spawnLore((Math.random()-0.5)*40, (Math.random()-0.5)*40, loreIdx);
  }
  
  updateHUD();
  showTouchControls();

  // Failsafe timestamps for the stuck-level detector and the reliable gunshot-alert check.
  if (G.clock) {
    const now = G.clock.getElapsedTime();
    G.levelStartTime = now;
    G.lastKillTime = now;
    G.lastAttackTime = -100;
  }
  // Record the initial enemy count so the failsafe knows what "almost cleared" means.
  G.initialEnemyCount = G.enemies.filter(e => e.health > 0).length;
  // Pointer lock is NOT requested here. The click-based handler in keyboard-mouse.js
  // acquires it on the player's first left-click, which is the normal FPS pattern and
  // avoids "SecurityError: requestPointerLock() without a user gesture" warnings.
}

export function checkLevelComplete() {
  const aliveEnemies = G.enemies.filter(e => e.health > 0);
  const aliveVehicles = G.vehicles.filter(v => v.health > 0);
  if (aliveEnemies.length === 0 && aliveVehicles.length === 0) {
    setTimeout(() => levelComplete(), 1000);
  }
}

export function levelComplete() {
  G.inGame = false;
  document.getElementById('hud').classList.remove('active');
  hideTouchControls();
  document.exitPointerLock && document.exitPointerLock();
  
  // Unlock next level
  if (G.currentLevel + 2 > G.unlockedLevel) {
    G.unlockedLevel = G.currentLevel + 2;
    try{localStorage.setItem('ww3_unlocked', G.unlockedLevel);}catch(e){}
  }
  
  // Reward weapon unlocks — every level gives something new
  const UNLOCK_TABLE = [
    { weapon: 'bowie_knife', ammo: null, desc: 'Faster, harder-hitting blade' },
    { weapon: 'shotgun', ammo: { shells: 16 }, desc: 'Devastating at close range' },
    { weapon: 'smg', ammo: { smg: 60 }, desc: 'Rapid fire, spray and pray' },
    { weapon: 'machete', ammo: null, desc: 'Wide slash, high damage' },
    { weapon: 'rifle', ammo: { rifle: 24 }, desc: 'Accurate and powerful' },
    { weapon: 'katana', ammo: null, desc: 'The ultimate melee weapon' },
    { weapon: 'sniper', ammo: { sniper: 12 }, desc: 'One shot, one kill at any range' },
  ];
  
  let unlocked = null;
  const unlockIdx = Math.min(G.currentLevel, UNLOCK_TABLE.length - 1);
  // Try to unlock from current level, or find the next one not yet owned
  for (let i = 0; i < UNLOCK_TABLE.length; i++) {
    const u = UNLOCK_TABLE[(unlockIdx + i) % UNLOCK_TABLE.length];
    if (!G.weapons.includes(u.weapon)) {
      G.weapons.push(u.weapon);
      if (u.ammo) Object.keys(u.ammo).forEach(k => G.ammo[k] = (G.ammo[k] || 0) + u.ammo[k]);
      unlocked = u;
      break;
    }
  }
  
  // Also give ammo for all owned ranged weapons every level
  if (G.weapons.includes('pistol')) G.ammo.pistol += 12;
  if (G.weapons.includes('shotgun')) G.ammo.shells += 8;
  if (G.weapons.includes('smg')) G.ammo.smg += 40;
  if (G.weapons.includes('rifle')) G.ammo.rifle += 15;
  if (G.weapons.includes('sniper')) G.ammo.sniper += 6;
  
  // Show weapon unlock on victory screen
  const unlockEl = document.getElementById('weaponUnlock');
  if (unlocked) {
    unlockEl.style.display = 'block';
    document.getElementById('weaponUnlockName').textContent = WEAPON_DATA[unlocked.weapon].icon + ' ' + unlocked.weapon.replace(/_/g, ' ').toUpperCase();
    document.getElementById('weaponUnlockDesc').textContent = unlocked.desc;
  } else {
    unlockEl.style.display = 'none';
  }
  
  // Skill upgrades
  G.skills.strength += 1;
  G.skills.speed += 0.5;
  G.skills.defense += 1;
  
  document.getElementById('vicStats').textContent = `Score: ${G.score} | Scrap: +${G.scrap} | XP: +${G.xp}`;
  document.getElementById('skillUpgrade').innerHTML = `STR ${G.skills.strength} (+1) &nbsp;|&nbsp; SPD ${G.skills.speed.toFixed(1)} (+0.5) &nbsp;|&nbsp; DEF ${G.skills.defense} (+1)`;
  G.selectedLevel = Math.min(G.currentLevel + 1, LEVELS.length - 1);
  showScreen('victoryScreen');
}

export function gameOver() {
  G.inGame = false;
  document.getElementById('hud').classList.remove('active');
  hideTouchControls();
  document.exitPointerLock && document.exitPointerLock();
  
  // Add to leaderboard
  G.leaderboard.push({ name: G.playerChar.name, score: G.score, level: G.currentLevel + 1 });
  G.leaderboard.sort((a,b) => b.score - a.score);
  G.leaderboard = G.leaderboard.slice(0, 20);
  try{localStorage.setItem('ww3_lb', JSON.stringify(G.leaderboard));}catch(e){}
  
  document.getElementById('goScore').textContent = G.score;
  document.getElementById('goStats').textContent = `Reached Level ${G.currentLevel + 1}: ${LEVELS[G.currentLevel].name}\nDifficulty: ${['Easy','Normal','Hard'][G.difficulty]}`;
  showScreen('gameoverScreen');
}

export function togglePause() {
  G.paused = !G.paused;
  document.getElementById('pauseOverlay').classList.toggle('active', G.paused);
}

export function quitToMenu() {
  G.paused = false; G.inGame = false;
  document.getElementById('pauseOverlay').classList.remove('active');
  document.getElementById('hud').classList.remove('active');
  hideTouchControls();
  document.exitPointerLock && document.exitPointerLock();
  showScreen('menuScreen');
}
