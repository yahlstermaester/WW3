// Ally vehicle creation and shooting.
import { G } from '../state.js';
import { createTracer } from '../combat/tracers.js';

export function createAllyVehicle(x, z, type) {
  const group = new THREE.Group();
  
  if (type === 'tank') {
    // Ally tank — blue-green tint
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 5), new THREE.MeshLambertMaterial({ color: 0x4a6a5a }));
    hull.position.y = 1; group.add(hull);
    [-2, 2].forEach(side => {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 5.2), new THREE.MeshLambertMaterial({ color: 0x2a3a2a }));
      track.position.set(side, 0.5, 0); group.add(track);
      for (let w = -2; w <= 2; w++) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.3,8), new THREE.MeshLambertMaterial({ color: 0x1a2a1a }));
        wheel.rotation.z = Math.PI/2; wheel.position.set(side, 0.4, w); group.add(wheel);
      }
    });
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,0.6,8), new THREE.MeshLambertMaterial({ color: 0x3a5a4a }));
    turretBase.position.y = 1.9; group.add(turretBase);
    const turretTop = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.7,2), new THREE.MeshLambertMaterial({ color: 0x3a5a4a }));
    turretTop.position.y = 2.5; group.add(turretTop);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,3.5,6), new THREE.MeshLambertMaterial({ color: 0x2a3a2a }));
    barrel.rotation.x = Math.PI/2; barrel.position.set(0, 2.5, -2.8); group.add(barrel);
  } else {
    // Ally jeep — blue-green tint
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.6,4), new THREE.MeshLambertMaterial({ color: 0x5a7a6a }));
    chassis.position.y = 0.8; group.add(chassis);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2,0.3,1.5), new THREE.MeshLambertMaterial({ color: 0x4a6a5a }));
    hood.position.set(0, 1.15, -1); group.add(hood);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2,0.8,1.8), new THREE.MeshLambertMaterial({ color: 0x4a6a5a }));
    cabin.position.set(0, 1.5, 0.5); group.add(cabin);
    [[-0.9,-1.3],[0.9,-1.3],[-0.9,1.3],[0.9,1.3]].forEach(([wx,wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.3,8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      wheel.rotation.z = Math.PI/2; wheel.position.set(wx, 0.4, wz); group.add(wheel);
    });
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,1.5,6), new THREE.MeshLambertMaterial({ color: 0x2a3a2a }));
    gun.rotation.x = Math.PI/2; gun.position.set(0, 2.2, -0.6); group.add(gun);
  }
  
  // YOUR TEAM floating label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256; labelCanvas.height = 64;
  const ctx = labelCanvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 240, 48); ctx.fill();
  ctx.fillStyle = '#44ddaa'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('YOUR TEAM', 128, 42);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthTest: false, side: THREE.DoubleSide }));
  label.position.y = type === 'tank' ? 4.5 : 3.5;
  group.add(label);
  
  // Blue-green glow ring on ground
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.8, 16), new THREE.MeshBasicMaterial({ color: 0x44ddaa, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.05;
  group.add(ring);
  
  group.position.set(x, 0, z);
  group.userData.levelObj = true;
  G.scene.add(group);
  
  const ally = {
    mesh: group, type, x, z,
    health: type === 'tank' ? 250 : 100,
    maxHealth: type === 'tank' ? 250 : 100,
    speed: type === 'tank' ? 3.5 : 7,
    damage: type === 'tank' ? 25 : 12,
    fireRate: type === 'tank' ? 2 : 1,
    fireCd: 0,
    range: type === 'tank' ? 50 : 35,
    targetEnemy: null,
    patrolAngle: Math.random() * Math.PI * 2
  };
  G.allies.push(ally);
  return ally;
}

export function allyShoot(ally, target) {
  const tx = target.mesh.position.x, tz = target.mesh.position.z;
  const ax = ally.mesh.position.x, az = ally.mesh.position.z;
  const dx = tx - ax, dz = tz - az;
  const dist = Math.sqrt(dx*dx + dz*dz);
  if (dist < 1) return;
  
  const spread = 0.05;
  const dir = new THREE.Vector3(dx/dist + (Math.random()-0.5)*spread, 0.02, dz/dist + (Math.random()-0.5)*spread).normalize();
  
  // Muzzle flash
  const fy = ally.type === 'tank' ? 2.5 : 2.2;
  const flash = new THREE.Mesh(new THREE.SphereGeometry(ally.type === 'tank' ? 0.3 : 0.12, 4, 4), new THREE.MeshBasicMaterial({ color: 0x44ddaa }));
  flash.position.set(ax + dx/dist*2, fy, az + dz/dist*2);
  flash.userData.levelObj = true; G.scene.add(flash);
  setTimeout(() => G.scene.remove(flash), 60);
  
  // Tracer (green-blue for ally)
  const origin = new THREE.Vector3(ax, fy, az);
  createTracer(origin.clone(), dir.clone(), 0x44ddaa);
  
  // Bullet
  const bulletMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), new THREE.MeshBasicMaterial({ color: 0x44ddaa }));
  bulletMesh.position.copy(origin);
  bulletMesh.userData.levelObj = true; G.scene.add(bulletMesh);
  
  G.projectiles.push({ mesh: bulletMesh, dir, speed: 40, damage: ally.damage, life: 2.5, fromAlly: true });
}
