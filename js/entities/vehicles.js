// Enemy & driveable vehicle systems.
import { G } from '../state.js';
import { createTracer } from '../combat/tracers.js';
import { spawnItem, showLorePopup } from './items.js';
import { checkLevelComplete } from '../ui/flow.js';
import { updateHUD } from '../ui/hud.js';

const PI = Math.PI;

export function createVehicle(x, z, type) {
  // type: 'tank' or 'jeep'
  const group = new THREE.Group();
  const diffMult = [0.7, 1, 1.4][G.difficulty];
  
  if (type === 'tank') {
    // Tank body — large armored hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 5), new THREE.MeshLambertMaterial({ color: 0x4a5540 }));
    hull.position.y = 1;
    group.add(hull);
    // Tank tracks
    [-2, 2].forEach(side => {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 5.2), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
      track.position.set(side, 0.5, 0);
      group.add(track);
      // Track wheels
      for (let w = -2; w <= 2; w++) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
        wheel.rotation.z = Math.PI/2;
        wheel.position.set(side, 0.4, w);
        group.add(wheel);
      }
    });
    // Turret base
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 0.6, 8), new THREE.MeshLambertMaterial({ color: 0x3a4a35 }));
    turretBase.position.y = 1.9;
    group.add(turretBase);
    // Turret top
    const turretTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2), new THREE.MeshLambertMaterial({ color: 0x3a4a35 }));
    turretTop.position.y = 2.5;
    group.add(turretTop);
    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.5, 6), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
    barrel.rotation.x = Math.PI/2;
    barrel.position.set(0, 2.5, -2.8);
    group.add(barrel);
    // Hatches
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x2a3a25 }));
    hatch.position.set(0, 2.95, 0.3);
    group.add(hatch);
  } else {
    // Jeep body
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 4), new THREE.MeshLambertMaterial({ color: 0x5a6450 }));
    chassis.position.y = 0.8;
    group.add(chassis);
    // Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 1.5), new THREE.MeshLambertMaterial({ color: 0x4a5a40 }));
    hood.position.set(0, 1.15, -1);
    group.add(hood);
    // Cabin frame
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1.8), new THREE.MeshLambertMaterial({ color: 0x4a5a40 }));
    cabin.position.set(0, 1.5, 0.5);
    group.add(cabin);
    // Windshield
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), new THREE.MeshLambertMaterial({ color: 0x5588aa, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
    windshield.position.set(0, 1.6, -0.35);
    windshield.rotation.x = -0.2;
    group.add(windshield);
    // Wheels
    [[-0.9,-1.3],[0.9,-1.3],[-0.9,1.3],[0.9,1.3]].forEach(([wx,wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      wheel.rotation.z = Math.PI/2;
      wheel.position.set(wx, 0.4, wz);
      group.add(wheel);
    });
    // Mounted gun on top
    const gunMount = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 6), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
    gunMount.position.set(0, 2.1, 0.3);
    group.add(gunMount);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 6), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
    gun.rotation.x = Math.PI/2;
    gun.position.set(0, 2.2, -0.6);
    group.add(gun);
  }
  
  group.position.set(x, 0, z);
  group.userData.levelObj = true;
  group.userData.isVehicle = true;
  G.scene.add(group);
  
  const veh = {
    mesh: group, type, x, z,
    health: (type === 'tank' ? 200 : 80) * diffMult,
    maxHealth: (type === 'tank' ? 200 : 80) * diffMult,
    speed: (type === 'tank' ? 4 : 8) * diffMult,
    damage: (type === 'tank' ? 30 : 15) * diffMult,
    fireRate: type === 'tank' ? 2.5 : 1.2,
    fireCd: Math.random() * 2,
    range: type === 'tank' ? 60 : 40,
    state: 'patrol',
    stateTimer: Math.random() * 3,
    patrolAngle: Math.random() * Math.PI * 2,
    hitRadius: type === 'tank' ? 3 : 2
  };
  G.vehicles.push(veh);
  return veh;
}

export function damageVehicle(v, dmg) {
  v.health -= dmg;
  v.mesh.children.forEach(c => { if(c.material) c.material.emissive = new THREE.Color(0x5a1a1a); });
  setTimeout(() => { v.mesh.children.forEach(c => { if(c.material) c.material.emissive = new THREE.Color(0); }); }, 100);
  if (v.health <= 0) killVehicle(v);
}

export function killVehicle(v) {
  // Explosion effect — replace with burning wreck
  v.mesh.children.forEach(c => { if(c.material) c.material.color.set(0x1a1a1a); });
  // Smoke particles
  for (let i = 0; i < 5; i++) {
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + Math.random(), 4, 4),
      new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.6 })
    );
    smoke.position.set(
      v.mesh.position.x + (Math.random()-0.5)*2,
      2 + Math.random()*2,
      v.mesh.position.z + (Math.random()-0.5)*2
    );
    smoke.userData.levelObj = true;
    G.scene.add(smoke);
  }
  
  G.score += v.type === 'tank' ? 800 : 400;
  G.scrap += v.type === 'tank' ? 50 : 25;
  G.xp += v.type === 'tank' ? 80 : 40;
  
  // Drop good loot
  spawnItem(v.mesh.position.x, v.mesh.position.z, 'bullets');
  if (Math.random() > 0.3) spawnItem(v.mesh.position.x + 1, v.mesh.position.z, 'medkit');

  if (G.clock) G.lastKillTime = G.clock.getElapsedTime();
  checkLevelComplete();
  updateHUD();
}

