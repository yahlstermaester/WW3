// Damage handling — enemies and player.
import { G } from '../state.js';
import { checkWallCollision } from '../player/movement.js';
import { spawnItem, showLorePopup } from '../entities/items.js';
import { updateHUD } from '../ui/hud.js';
import { checkLevelComplete, gameOver } from '../ui/flow.js';

const PI = Math.PI;

export function damageEnemy(e, dmg) {
  if (e.shieldFacing) {
    const dx = G.camera.position.x - e.mesh.position.x;
    const dz = G.camera.position.z - e.mesh.position.z;
    const attackAngle = Math.atan2(dx, dz);
    const facingDiff = Math.abs(attackAngle - e.mesh.rotation.y);
    if (facingDiff < PI * 0.4 || facingDiff > PI * 1.6) {
      dmg *= 0.1;
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.15,4,4), new THREE.MeshBasicMaterial({color:0x8888ff}));
      sp.position.copy(e.mesh.position); sp.position.y = 1.2;
      sp.userData.levelObj = true; G.scene.add(sp);
      setTimeout(() => G.scene.remove(sp), 100);
    }
  }
  e.health -= dmg;
  // Flinch
  e._flinchTimer = 0.3;
  // Stumble backward from hit
  const dx2 = e.mesh.position.x - G.camera.position.x;
  const dz2 = e.mesh.position.z - G.camera.position.z;
  const d2 = Math.sqrt(dx2*dx2+dz2*dz2);
  if (d2 > 0.5) {
    const kb = 0.3;
    const kx = e.mesh.position.x + (dx2/d2)*kb;
    const kz = e.mesh.position.z + (dz2/d2)*kb;
    if (!checkWallCollision(kx, e.mesh.position.z)) e.mesh.position.x = kx;
    if (!checkWallCollision(e.mesh.position.x, kz)) e.mesh.position.z = kz;
  }
  e.mesh.children.forEach(c => { if(c.material) c.material.emissive = new THREE.Color(0x5a1a1a); });
  setTimeout(() => { e.mesh.children.forEach(c => { if(c.material) c.material.emissive = new THREE.Color(0); }); }, 100);
  if (e.health <= 0) killEnemy(e);
}

