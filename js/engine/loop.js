// Main game loop: per-frame update() and animate() tick.
import { G } from '../state.js';
import { checkWallCollision, hasLineOfSight, clampPosition } from '../player/movement.js';
import { enemyShoot } from '../entities/enemies.js';
import { vehicleShoot, damageVehicle } from '../entities/vehicles.js';
import { allyShoot } from '../entities/allies.js';
import { damageEnemy, killEnemy, playerTakeDamage } from '../combat/damage.js';
import { checkItems } from '../entities/items.js';
import { updateHUD } from '../ui/hud.js';
import { checkLevelComplete } from '../ui/flow.js';

const PI = Math.PI;

export function update(dt) {
  if (!G.inGame || G.paused || !G.alive) return;

  // Cooldowns
  if (G.attackCooldown > 0) G.attackCooldown -= dt;
  if (G.dodgeCooldown > 0) G.dodgeCooldown -= dt;

  // Level-complete failsafe: force-kill stragglers when the player has already cleared
  // almost everything but the level won't finish (classic "enemy wedged in geometry").
  // All four conditions must hold so we don't fire on someone just exploring slowly.
  if (G.clock) {
    const now = G.clock.getElapsedTime();
    const alive = G.enemies.filter(e => e.health > 0).length;
    const aliveVehicles = G.vehicles.filter(v => v.health > 0).length;
    const noKillsFor = now - G.lastKillTime;
    const levelAge = now - G.levelStartTime;
    if (
      alive > 0 &&
      aliveVehicles === 0 &&
      noKillsFor > 60 &&
      levelAge > 60 &&
      G.initialEnemyCount > 0 &&
      alive < G.initialEnemyCount * 0.25
    ) {
      G.enemies.forEach(e => { if (e.health > 0) e.health = 0; });
      G.lastKillTime = now;
      checkLevelComplete();
    }
  }
  
  // Stamina regen
  if (G.stamina < 100 && !G.blocking) G.stamina = Math.min(100, G.stamina + 15 * dt);
  
  // Keyboard movement
  if (!G.isTouch) {
    G.moveDir.x = 0; G.moveDir.z = 0;
    if (G.keys['KeyW'] || G.keys['ArrowUp']) G.moveDir.z = -1;
    if (G.keys['KeyS'] || G.keys['ArrowDown']) G.moveDir.z = 1;
    if (G.keys['KeyA'] || G.keys['ArrowLeft']) G.moveDir.x = -1;
    if (G.keys['KeyD'] || G.keys['ArrowRight']) G.moveDir.x = 1;
  }
  
  if (G.driving) {
    // === VEHICLE DRIVING MODE ===
    const vMesh = G.driving.mesh;
    const vSpeed = (G.driving.type === 'tank' ? 12 : 20) * dt;
    const turnSpeed = 2 * dt;
    // Turn with A/D
    if (G.moveDir.x !== 0) vMesh.rotation.y -= G.moveDir.x * turnSpeed;
    // Forward/back with W/S
    if (G.moveDir.z !== 0) {
      const fwd = new THREE.Vector3(0, 0, G.moveDir.z).applyAxisAngle(new THREE.Vector3(0,1,0), vMesh.rotation.y);
      const nx = vMesh.position.x + fwd.x * vSpeed;
      const nz = vMesh.position.z + fwd.z * vSpeed;
      if (!checkWallCollision(nx, vMesh.position.z)) vMesh.position.x = nx;
      if (!checkWallCollision(vMesh.position.x, nz)) vMesh.position.z = nz;
    }
    // Camera follows vehicle
    const camOff = new THREE.Vector3(0, G.driving.type==='tank'?4:3, 0);
    G.camera.position.set(vMesh.position.x + camOff.x, vMesh.position.y + camOff.y, vMesh.position.z + camOff.z);
    // Look direction still free
    G.camera.rotation.order = 'YXZ';
    G.camera.rotation.y = G.lookDir.y;
    G.camera.rotation.x = G.lookDir.x;
    // Vehicle runs over enemies
    G.enemies.forEach(e => {
      if (e.health <= 0) return;
      const dx = e.mesh.position.x - vMesh.position.x;
      const dz = e.mesh.position.z - vMesh.position.z;
      if (dx*dx + dz*dz < (G.driving.type==='tank'?12:6)) {
        damageEnemy(e, G.driving.type==='tank'?80:40);
      }
    });
  } else {
    // === ON FOOT MOVEMENT ===
    // Sprint: 1.7x speed while Shift held, drains stamina. Stops when stamina bottoms out.
    let sprintMult = 1;
    if (G.sprinting && G.stamina > 0 && !G.blocking) {
      sprintMult = 1.7;
      G.stamina = Math.max(0, G.stamina - 25 * dt); // costs 25 stamina/sec
    }
    if (G.stamina <= 0) G.sprinting = false; // can't sprint on empty
    const speed = (5 + G.skills.speed) * sprintMult * dt;
    const dir = new THREE.Vector3(G.moveDir.x, 0, G.moveDir.z);
    if (dir.length() > 0) {
      dir.normalize();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), G.lookDir.y);
      const newX = G.camera.position.x + dir.x * speed;
      const newZ = G.camera.position.z + dir.z * speed;
      if (!checkWallCollision(newX, G.camera.position.z)) G.camera.position.x = newX;
      if (!checkWallCollision(G.camera.position.x, newZ)) G.camera.position.z = newZ;
    }
    clampPosition();
    let floorY = 0;
    G.scene.traverse(obj => {
      if (!obj.userData.isRamp && !obj.userData.isFloor) return;
      const b = obj.userData.box;
      if (!b) return;
      const px = G.camera.position.x, pz = G.camera.position.z;
      if (px > b.min.x - 0.3 && px < b.max.x + 0.3 && pz > b.min.z - 0.3 && pz < b.max.z + 0.3) {
        const topY = obj.position.y + (obj.geometry.parameters ? obj.geometry.parameters.height/2 : 0.15);
        if (topY > floorY && topY < G.camera.position.y + 1) floorY = topY;
      }
    });
    // Jump physics — vertical velocity + gravity, layered on top of floor height.
    // jumpOffset is the height above the floor; jumpVelocity is the current vertical speed.
    G.jumpVelocity -= 20 * dt; // gravity pulls down
    G.jumpOffset += G.jumpVelocity * dt;
    if (G.jumpOffset <= 0) {
      G.jumpOffset = 0;
      G.jumpVelocity = 0;
    }
    G.camera.position.y = floorY + 1.7 + G.jumpOffset;
    G.camera.rotation.order = 'YXZ';
    G.camera.rotation.y = G.lookDir.y;
    G.camera.rotation.x = G.lookDir.x;
  }
  
  // Update enemies — FULL AI
  G.enemies.forEach(e => {
    if (e.health <= 0) return;
    const dx = G.camera.position.x - e.mesh.position.x;
    const dz = G.camera.position.z - e.mesh.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    
    e.mesh.rotation.y = Math.atan2(dx, dz);
    
    // === ALERT SYSTEM — stationary until alerted ===
    if (!e.alerted) {
      // Alerted by: player within 15 units, or a gunshot in the last 0.5s within 40 units
      const timeSinceAttack = G.clock ? (G.clock.getElapsedTime() - G.lastAttackTime) : 100;
      if (dist < 15 || (timeSinceAttack < 0.5 && dist < 40)) {
        e.alerted = true;
        // Alert nearby enemies too
        G.enemies.forEach(other => {
          if (other.alerted || other.health <= 0) return;
          const od = Math.hypot(other.mesh.position.x-e.mesh.position.x, other.mesh.position.z-e.mesh.position.z);
          if (od < 25) other.alerted = true;
        });
      } else {
        return; // Stay stationary
      }
    }
    
    // === FLEE when low health ===
    const hpPct = e.health / e.maxHealth;
    if (hpPct < 0.2 && !e.isBoss && e.specialType !== 'bomber') {
      e.state = 'flee';
      // Limp animation — slow down
      const fleeSpeed = e.speed * 0.4 * dt;
      const fx = e.mesh.position.x - (dx/dist)*fleeSpeed;
      const fz = e.mesh.position.z - (dz/dist)*fleeSpeed;
      if (!checkWallCollision(fx, e.mesh.position.z)) e.mesh.position.x = fx;
      if (!checkWallCollision(e.mesh.position.x, fz)) e.mesh.position.z = fz;
      // Limp visual — tilt body
      e.mesh.children[0].rotation.x = Math.sin(Date.now()*0.01)*0.15;
    } else {
      // === STATE MACHINE ===
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        if (e.specialType === 'bomber') e.state = 'rush';
        else if (e.specialType === 'sniper' && dist > 10) e.state = 'snipe';
        else if (e.specialType === 'shield') e.state = 'advance';
        else if (dist < 3.5) e.state = 'melee';
        else if (e.isRanged && dist < e.fireRange) e.state = 'shoot';
        else if (dist < 30) e.state = 'chase';
        else e.state = 'idle';
        e.stateTimer = 0.5 + Math.random();
      }
      
      // === MOVEMENT BY STATE ===
      if (e.state === 'rush') {
        // BOMBER — sprint straight at player
        const ms = e.speed * dt;
        const nx = e.mesh.position.x + (dx/dist)*ms;
        const nz = e.mesh.position.z + (dz/dist)*ms;
        if (!checkWallCollision(nx, e.mesh.position.z)) e.mesh.position.x = nx;
        if (!checkWallCollision(e.mesh.position.x, nz)) e.mesh.position.z = nz;
        // Blinking red light faster as closer
        const blinkRate = Math.max(100, dist * 30);
        e.mesh.children.forEach(c => { if(c.material && c.material.color && c.material.color.r > 0.9) c.visible = (Date.now() % blinkRate) < blinkRate/2; });
        // Explode on contact
        if (dist < 2.5) { e.health = 0; killEnemy(e); }
      } else if (e.state === 'snipe') {
        // SNIPER — stay still, don't move
        // Sniper laser sight
        if (!e._laser) {
          const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-80)]);
          e._laser = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({color:0xff0000,transparent:true,opacity:0.4}));
          e._laser.userData.levelObj = true;
          G.scene.add(e._laser);
        }
        e._laser.position.set(e.mesh.position.x, 1.4, e.mesh.position.z);
        e._laser.rotation.y = e.mesh.rotation.y;
      } else if (e.state === 'advance') {
        // SHIELD — slow advance, keep shield facing player
        const ms = e.speed * 0.5 * dt;
        const nx = e.mesh.position.x + (dx/dist)*ms;
        const nz = e.mesh.position.z + (dz/dist)*ms;
        if (!checkWallCollision(nx, e.mesh.position.z)) e.mesh.position.x = nx;
        if (!checkWallCollision(e.mesh.position.x, nz)) e.mesh.position.z = nz;
        // Sidestep to keep shield facing
        const sideStep = Math.sin(Date.now()*0.003)*e.speed*0.3*dt;
        const sx = e.mesh.position.x + (-dz/dist)*sideStep;
        if (!checkWallCollision(sx, e.mesh.position.z)) e.mesh.position.x = sx;
        // Shield bash when close
        if (dist < 2.5 && e.attackCd <= 0) {
          playerTakeDamage(15); e.attackCd = 1.5;
          // Knockback player
          G.camera.position.x += (dx/dist)*-2;
          G.camera.position.z += (dz/dist)*-2;
        }
      } else if (e.state === 'chase') {
        // SMART CHASE — duck and weave, try to flank
        const ms = e.speed * dt;
        // Weave: sine-wave offset perpendicular to direction
        const weave = Math.sin(Date.now()*0.004+e.x*10)*ms*1.5;
        const wx = (-dz/dist)*weave;
        const wz = (dx/dist)*weave;
        const nx = e.mesh.position.x + (dx/dist)*ms + wx;
        const nz = e.mesh.position.z + (dz/dist)*ms + wz;
        if (!checkWallCollision(nx, e.mesh.position.z)) e.mesh.position.x = nx;
        if (!checkWallCollision(e.mesh.position.x, nz)) e.mesh.position.z = nz;
        // Duck animation
        e.mesh.children[0].position.y = 1.2 + Math.sin(Date.now()*0.006)*0.15;
      } else if (e.state === 'shoot') {
        // Strafe while shooting
        const strafe = Math.sin(Date.now()*0.002+e.x)*e.speed*0.5*dt;
        const sx2 = e.mesh.position.x + (-dz/dist)*strafe;
        const sz2 = e.mesh.position.z + (dx/dist)*strafe;
        if (!checkWallCollision(sx2, e.mesh.position.z)) e.mesh.position.x = sx2;
        if (!checkWallCollision(e.mesh.position.x, sz2)) e.mesh.position.z = sz2;
        if (dist > e.fireRange*0.7) {
          const ms = e.speed*0.3*dt;
          const cx2=e.mesh.position.x+(dx/dist)*ms,cz2=e.mesh.position.z+(dz/dist)*ms;
          if(!checkWallCollision(cx2,e.mesh.position.z))e.mesh.position.x=cx2;
          if(!checkWallCollision(e.mesh.position.x,cz2))e.mesh.position.z=cz2;
        }
      } else if (e.state === 'melee') {
        if (dist > 2) {
          const ms = e.speed*dt;
          const nx=e.mesh.position.x+(dx/dist)*ms,nz=e.mesh.position.z+(dz/dist)*ms;
          if(!checkWallCollision(nx,e.mesh.position.z))e.mesh.position.x=nx;
          if(!checkWallCollision(e.mesh.position.x,nz))e.mesh.position.z=nz;
        }
      }
      // idle = stationary
    }
    
    e.mesh.position.x = Math.max(-147, Math.min(147, e.mesh.position.x));
    e.mesh.position.z = Math.max(-147, Math.min(147, e.mesh.position.z));
    
    // === ATTACKS ===
    e.attackCd -= dt;
    if (e.state === 'melee' && dist < 3 && e.attackCd <= 0 && hasLineOfSight(e.mesh.position.x,e.mesh.position.z,G.camera.position.x,G.camera.position.z)) {
      playerTakeDamage(e.damage); e.attackCd = 1.2;
    }
    if (e.isRanged && e.state !== 'rush' && e.state !== 'flee' && dist > 4 && dist < e.fireRange && e.attackCd <= 0) {
      if (hasLineOfSight(e.mesh.position.x,e.mesh.position.z,G.camera.position.x,G.camera.position.z)) {
        enemyShoot(e); e.attackCd = e.fireRate;
      }
    }
    
    // Flinch when recently hit
    if (e._flinchTimer > 0) {
      e._flinchTimer -= dt;
      e.mesh.children[0].rotation.z = Math.sin(Date.now()*0.02)*0.2;
    } else {
      e.mesh.children[0].rotation.z = 0;
    }
  });
  
  // Update vehicles (tanks & jeeps AI)
  G.vehicles.forEach(v => {
    if (v.health <= 0) return;
    const dx = G.camera.position.x - v.mesh.position.x;
    const dz = G.camera.position.z - v.mesh.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    
    // Face player
    v.mesh.rotation.y = Math.atan2(dx, dz);
    
    // State machine
    v.stateTimer -= dt;
    if (v.stateTimer <= 0) {
      if (dist < v.range) v.state = 'attack';
      else if (dist < v.range + 20) v.state = 'chase';
      else v.state = 'patrol';
      v.stateTimer = 1 + Math.random() * 2;
    }
    
    if (v.state === 'chase' || v.state === 'attack') {
      const minDist = v.type === 'tank' ? 15 : 10;
      if (dist > minDist) {
        const ms = v.speed * dt;
        const nx = v.mesh.position.x + (dx/dist) * ms;
        const nz = v.mesh.position.z + (dz/dist) * ms;
        if (!checkWallCollision(nx, v.mesh.position.z)) v.mesh.position.x = nx;
        else { v.patrolAngle += dt*2; const sx=Math.cos(v.patrolAngle)*ms; if(!checkWallCollision(v.mesh.position.x+sx,v.mesh.position.z)) v.mesh.position.x+=sx; }
        if (!checkWallCollision(v.mesh.position.x, nz)) v.mesh.position.z = nz;
        else { const sz=Math.sin(v.patrolAngle)*ms; if(!checkWallCollision(v.mesh.position.x,v.mesh.position.z+sz)) v.mesh.position.z+=sz; }
      } else if (dist < minDist - 3) {
        const ms = v.speed * dt * 0.5;
        const bx=v.mesh.position.x-(dx/dist)*ms, bz=v.mesh.position.z-(dz/dist)*ms;
        if (!checkWallCollision(bx, v.mesh.position.z)) v.mesh.position.x = bx;
        if (!checkWallCollision(v.mesh.position.x, bz)) v.mesh.position.z = bz;
      }
      
      v.fireCd -= dt;
      if (v.fireCd <= 0 && dist < v.range && hasLineOfSight(v.mesh.position.x, v.mesh.position.z, G.camera.position.x, G.camera.position.z)) {
        vehicleShoot(v);
        v.fireCd = v.fireRate;
      }
    } else {
      v.patrolAngle += dt * 0.5;
      const ms = v.speed * dt * 0.4;
      const nx = v.mesh.position.x + Math.cos(v.patrolAngle)*ms;
      const nz = v.mesh.position.z + Math.sin(v.patrolAngle)*ms;
      if (!checkWallCollision(nx, v.mesh.position.z)) v.mesh.position.x = Math.max(-145,Math.min(145,nx));
      if (!checkWallCollision(v.mesh.position.x, nz)) v.mesh.position.z = Math.max(-145,Math.min(145,nz));
      v.mesh.rotation.y = v.patrolAngle + Math.PI/2;
    }
    
    // Wheel spin animation for jeeps
    if (v.type === 'jeep') {
      v.mesh.children.forEach(c => {
        if (c.geometry && c.geometry.type === 'CylinderGeometry' && c.position.y < 1) {
          c.rotation.x += dt * v.speed;
        }
      });
    }
    
    // Run over player if very close
    if (dist < (v.type === 'tank' ? 3.5 : 2.5)) {
      playerTakeDamage(v.damage * 2 * dt);
    }
    v.mesh.position.x = Math.max(-147, Math.min(147, v.mesh.position.x));
    v.mesh.position.z = Math.max(-147, Math.min(147, v.mesh.position.z));
  });
  
  // Update ally vehicles
  G.allies.forEach(a => {
    if (a.health <= 0) return;
    // Find nearest enemy or enemy vehicle
    let tgt = null, tDist = Infinity;
    G.enemies.forEach(e => { if(e.health<=0) return; const d=Math.hypot(e.mesh.position.x-a.mesh.position.x, e.mesh.position.z-a.mesh.position.z); if(d<tDist){tDist=d;tgt=e;} });
    G.vehicles.forEach(v => { if(v.health<=0) return; const d=Math.hypot(v.mesh.position.x-a.mesh.position.x, v.mesh.position.z-a.mesh.position.z); if(d<tDist){tDist=d;tgt=v;} });
    
    if (tgt) {
      const dx=tgt.mesh.position.x-a.mesh.position.x, dz=tgt.mesh.position.z-a.mesh.position.z;
      const dist=Math.sqrt(dx*dx+dz*dz);
      a.mesh.rotation.y = Math.atan2(dx, dz);
      const minD = a.type==='tank'?12:8;
      if (dist > minD) {
        const ms=a.speed*dt;
        const nx=a.mesh.position.x+(dx/dist)*ms, nz=a.mesh.position.z+(dz/dist)*ms;
        if(!checkWallCollision(nx,a.mesh.position.z)) a.mesh.position.x=nx;
        if(!checkWallCollision(a.mesh.position.x,nz)) a.mesh.position.z=nz;
      }
      a.fireCd -= dt;
      if (a.fireCd<=0 && dist<a.range && hasLineOfSight(a.mesh.position.x,a.mesh.position.z,tgt.mesh.position.x,tgt.mesh.position.z)) {
        allyShoot(a, tgt); a.fireCd = a.fireRate;
      }
    } else {
      // Follow player
      const dx=G.camera.position.x-a.mesh.position.x, dz=G.camera.position.z-a.mesh.position.z, dist=Math.sqrt(dx*dx+dz*dz);
      a.mesh.rotation.y = Math.atan2(dx,dz);
      if(dist>8){const ms=a.speed*0.5*dt;const nx=a.mesh.position.x+(dx/dist)*ms,nz=a.mesh.position.z+(dz/dist)*ms;if(!checkWallCollision(nx,a.mesh.position.z))a.mesh.position.x=nx;if(!checkWallCollision(a.mesh.position.x,nz))a.mesh.position.z=nz;}
    }
    a.mesh.position.x=Math.max(-147,Math.min(147,a.mesh.position.x));
    a.mesh.position.z=Math.max(-147,Math.min(147,a.mesh.position.z));
    // Label faces G.camera
    const lbl=a.mesh.children[a.mesh.children.length-2];
    if(lbl&&lbl.isObject3D){const lp=lbl.getWorldPosition(new THREE.Vector3());lbl.lookAt(G.camera.position.x,lp.y,G.camera.position.z);}
  });
  
  // Update projectiles
  G.projectiles.forEach((p, idx) => {
    p.mesh.position.add(p.dir.clone().multiplyScalar(p.speed * dt));
    p.life -= dt;
    
    // WALL COLLISION
    if (checkWallCollision(p.mesh.position.x, p.mesh.position.z)) {
      p.life = 0;
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.08, 3, 3), new THREE.MeshBasicMaterial({ color: 0xffcc66 }));
      spark.position.copy(p.mesh.position); spark.userData.levelObj = true; G.scene.add(spark);
      setTimeout(() => G.scene.remove(spark), 80);
    }
    
    if (p.life <= 0) { G.scene.remove(p.mesh); return; }
    
    if (p.fromEnemy) {
      // Enemy bullet — hits player only
      const dx=p.mesh.position.x-G.camera.position.x, dz=p.mesh.position.z-G.camera.position.z, dy=p.mesh.position.y-G.camera.position.y;
      if (dx*dx+dy*dy+dz*dz < 2.5) { playerTakeDamage(p.damage); p.life=0; }
    } else if (p.fromAlly) {
      // Ally bullet — hits enemies and enemy vehicles
      G.enemies.forEach(e => { if(e.health<=0) return;
        const dx=p.mesh.position.x-e.mesh.position.x, dz=p.mesh.position.z-e.mesh.position.z, dy=p.mesh.position.y-(e.mesh.position.y+1.2);
        if(dx*dx+dy*dy+dz*dz<2){damageEnemy(e,p.damage);p.life=0;}
      });
      G.vehicles.forEach(v => { if(v.health<=0) return;
        const dx=p.mesh.position.x-v.mesh.position.x, dz=p.mesh.position.z-v.mesh.position.z, dy=p.mesh.position.y-(v.mesh.position.y+1.5);
        const hr=v.hitRadius||3; if(dx*dx+dy*dy+dz*dz<hr*hr){damageVehicle(v,p.damage);p.life=0;}
      });
    } else {
      // Player bullet — hits enemies and enemy vehicles
      G.enemies.forEach(e => { if(e.health<=0) return;
        const dx=p.mesh.position.x-e.mesh.position.x, dz=p.mesh.position.z-e.mesh.position.z, dy=p.mesh.position.y-(e.mesh.position.y+1.2);
        if(dx*dx+dy*dy+dz*dz<2){damageEnemy(e,p.damage);p.life=0;}
      });
      G.vehicles.forEach(v => { if(v.health<=0) return;
        const dx=p.mesh.position.x-v.mesh.position.x, dz=p.mesh.position.z-v.mesh.position.z, dy=p.mesh.position.y-(v.mesh.position.y+1.5);
        const hr=v.hitRadius||3; if(dx*dx+dy*dy+dz*dz<hr*hr){damageVehicle(v,p.damage);p.life=0;}
      });
    }
    if (p.life <= 0) G.scene.remove(p.mesh);
  });
  G.projectiles = G.projectiles.filter(p => p.life > 0);
  
  // Rotate lore items
  G.loreItems.forEach(l => {
    if (!l.collected) l.mesh.rotation.y += dt * 2;
  });
  
  // Rotate items
  G.items.forEach(item => {
    if (!item.collected) item.mesh.rotation.y += dt;
  });
  
  checkItems();
  updateHUD();
}

export function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(G.clock.getDelta(), 0.05);
  update(dt);
  G.renderer.render(G.scene, G.camera);
}
