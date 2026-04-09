// Weapon definitions — pure data.
export const WEAPON_DATA = {
  combat_knife:  { dmg: 12, range: 3,  speed: 0.25, type: 'melee',  icon: '🔪', ammoKey: null },
  bowie_knife:   { dmg: 18, range: 3.5,speed: 0.35, type: 'melee',  icon: '🗡️', ammoKey: null },
  machete:       { dmg: 24, range: 4,  speed: 0.45, type: 'melee',  icon: '⚔️', ammoKey: null },
  katana:        { dmg: 32, range: 4.5,speed: 0.5,  type: 'melee',  icon: '⛩️', ammoKey: null },
  pistol:        { dmg: 15, range: 50, speed: 0.35, type: 'ranged', icon: '🔫', ammoKey: 'pistol' },
  shotgun:       { dmg: 35, range: 15, speed: 0.7,  type: 'ranged', icon: '💥', ammoKey: 'shells' },
  smg:           { dmg: 10, range: 40, speed: 0.12, type: 'ranged', icon: '🔰', ammoKey: 'smg' },
  rifle:         { dmg: 28, range: 70, speed: 0.5,  type: 'ranged', icon: '🎯', ammoKey: 'rifle' },
  sniper:        { dmg: 55, range: 100,speed: 1.2,  type: 'ranged', icon: '🔭', ammoKey: 'sniper' },
};
