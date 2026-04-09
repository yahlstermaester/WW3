// Item/lore spawning, pickup checks, popup display.
import { G } from '../state.js';
import { LORE_ENTRIES } from '../data/levels.js';
import { updateHUD } from '../ui/hud.js';

export function spawnItem(x, z, type) {
  const colors = { food: 0x5cc46c, water: 0x5ca0c4, scrap: 0xd4a054, medkit: 0xff4444, bullets: 0xc4956a, ammo: 0xc4956a };
  let geo, mat, mesh;
  if (type === 'medkit') {
    // Red cross box
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.35), new THREE.MeshLambertMaterial({ color: 0x999999 }));
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), new THREE.MeshLambertMaterial({ color: 0xff2222 }));
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), new THREE.MeshLambertMaterial({ color: 0xff2222 }));
    cross1.position.z = 0.18; cross2.position.z = 0.18;
    group.add(box); group.add(cross1); group.add(cross2);
    group.position.set(x, 0.5, z);
    group.userData.levelObj = true;
    G.scene.add(group);
    mesh = group;
  } else if (type === 'bullets') {
    // Ammo crate
    const group = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), new THREE.MeshLambertMaterial({ color: 0x4a5a3a }));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.04, 0.37), new THREE.MeshLambertMaterial({ color: 0x3a4a2a }));
    lid.position.y = 0.17;
    group.add(crate); group.add(lid);
    group.position.set(x, 0.5, z);
    group.userData.levelObj = true;
    G.scene.add(group);
    mesh = group;
  } else {
    geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    mat = new THREE.MeshLambertMaterial({ color: colors[type] || 0xd4a054 });
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.5, z);
    mesh.userData.levelObj = true;
    G.scene.add(mesh);
  }
  G.items.push({ mesh, x, z, type, collected: false });
}

export function spawnLore(x, z, index) {
  const geo = new THREE.OctahedronGeometry(0.3, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xd4a054, emissive: 0x5a3a10 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 1, z);
  mesh.userData.levelObj = true;
  G.scene.add(mesh);
  G.loreItems.push({ mesh, x, z, index, collected: false });
}

export function checkItems() {
  G.items.forEach(item => {
    if (item.collected) return;
    const dx = item.mesh.position.x - G.camera.position.x;
    const dz = item.mesh.position.z - G.camera.position.z;
    if (dx*dx + dz*dz < 4) {
      item.collected = true;
      G.scene.remove(item.mesh);
      switch(item.type) {
        case 'food': G.health = Math.min(G.maxHealth, G.health + 15); break;
        case 'water': G.stamina = Math.min(100, G.stamina + 30); break;
        case 'scrap': G.scrap += 15; break;
        case 'medkit': G.health = Math.min(G.maxHealth, G.health + 40); break;
        case 'bullets':
          // Give ammo for all owned guns
          if (G.weapons.includes('pistol')) G.ammo.pistol += 12;
          if (G.weapons.includes('shotgun')) G.ammo.shells += 6;
          if (G.weapons.includes('smg')) G.ammo.smg += 30;
          if (G.weapons.includes('rifle')) G.ammo.rifle += 10;
          if (G.weapons.includes('sniper')) G.ammo.sniper += 5;
          break;
        case 'ammo':
          if (G.weapons.includes('pistol')) G.ammo.pistol += 8;
          if (G.weapons.includes('shotgun')) G.ammo.shells += 4;
          if (G.weapons.includes('smg')) G.ammo.smg += 20;
          if (G.weapons.includes('rifle')) G.ammo.rifle += 6;
          if (G.weapons.includes('sniper')) G.ammo.sniper += 3;
          break;
      }
      const pickupNames = { food: '+15 Health (Food)', water: '+30 Stamina', scrap: '+15 Scrap', medkit: '+40 Health (Med Kit)', bullets: 'Ammo Resupply!' };
      showLorePopup('PICKED UP', pickupNames[item.type] || item.type);
      updateHUD();
    }
  });
  
  G.loreItems.forEach(item => {
    if (item.collected) return;
    const dx = item.mesh.position.x - G.camera.position.x;
    const dz = item.mesh.position.z - G.camera.position.z;
    if (dx*dx + dz*dz < 4) {
      item.collected = true;
      G.scene.remove(item.mesh);
      if (!G.collectedLore.includes(item.index)) {
        G.collectedLore.push(item.index);
        try{localStorage.setItem('ww3_lore', JSON.stringify(G.collectedLore));}catch(e){}
      }
      G.score += 200;
      const lore = LORE_ENTRIES[item.index];
      showLorePopup(lore.title, lore.text);
      updateHUD();
    }
  });
}

export function showLorePopup(title, text) {
  document.getElementById('lorePopTitle').textContent = title;
  document.getElementById('lorePopText').textContent = text;
  document.getElementById('lorePopup').classList.add('active');
  setTimeout(() => document.getElementById('lorePopup').classList.remove('active'), 4000);
}
