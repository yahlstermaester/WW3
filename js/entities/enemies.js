// Enemy creation and shooting behavior.
import { G } from '../state.js';
import { createTracer } from '../combat/tracers.js';

export function createEnemy(x, z, isBoss, specialType) {
  isBoss = isBoss || false; specialType = specialType || null;
  // Helper: make a box/shape, position it, add to group
  function part(geo, color, px, py, pz, basic) {
    const mat = basic ? new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.7}) : new THREE.MeshLambertMaterial({color:color});
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    return m;
  }
  const group = new THREE.Group();
  const bc = isBoss?0x8b3a3a:specialType==='sniper'?0x4a5a4a:specialType==='bomber'?0x8a5a2a:specialType==='shield'?0x4a4a6a:0x6b5a42;
  const s = isBoss ? 1.8 : 1;
  // Body
  group.add(part(new THREE.BoxGeometry(0.8*s,1.2*s,0.5*s), bc, 0,1.2*s,0));
  // Head
  group.add(part(new THREE.BoxGeometry(0.5*s,0.5*s,0.5*s), specialType==='bomber'?0xaa6a3a:0xc4956a, 0,2*s,0));
  // Arms
  group.add(part(new THREE.BoxGeometry(0.25*s,0.8*s,0.25*s), bc, -0.55*s,1.2*s,0));
  group.add(part(new THREE.BoxGeometry(0.25*s,0.8*s,0.25*s), bc, 0.55*s,1.2*s,0));
  // Legs
  group.add(part(new THREE.BoxGeometry(0.3*s,0.7*s,0.3*s), 0x3a3530, -0.2*s,0.35*s,0));
  group.add(part(new THREE.BoxGeometry(0.3*s,0.7*s,0.3*s), 0x3a3530, 0.2*s,0.35*s,0));
  // Special type visuals
  if (specialType==='sniper') {
    group.add(part(new THREE.BoxGeometry(0.08,0.08,1.4), 0x2a2a2a, 0.6,1.3,-0.7));
    group.add(part(new THREE.CylinderGeometry(0.04,0.04,0.3,6), 0x1a1a1a, 0.6,1.45,-0.4));
    group.add(part(new THREE.BoxGeometry(0.6,0.3,0.6), 0x4a5a3a, 0,2.4,0));
  } else if (specialType==='bomber') {
    group.add(part(new THREE.BoxGeometry(0.85,0.6,0.3), 0x8a5a2a, 0,1.3,-0.25));
    group.add(part(new THREE.SphereGeometry(0.08,6,6), 0xff0000, 0,1.5,-0.42, true));
    group.add(part(new THREE.BoxGeometry(0.1,0.15,0.1), 0x2a2a2a, 0.55,1,-0.2));
  } else if (specialType==='shield') {
    group.add(part(new THREE.BoxGeometry(1.2,1.6,0.15), 0x5a5a6a, 0,1.2,-0.5));
    group.add(part(new THREE.BoxGeometry(0.8,0.1,0.02), 0x2a2a3a, 0,1.6,-0.58, true));
    group.add(part(new THREE.BoxGeometry(0.08,0.08,0.35), 0x2a2a2a, 0.6,1.1,-0.3));
  } else if (!isBoss) {
    group.add(part(new THREE.BoxGeometry(0.1*s,0.1*s,0.6*s), 0x2a2a2a, 0.6*s,1.2*s,-0.3*s));
  }
  if (isBoss) {
    group.add(part(new THREE.BoxGeometry(0.7*s,0.4*s,0.7*s), 0x4a1a1a, 0,2.4*s,0));
    group.add(part(new THREE.BoxGeometry(0.6*s,0.15*s,0.1), 0xff3333, 0,2.3*s,-0.35*s, true));
    group.add(part(new THREE.BoxGeometry(0.5*s,0.3*s,0.5*s), 0x5a2a1a, -0.7*s,1.9*s,0));
    group.add(part(new THREE.BoxGeometry(0.5*s,0.3*s,0.5*s), 0x5a2a1a, 0.7*s,1.9*s,0));
    group.add(part(new THREE.BoxGeometry(0.85*s,0.6*s,0.15), 0x4a2a1a, 0,1.4*s,-0.3*s));
    group.add(part(new THREE.BoxGeometry(0.15*s,0.15*s,1.2*s), 0x1a1a1a, 0.65*s,1.3*s,-0.6*s));
    // Boss label
    var lc=document.createElement('canvas');lc.width=256;lc.height=64;var lx2=lc.getContext('2d');
    lx2.fillStyle='rgba(140,30,30,0.7)';lx2.fillRect(0,8,256,48);
    lx2.fillStyle='#ff4444';lx2.font='bold 36px sans-serif';lx2.textAlign='center';lx2.fillText('BOSS',128,44);
    var label=new THREE.Mesh(new THREE.PlaneGeometry(2.5,0.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(lc),transparent:true,depthTest:false,side:THREE.DoubleSide}));
    label.position.set(0,3.5*s,0);group.add(label);
  }
  group.position.set(x,0,z);group.userData.levelObj=true;group.userData.isEnemy=true;G.scene.add(group);
  var diffMult=[0.7,1,1.4][G.difficulty];
  var isRanged=specialType==='bomber'?false:(specialType==='sniper'||specialType==='shield'||Math.random()<0.7);
  var enemy={mesh:group,x:x,z:z,specialType:specialType,
    health:(isBoss?600:specialType==='shield'?80:specialType==='bomber'?25:40)*diffMult,
    maxHealth:(isBoss?600:specialType==='shield'?80:specialType==='bomber'?25:40)*diffMult,
    speed:(isBoss?3.5:specialType==='bomber'?6:specialType==='sniper'?1.5:3.5)*diffMult,
    damage:(isBoss?35:specialType==='bomber'?60:10)*diffMult,
    isBoss:isBoss,attackCd:0,state:'idle',stateTimer:Math.random()*3,
    isRanged:isRanged||isBoss,
    fireRange:(isBoss?50:specialType==='sniper'?80:specialType==='shield'?15:22)*diffMult,
    fireRate:isBoss?0.4:specialType==='sniper'?2.5:specialType==='shield'?2:(1.5+Math.random()),
    fireDmg:(isBoss?25:specialType==='sniper'?30:7)*diffMult,
    shieldFacing:specialType==='shield',explodeRadius:specialType==='bomber'?8:0,alerted:false,_flinchTimer:0};
  G.enemies.push(enemy);return enemy;
}
export function enemyShoot(e) {
  const dx = G.camera.position.x - e.mesh.position.x;
  const dz = G.camera.position.z - e.mesh.position.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  if (dist < 1) return;
  
  // Slight inaccuracy so player can dodge
  const spread = e.isBoss ? 0.015 : 0.08;
  const dir = new THREE.Vector3(
    dx/dist + (Math.random()-0.5)*spread,
    (G.camera.position.y - (e.mesh.position.y + 1.5))/dist + (Math.random()-0.5)*spread,
    dz/dist + (Math.random()-0.5)*spread
  ).normalize();
  
  // Muzzle flash on enemy
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 4, 4),
    new THREE.MeshBasicMaterial({ color: 0xffaa33 })
  );
  flash.position.set(e.mesh.position.x + dx/dist*0.8, e.mesh.position.y + 1.4, e.mesh.position.z + dz/dist*0.8);
  flash.userData.levelObj = true;
  G.scene.add(flash);
  setTimeout(() => G.scene.remove(flash), 60);
  
  // Bullet
  const geo = new THREE.SphereGeometry(0.06, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(e.mesh.position.x, e.mesh.position.y + 1.4, e.mesh.position.z);
  mesh.userData.levelObj = true;
  G.scene.add(mesh);
  
  // Tracer trail
  createTracer(mesh.position.clone(), dir.clone(), 0xffaa33);
  
  G.projectiles.push({ mesh, dir, speed: 35, damage: e.fireDmg, life: 2.5, fromEnemy: true });
}