export function killEnemy(e) {
  // Remove sniper laser if exists
  if (e._laser) { G.scene.remove(e._laser); e._laser = null; }
  
  // Bomber explosion
  if (e.explodeRadius > 0) {
    const boom = new THREE.Mesh(new THREE.SphereGeometry(e.explodeRadius*0.5, 8, 8), new THREE.MeshBasicMaterial({color:0xff6622, transparent:true, opacity:0.7}));
    boom.position.copy(e.mesh.position); boom.position.y = 1;
    boom.userData.levelObj = true; G.scene.add(boom);
    setTimeout(() => { boom.scale.set(2,2,2); boom.material.opacity = 0.3; }, 100);
    setTimeout(() => G.scene.remove(boom), 400);
    // Scorch mark on ground
    const scorch = new THREE.Mesh(new THREE.PlaneGeometry(e.explodeRadius, e.explodeRadius), new THREE.MeshLambertMaterial({color:0x1a1a1a,transparent:true,opacity:0.6,side:THREE.DoubleSide}));
    scorch.rotation.x = -PI/2; scorch.position.set(e.mesh.position.x, 0.05, e.mesh.position.z);
    scorch.userData.levelObj = true; G.scene.add(scorch);
    // Damage in radius
    const edx = G.camera.position.x - e.mesh.position.x;
    const edz = G.camera.position.z - e.mesh.position.z;
    const edist = Math.sqrt(edx*edx + edz*edz);
    if (edist < e.explodeRadius) playerTakeDamage(e.damage * (1 - edist/e.explodeRadius));
    G.enemies.forEach(other => {
      if (other === e || other.health <= 0) return;
      const ox = other.mesh.position.x-e.mesh.position.x, oz = other.mesh.position.z-e.mesh.position.z;
      if (ox*ox+oz*oz < e.explodeRadius*e.explodeRadius) { other.health -= 20; if (other.health<=0) killEnemy(other); }
    });
    G.camera.position.x += (Math.random()-0.5)*0.8;
    G.camera.position.z += (Math.random()-0.5)*0.8;
  }
  
  // === RAGDOLL DEATH — body flies back and stays ===
  const deathPos = e.mesh.position.clone();
  const fromPlayer = new THREE.Vector3(
    e.mesh.position.x - G.camera.position.x, 0,
    e.mesh.position.z - G.camera.position.z
  ).normalize();
  
  // Detach from enemies array tracking but keep mesh
  e.mesh.userData.isEnemy = false;
  
  // Ragdoll: tilt body and launch backward
  const ragSpeed = e.explodeRadius > 0 ? 8 : 3;
  let ragTimer = 0;
  const ragdoll = () => {
    ragTimer += 0.016;
    if (ragTimer > 0.5 || !e.mesh.parent) return; // stop if removed from G.scene
    e.mesh.position.x += fromPlayer.x * ragSpeed * 0.016;
    e.mesh.position.z += fromPlayer.z * ragSpeed * 0.016;
    e.mesh.position.y = Math.max(0, e.mesh.position.y - ragTimer * 3);
    e.mesh.rotation.x += 0.15;
    e.mesh.rotation.z += (Math.random()-0.5)*0.1;
    requestAnimationFrame(ragdoll);
  };
  ragdoll();
  
  // After ragdoll settles, lay flat as permanent body
  setTimeout(() => {
    if (!e.mesh.parent) return; // level was cleared
    e.mesh.position.y = 0;
    e.mesh.rotation.x = PI/2;
    e.mesh.rotation.z = (Math.random()-0.5)*0.3;
    e.mesh.children.forEach(c => { if(c.material) { c.material.color.multiplyScalar(0.5); c.material.emissive = new THREE.Color(0); }});
  }, 600);
  
  // Score
  const pts = e.isBoss ? 2000 : e.specialType ? 200 : 100;
  G.score += pts;
  G.scrap += e.isBoss ? 100 : 10;
  G.xp += e.isBoss ? 150 : 15;
  G.killStreak++;
  
  if (G.killStreak % 5 === 0) {
    showLorePopup('SUPPLY DROP', 'Killstreak x' + G.killStreak + '! Ammo & health incoming!');
    G.health = Math.min(G.maxHealth, G.health + 30);
    Object.keys(G.ammo).forEach(k => G.ammo[k] += 10);
  }
  
  if (Math.random() < 0.4) {
    const types = ['food', 'scrap', 'bullets', 'medkit'];
    spawnItem(deathPos.x, deathPos.z, types[Math.floor(Math.random()*types.length)]);
  }
  checkLevelComplete();
  updateHUD();
}

export function playerTakeDamage(dmg) {
  if (G.blocking) dmg *= 0.3;
  if (G.driving) dmg *= 0.5; // vehicle armor
  dmg -= G.skills.defense;
  dmg = Math.max(1, dmg);
  G.health -= dmg;
  
  // Screen shake on hit
  G.camera.position.x += (Math.random()-0.5)*0.15;
  G.camera.position.z += (Math.random()-0.5)*0.15;
  
  const flash = document.getElementById('damageFlash');
  flash.style.opacity = '1';
  setTimeout(() => flash.style.opacity = '0', 150);
  
  if (G.health <= 0) {
    G.health = 0;
    G.alive = false;
    G.driving = null;
    G.killStreak = 0;
    // Third-person death G.camera — pull G.camera back and look at player position
    const deathPos = G.camera.position.clone();
    const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    let deathTimer = 0;
    const deathAnim = () => {
      deathTimer += 0.016;
      if (deathTimer > 2 || !G.inGame) { gameOver(); return; }
      G.camera.position.x -= lookDir.x * 0.08;
      G.camera.position.z -= lookDir.z * 0.08;
      G.camera.position.y = Math.max(0.5, G.camera.position.y - deathTimer * 0.5);
      G.camera.lookAt(deathPos.x, 0.5, deathPos.z);
      flash.style.background = 'rgba(120,20,20,0.5)';
      flash.style.opacity = String(Math.min(0.8, deathTimer * 0.4));
      if (G.renderer) G.renderer.render(G.scene, G.camera);
      requestAnimationFrame(deathAnim);
    };
    deathAnim();
    return;
  }
  updateHUD();
}
