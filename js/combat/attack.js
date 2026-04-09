// Player attack functions — melee, ranged projectiles.
import { G } from '../state.js';
import { WEAPON_DATA } from '../data/weapons.js';
import { createTracer } from './tracers.js';
import { damageEnemy } from './damage.js';
import { damageVehicle } from '../entities/vehicles.js';
import { updateHUD } from '../ui/hud.js';

export function attack() {
  if (G.attackCooldown > 0 || !G.alive) return;
  const wp = WEAPON_DATA[G.weapons[G.currentWeapon]];
  G.attackCooldown = wp.speed;
  
  if (wp.type === 'ranged') {
    const ammoKey = wp.ammoKey;
    if ((G.ammo[ammoKey] || 0) <= 0) return;
    G.ammo[ammoKey]--;
    fireProjectile(wp);
  } else {
    meleeAttack(wp);
  }
  updateHUD();
}

export function meleeAttack(wp) {
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyQuaternion(G.camera.quaternion);
  
  G.enemies.forEach(e => {
    if (e.health <= 0) return;
    const dx = e.mesh.position.x - G.camera.position.x;
    const dz = e.mesh.position.z - G.camera.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > wp.range) return;
    const toEnemy = new THREE.Vector3(dx, 0, dz).normalize();
    const dot = dir.x * toEnemy.x + dir.z * toEnemy.z;
    if (dot > 0.5) damageEnemy(e, wp.dmg + G.skills.strength * 2);
  });
  
  // Also hit vehicles in melee range
  G.vehicles.forEach(v => {
    if (v.health <= 0) return;
    const dx = v.mesh.position.x - G.camera.position.x;
    const dz = v.mesh.position.z - G.camera.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > wp.range + 1) return;
    const toV = new THREE.Vector3(dx, 0, dz).normalize();
    const dot = dir.x * toV.x + dir.z * toV.z;
    if (dot > 0.4) damageVehicle(v, (wp.dmg + G.skills.strength * 2) * 0.5); // melee does half damage to vehicles
  });
}

export function fireProjectile(wp) {
  const dir = new THREE.Vector3(0, 0, -1);
  dir.applyQuaternion(G.camera.quaternion);
  
  // Muzzle flash (screen-space flash effect)
  const flash = document.getElementById('damageFlash');
  flash.style.background = 'rgba(255,200,80,0.15)';
  flash.style.opacity = '1';
  setTimeout(() => { flash.style.opacity = '0'; flash.style.background = 'rgba(180,40,40,0.3)'; }, 50);
  
  // 3D muzzle flash in world
  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 4, 4),
    new THREE.MeshBasicMaterial({ color: 0xffcc44 })
  );
  const muzzlePos = G.camera.position.clone().add(dir.clone().multiplyScalar(1.5));
  muzzle.position.copy(muzzlePos);
  muzzle.userData.levelObj = true;
  G.scene.add(muzzle);
  setTimeout(() => G.scene.remove(muzzle), 40);
  
  // Bullet projectile
  const bulletColor = wp === WEAPON_DATA.shotgun ? 0xff6633 : wp === WEAPON_DATA.sniper ? 0x44aaff : 0xffcc44;
  const bulletSize = wp === WEAPON_DATA.sniper ? 0.08 : wp === WEAPON_DATA.shotgun ? 0.07 : 0.05;
  const bulletSpeed = wp === WEAPON_DATA.sniper ? 80 : wp === WEAPON_DATA.shotgun ? 50 : 55;
  
  const geo = new THREE.SphereGeometry(bulletSize, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color: bulletColor });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(muzzlePos);
  mesh.userData.levelObj = true;
  G.scene.add(mesh);
  
  // Create tracer line from barrel
  createTracer(muzzlePos.clone(), dir.clone(), bulletColor);
  
  const dmg = wp.dmg + G.skills.strength * 2;
  
  // Shotgun fires spread pellets
  if (wp === WEAPON_DATA.shotgun) {
    for (let i = 0; i < 4; i++) {
      const spread = new THREE.Vector3(
        dir.x + (Math.random()-0.5)*0.15,
        dir.y + (Math.random()-0.5)*0.1,
        dir.z + (Math.random()-0.5)*0.15
      ).normalize();
      const pellet = new THREE.Mesh(new THREE.SphereGeometry(0.04, 3, 3), new THREE.MeshBasicMaterial({ color: 0xff8844 }));
      pellet.position.copy(muzzlePos);
      pellet.userData.levelObj = true;
      G.scene.add(pellet);
      G.projectiles.push({ mesh: pellet, dir: spread, speed: 45, damage: dmg * 0.4, life: 1 });
    }
  }
  
  G.projectiles.push({ mesh, dir: dir.clone(), speed: bulletSpeed, damage: dmg, life: 2.5 });
}