export function vehicleShoot(v) {
  const dx = G.camera.position.x - v.mesh.position.x;
  const dz = G.camera.position.z - v.mesh.position.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  if (dist < 1) return;
  
  const spread = v.type === 'tank' ? 0.02 : 0.06;
  const dir = new THREE.Vector3(
    dx/dist + (Math.random()-0.5)*spread,
    0.05,
    dz/dist + (Math.random()-0.5)*spread
  ).normalize();
  
  // Muzzle flash
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(v.type === 'tank' ? 0.4 : 0.15, 4, 4),
    new THREE.MeshBasicMaterial({ color: v.type === 'tank' ? 0xff4400 : 0xffaa00 })
  );
  const fy = v.type === 'tank' ? 2.5 : 2.2;
  flash.position.set(v.mesh.position.x + dx/dist*2, fy, v.mesh.position.z + dz/dist*2);
  flash.userData.levelObj = true;
  G.scene.add(flash);
  setTimeout(() => G.scene.remove(flash), 70);
  
  const bulletColor = v.type === 'tank' ? 0xff6600 : 0xffaa00;
  const geo = new THREE.SphereGeometry(v.type === 'tank' ? 0.2 : 0.08, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color: bulletColor });
  const mesh = new THREE.Mesh(geo, mat);
  const origin = new THREE.Vector3(v.mesh.position.x, fy, v.mesh.position.z);
  mesh.position.copy(origin);
  mesh.userData.levelObj = true;
  G.scene.add(mesh);
  
  createTracer(origin.clone(), dir.clone(), bulletColor);
  
  G.projectiles.push({ mesh, dir, speed: v.type === 'tank' ? 30 : 45, damage: v.damage, life: 3, fromEnemy: true });
}

export function toggleVehicle() {
  if (G.driving) {
    // EXIT vehicle
    G.driving = null;
    showLorePopup('VEHICLE', 'Exited vehicle');
    return;
  }
  // Find nearest driveable vehicle (abandoned enemy vehicles or ally vehicles)
  let best = null, bestDist = 8; // must be within 8 units
  // Check enemy vehicles that are destroyed (wreck = driveable!)
  G.vehicles.forEach(v => {
    if (v.health > 0) return; // can't steal live enemy vehicles
    const dx = v.mesh.position.x - G.camera.position.x;
    const dz = v.mesh.position.z - G.camera.position.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < bestDist) { bestDist = d; best = { mesh: v.mesh, type: v.type, source: 'wreck' }; }
  });
  // Check spawned driveable vehicles
  G.scene.traverse(obj => {
    if (!obj.userData.isDriveable) return;
    const dx = obj.position.x - G.camera.position.x;
    const dz = obj.position.z - G.camera.position.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < bestDist) { bestDist = d; best = { mesh: obj, type: obj.userData.vehType || 'jeep', source: 'spawned' }; }
  });
  // Check ally vehicles
  G.allies.forEach(a => {
    if (a.health <= 0) return;
    const dx = a.mesh.position.x - G.camera.position.x;
    const dz = a.mesh.position.z - G.camera.position.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < bestDist) { bestDist = d; best = { mesh: a.mesh, type: a.type, source: 'ally', ref: a }; }
  });
  if (best) {
    G.driving = best;
    showLorePopup('VEHICLE', 'Driving ' + best.type.toUpperCase() + '! WASD to drive, click to shoot. E to exit.');
  }
}

export function spawnDriveableVehicle(x, z, type) {
  const group = new THREE.Group();
  // Helper to make a part and position it
  function vp(geo, color, px, py, pz) {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:color}));
    m.position.set(px, py, pz);
    return m;
  }
  if (type === 'jeep') {
    group.add(vp(new THREE.BoxGeometry(2.2,0.6,4), 0x5a6a50, 0,0.8,0));
    group.add(vp(new THREE.BoxGeometry(2,0.3,1.5), 0x4a5a40, 0,1.15,-1));
    group.add(vp(new THREE.BoxGeometry(2,0.8,1.8), 0x4a5a40, 0,1.5,0.5));
    [[-0.9,-1.3],[0.9,-1.3],[-0.9,1.3],[0.9,1.3]].forEach(function(ww){
      var w=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.3,8),new THREE.MeshLambertMaterial({color:0x1a1a1a}));
      w.rotation.z=PI/2;w.position.set(ww[0],0.4,ww[1]);group.add(w);});
  } else {
    group.add(vp(new THREE.BoxGeometry(3.5,1.2,5), 0x5a6a50, 0,1,0));
    group.add(vp(new THREE.BoxGeometry(1.6,0.7,2), 0x4a5a40, 0,2.5,0));
    var b=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,3.5,6),new THREE.MeshLambertMaterial({color:0x2a2a2a}));
    b.rotation.x=PI/2;b.position.set(0,2.5,-2.8);group.add(b);
  }
  var lc=document.createElement('canvas');lc.width=256;lc.height=48;var lx=lc.getContext('2d');
  lx.fillStyle='rgba(60,100,60,0.6)';lx.fillRect(0,4,256,40);
  lx.fillStyle='#88ff88';lx.font='bold 24px sans-serif';lx.textAlign='center';lx.fillText('PRESS E TO DRIVE',128,34);
  var label=new THREE.Mesh(new THREE.PlaneGeometry(2.5,0.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(lc),transparent:true,depthTest:false,side:THREE.DoubleSide}));
  label.position.y = type==='tank'?4:3;
  group.add(label);
  group.position.set(x,0,z);
  group.userData.levelObj=true;group.userData.isDriveable=true;group.userData.vehType=type;
  G.scene.add(group);
  return group;
}
