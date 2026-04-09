// Player movement, collision, LOS, and dodge.
import { G } from '../state.js';

export function clampPosition() {
  G.camera.position.x = Math.max(-148, Math.min(148, G.camera.position.x));
  G.camera.position.z = Math.max(-148, Math.min(148, G.camera.position.z));
}

export function checkWallCollision(newX, newZ) {
  let blocked = false;
  G.scene.traverse(obj => {
    if (!obj.userData.isWall || !obj.userData.box) return;
    const b = obj.userData.box;
    const margin = 0.35;
    if (newX > b.min.x - margin && newX < b.max.x + margin && 
        newZ > b.min.z - margin && newZ < b.max.z + margin) {
      blocked = true;
    }
  });
  return blocked;
}

export function hasLineOfSight(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const dist = Math.sqrt(dx*dx + dz*dz);
  const steps = Math.ceil(dist / 1.5); // check every 1.5 units
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = ax + dx * t;
    const cz = az + dz * t;
    if (checkWallCollision(cx, cz)) return false;
  }
  return true;
}

export function dodge() {
  if (G.dodgeCooldown > 0 || G.stamina < 20 || G.driving) return;
  G.dodgeCooldown = 0.8;
  G.stamina -= 20;
  const dir = new THREE.Vector3(G.moveDir.x, 0, G.moveDir.z);
  if (dir.length() === 0) dir.z = -1;
  dir.normalize();
  dir.applyAxisAngle(new THREE.Vector3(0,1,0), G.lookDir.y);
  G.camera.position.x += dir.x * 4;
  G.camera.position.z += dir.z * 4;
  clampPosition();
}
