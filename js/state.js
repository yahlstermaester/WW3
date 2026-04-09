// Game state — single source of truth. Mutated by every other module.
export const G = {
  score: 0, scrap: 0, xp: 0, health: 100, maxHealth: 100, stamina: 100,
  ammo: { pistol: 24, shells: 0, smg: 0, rifle: 0, sniper: 0 },
  currentWeapon: 0, weapons: ['combat_knife', 'pistol'],
  difficulty: 1, currentLevel: 0, selectedLevel: 0,
  enemies: [], vehicles: [], allies: [], items: [], loreItems: [], projectiles: [],
  collectedLore: (function(){try{return JSON.parse(localStorage.getItem('ww3_lore')||'[]')}catch(e){return []}})(),
  leaderboard: (function(){try{return JSON.parse(localStorage.getItem('ww3_lb')||'[]')}catch(e){return []}})(),
  unlockedLevel: (function(){try{return parseInt(localStorage.getItem('ww3_unlocked')||'1')}catch(e){return 1}})(),
  paused: false, alive: true, inGame: false,
  playerChar: { skin: '#c4956a', armor: '#5a6b52', name: 'Survivor' },
  skills: { strength: 0, speed: 0, defense: 0 },
  moveDir: { x: 0, z: 0 }, lookDir: { x: 0, y: 0 },
  keys: {}, isTouch: false, isBoss: false,
  attackCooldown: 0, dodgeCooldown: 0, blocking: false,
  driving: null, // reference to vehicle being driven
  killStreak: 0,
  // Timing fields used by enemy alert + level-complete failsafe (clock-based seconds)
  lastAttackTime: -100, lastKillTime: 0, levelStartTime: 0,
  // Initial enemy count for the stuck-level failsafe ("kill almost all but 1 wedged enemy")
  initialEnemyCount: 0,
  // Guard to prevent touch listeners from being bound more than once
  touchBound: false
};

// Three.js objects live on G (were top-level vars in the original single-file version)
G.scene = null;
G.camera = null;
G.renderer = null;
G.clock = null;
G.playerBody = null;
G.ground = null;
