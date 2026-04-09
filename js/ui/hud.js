// HUD, minimap, weapon switching.
import { G } from '../state.js';
import { LEVELS } from '../data/levels.js';
import { WEAPON_DATA } from '../data/weapons.js';

export function updateHUD() {
  document.getElementById('healthBar').style.width = (G.health / G.maxHealth * 100) + '%';
  document.getElementById('staminaBar').style.width = G.stamina + '%';
  document.getElementById('scoreDisplay').textContent = G.score;
  document.getElementById('scrapDisplay').textContent = G.scrap;
  document.getElementById('xpDisplay').textContent = G.xp;
  
  const wp = WEAPON_DATA[G.weapons[G.currentWeapon]];
  if (wp.type === 'ranged') {
    document.getElementById('ammoCount').textContent = G.ammo[wp.ammoKey] || 0;
    document.getElementById('ammoLabel').textContent = G.weapons[G.currentWeapon].toUpperCase().replace('_',' ');
  } else {
    document.getElementById('ammoCount').textContent = '∞';
    document.getElementById('ammoLabel').textContent = G.weapons[G.currentWeapon].toUpperCase().replace('_',' ');
  }
  
  const lv = LEVELS[G.currentLevel];
  document.getElementById('levelInfo').textContent = `LV${G.currentLevel+1}: ${lv.name} | ${['EASY','NORMAL','HARD'][G.difficulty]}`;
  
  // Inventory bar
  const invBar = document.getElementById('inventoryBar');
  invBar.innerHTML = G.weapons.map((w, i) => {
    const wd = WEAPON_DATA[w];
    return `<div class="inv-slot${i === G.currentWeapon ? ' active' : ''}" onclick="switchWeapon(${i})">${wd.icon}</div>`;
  }).join('');
  
  updateMinimap();
}

export function updateMinimap() {
  const mm = document.getElementById('minimap');
  mm.innerHTML = '';
  const scale = 0.6;
  const cx = G.camera.position.x;
  const cz = G.camera.position.z;
  
  // Player dot
  const pd = document.createElement('div');
  pd.className = 'minimap-dot player';
  pd.style.left = '48px'; pd.style.top = '48px';
  mm.appendChild(pd);
  
  G.enemies.forEach(e => {
    if (e.health <= 0) return;
    const dx = (e.mesh.position.x - cx) * scale + 50;
    const dz = (e.mesh.position.z - cz) * scale + 50;
    if (dx < 0 || dx > 100 || dz < 0 || dz > 100) return;
    const ed = document.createElement('div');
    ed.className = 'minimap-dot enemy';
    ed.style.left = dx + 'px'; ed.style.top = dz + 'px';
    mm.appendChild(ed);
  });
  
  G.items.concat(G.loreItems).forEach(item => {
    if (item.collected) return;
    const dx = (item.mesh.position.x - cx) * scale + 50;
    const dz = (item.mesh.position.z - cz) * scale + 50;
    if (dx < 0 || dx > 100 || dz < 0 || dz > 100) return;
    const id = document.createElement('div');
    id.className = 'minimap-dot item';
    id.style.left = dx + 'px'; id.style.top = dz + 'px';
    mm.appendChild(id);
  });
  
  G.vehicles.forEach(v => {
    if (v.health <= 0) return;
    const dx = (v.mesh.position.x - cx) * scale + 50;
    const dz = (v.mesh.position.z - cz) * scale + 50;
    if (dx < 0 || dx > 100 || dz < 0 || dz > 100) return;
    const vd = document.createElement('div');
    vd.className = 'minimap-dot enemy';
    vd.style.left = dx + 'px'; vd.style.top = dz + 'px';
    vd.style.width = '6px'; vd.style.height = '6px';
    mm.appendChild(vd);
  });
  
  G.allies.forEach(a => {
    if (a.health <= 0) return;
    const dx = (a.mesh.position.x - cx) * scale + 50;
    const dz = (a.mesh.position.z - cz) * scale + 50;
    if (dx < 0 || dx > 100 || dz < 0 || dz > 100) return;
    const ad = document.createElement('div');
    ad.className = 'minimap-dot player';
    ad.style.left = dx + 'px'; ad.style.top = dz + 'px';
    ad.style.width = '6px'; ad.style.height = '6px';
    ad.style.background = '#44ddaa';
    mm.appendChild(ad);
  });
}

export function switchWeapon(idx) { G.currentWeapon = idx; updateHUD(); }
