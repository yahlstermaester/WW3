'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as Network from '../game/network';
import LEVELS from '../game/levels.json';

const WEAPON_DATA = {
  combat_knife: { dmg:12, range:3, speed:0.25, type:'melee', icon:'🔪', ammoKey:null },
  bowie_knife:  { dmg:18, range:3.5, speed:0.35, type:'melee', icon:'🗡️', ammoKey:null },
  machete:      { dmg:24, range:4, speed:0.45, type:'melee', icon:'⚔️', ammoKey:null },
  katana:       { dmg:32, range:4.5, speed:0.5, type:'melee', icon:'⛩️', ammoKey:null },
  pistol:       { dmg:15, range:50, speed:0.35, type:'ranged', icon:'🔫', ammoKey:'pistol' },
  shotgun:      { dmg:35, range:15, speed:0.7, type:'ranged', icon:'💥', ammoKey:'shells' },
  smg:          { dmg:10, range:40, speed:0.12, type:'ranged', icon:'🔰', ammoKey:'smg' },
  rifle:        { dmg:28, range:70, speed:0.5, type:'ranged', icon:'🎯', ammoKey:'rifle' },
  sniper:       { dmg:55, range:100, speed:1.2, type:'ranged', icon:'🔭', ammoKey:'sniper' },
};

export default function Game() {
  const mountRef = useRef(null);
  const gameRef = useRef(null);
  const [screen, setScreen] = useState('menu');
  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [playerName, setPlayerName] = useState('Survivor');
  const [roomName, setRoomName] = useState('WW3 Battle');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatVisible, setChatVisible] = useState(false);
  const [killFeed, setKillFeed] = useState([]);
  const [showScoreboard, setShowScoreboard] = useState(false);

  // ===== CONNECT TO SERVER =====
  useEffect(() => {
    const socket = Network.connect();
    Network.on('onConnect', () => setConnected(true));
    Network.on('onDisconnect', () => setConnected(false));
    Network.on('onRoomList', (r) => setRooms(r));
    Network.on('onRoomJoined', (data) => {
      setCurrentRoom(data.room);
      setMyPlayer(data.player);
      setScreen('lobby');
    });
    Network.on('onPlayerJoined', (p) => {
      setCurrentRoom(prev => {
        if (!prev) return prev;
        const players = { ...prev.players, [p.id]: p };
        return { ...prev, players };
      });
    });
    Network.on('onPlayerLeft', (p) => {
      setCurrentRoom(prev => {
        if (!prev) return prev;
        const players = { ...prev.players };
        delete players[p.id];
        return { ...prev, players };
      });
      if (gameRef.current) {
        const g = gameRef.current;
        if (g.otherPlayers[p.id]) {
          g.scene.remove(g.otherPlayers[p.id].mesh);
          delete g.otherPlayers[p.id];
        }
      }
    });
    Network.on('onGameStarted', (state) => {
      setCurrentRoom(state);
      setScreen('playing');
      if (gameRef.current) initGameWorld(state);
    });
    Network.on('onPlayerMoved', (data) => {
      if (gameRef.current) updateOtherPlayer(data);
    });
    Network.on('onPlayerShot', (data) => {
      if (gameRef.current) showRemoteShot(data);
    });
    Network.on('onEnemiesUpdate', (data) => {
      if (gameRef.current) syncEnemies(data);
    });
    Network.on('onEnemyKilled', (data) => {
      if (gameRef.current) removeEnemy(data.enemyId);
      addKillFeed('Enemy eliminated');
    });
    Network.on('onEnemyDamaged', (data) => {
      if (gameRef.current) {
        const e = gameRef.current.enemies.find(en => en.id === data.enemyId);
        if (e) e.health = data.health;
      }
    });
    Network.on('onEnemyShoot', (data) => {
      if (gameRef.current) handleEnemyShoot(data);
    });
    Network.on('onEnemyMelee', (data) => {
      if (gameRef.current && data.targetId === Network.getMyId()) {
        const g = gameRef.current;
        g.health -= data.damage * (g.blocking ? 0.3 : 1);
        if (g.health <= 0) { g.health = 0; g.alive = false; Network.sendPlayerDamaged(0); }
        flashDamage();
      }
    });
    Network.on('onPlayerDied', (data) => {
      addKillFeed('A survivor has fallen');
    });
    Network.on('onLevelComplete', (data) => {
      if (gameRef.current) { gameRef.current.inGame = false; }
      setScreen('victory');
    });
    Network.on('onChat', (data) => {
      setChatMessages(prev => [...prev.slice(-50), data]);
    });
    Network.on('onError', (msg) => alert(msg));

    return () => { if (socket) socket.disconnect(); };
  }, []);

  const addKillFeed = (text) => {
    setKillFeed(prev => [...prev.slice(-5), { text, time: Date.now() }]);
    setTimeout(() => setKillFeed(prev => prev.slice(1)), 4000);
  };

  const flashDamage = () => {
    const el = document.getElementById('damageFlash');
    if (el) { el.style.opacity = '1'; setTimeout(() => el.style.opacity = '0', 150); }
  };

  // ===== THREE.JS INIT =====
  useEffect(() => {
    if (screen !== 'playing') return;
    if (gameRef.current && gameRef.current.renderer) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1612);
    scene.fog = new THREE.FogExp2(0x1a1612, 0.025);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 1.7, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current?.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x8a7560, 0.4);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xd4a054, 0.6);
    dirLight.position.set(20, 30, 10);
    scene.add(dirLight);
    scene.add(new THREE.HemisphereLight(0x87735e, 0x3a1a0a, 0.3));

    const clock = new THREE.Clock();

    const g = {
      scene, camera, renderer, clock,
      health: 100, maxHealth: 100, stamina: 100,
      ammo: { pistol: 24, shells: 0, smg: 0, rifle: 0, sniper: 0 },
      weapons: ['combat_knife', 'pistol'], currentWeapon: 0,
      score: 0, scrap: 0, xp: 0,
      moveDir: { x: 0, z: 0 }, lookDir: { x: 0, y: 0 },
      keys: {}, blocking: false, alive: true, inGame: true, paused: false,
      attackCooldown: 0, dodgeCooldown: 0,
      enemies: [], vehicles: [], items: [], projectiles: [],
      otherPlayers: {},
      netTick: 0
    };
    gameRef.current = g;

    // Input
    const onKeyDown = (e) => {
      g.keys[e.code] = true;
      if (e.code === 'KeyQ') { g.currentWeapon = (g.currentWeapon + 1) % g.weapons.length; }
      if (e.code === 'Space') dodge(g);
      if (e.code === 'KeyF') g.blocking = true;
      if (e.code === 'Tab') { e.preventDefault(); setShowScoreboard(true); }
      if (e.code === 'Enter') { e.preventDefault(); setChatVisible(v => !v); }
    };
    const onKeyUp = (e) => {
      g.keys[e.code] = false;
      if (e.code === 'KeyF') g.blocking = false;
      if (e.code === 'Tab') setShowScoreboard(false);
    };
    const onMouseMove = (e) => {
      if (!g.inGame || g.paused) return;
      if (document.pointerLockElement) {
        g.lookDir.y -= e.movementX * 0.002;
        g.lookDir.x -= e.movementY * 0.002;
        g.lookDir.x = Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, g.lookDir.x));
      }
    };
    const onMouseDown = (e) => {
      if (!g.inGame) return;
      if (e.button === 0) {
        if (!document.pointerLockElement) renderer.domElement.requestPointerLock();
        attack(g);
      }
      if (e.button === 2) g.blocking = true;
    };
    const onMouseUp = (e) => { if (e.button === 2) g.blocking = false; };
    const onContext = (e) => e.preventDefault();
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', onContext);
    window.addEventListener('resize', onResize);

    // Game loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      updateGame(g, dt);
      renderer.render(scene, camera);
    };
    animate();

    document.getElementById('hud')?.classList.add('active');

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('contextmenu', onContext);
      window.removeEventListener('resize', onResize);
      document.exitPointerLock?.();
      document.getElementById('hud')?.classList.remove('active');
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      gameRef.current = null;
    };
  }, [screen]);

  // ===== GAME WORLD INIT =====
  function initGameWorld(state) {
    const g = gameRef.current;
    if (!g) return;

    const levelData = LEVELS[state.level] || LEVELS[0];
    generateEnvironment(g, levelData.env);

    // Create enemy meshes from server state
    g.enemies = (state.enemies || []).map(e => ({
      ...e, mesh: createEnemyMesh(g.scene, e.x, e.z, e.isBoss)
    }));

    // Create vehicle meshes
    g.vehicles = (state.vehicles || []).map(v => ({
      ...v, mesh: createVehicleMesh(g.scene, v.x, v.z, v.type)
    }));

    // Spawn items
    spawnItems(g);

    // Create other player meshes
    if (state.players) {
      Object.entries(state.players).forEach(([id, p]) => {
        if (id !== Network.getMyId()) {
          g.otherPlayers[id] = { ...p, mesh: createPlayerMesh(g.scene, p) };
        }
      });
    }
  }

  function updateOtherPlayer(data) {
    const g = gameRef.current;
    if (!g || data.id === Network.getMyId()) return;
    if (!g.otherPlayers[data.id]) {
      g.otherPlayers[data.id] = { ...data, mesh: createPlayerMesh(g.scene, data) };
    }
    const op = g.otherPlayers[data.id];
    op.mesh.position.set(data.x, 0, data.z);
    op.mesh.rotation.y = data.rotY;
    Object.assign(op, data);
  }

  function showRemoteShot(data) {
    const g = gameRef.current;
    if (!g) return;
    const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
    const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
    createTracer(g.scene, origin, dir, 0xffcc44);
  }

  function syncEnemies(data) {
    const g = gameRef.current;
    if (!g) return;
    data.forEach(ed => {
      const e = g.enemies.find(en => en.id === ed.id);
      if (e && e.mesh && e.health > 0) {
        e.mesh.position.set(ed.x, 0, ed.z);
        e.mesh.rotation.y = ed.rotY;
        e.health = ed.health;
        e.x = ed.x; e.z = ed.z;
      }
    });
  }

  function removeEnemy(enemyId) {
    const g = gameRef.current;
    if (!g) return;
    const idx = g.enemies.findIndex(e => e.id === enemyId);
    if (idx >= 0) {
      g.scene.remove(g.enemies[idx].mesh);
      g.enemies.splice(idx, 1);
    }
  }

  function handleEnemyShoot(data) {
    const g = gameRef.current;
    if (!g) return;
    const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
    const target = data.targetId === Network.getMyId() ? g.camera.position : null;
    if (!target) return;
    const dir = new THREE.Vector3().subVectors(target, origin).normalize();
    dir.x += (Math.random()-0.5)*0.08; dir.z += (Math.random()-0.5)*0.08;
    createTracer(g.scene, origin, dir, 0xffaa33);

    // Simple hit check — if close to line
    const toPlayer = new THREE.Vector3().subVectors(target, origin);
    const dist = toPlayer.length();
    if (dist < 30) {
      const accuracy = 0.7;
      if (Math.random() < accuracy) {
        g.health -= data.damage * (g.blocking ? 0.3 : 1);
        if (g.health <= 0) { g.health = 0; g.alive = false; Network.sendPlayerDamaged(0); }
        else Network.sendPlayerDamaged(g.health);
        flashDamage();
      }
    }
  }

  // ===== GAME UPDATE =====
  function updateGame(g, dt) {
    if (!g.inGame || !g.alive) return;

    if (g.attackCooldown > 0) g.attackCooldown -= dt;
    if (g.dodgeCooldown > 0) g.dodgeCooldown -= dt;
    if (g.stamina < 100 && !g.blocking) g.stamina = Math.min(100, g.stamina + 15 * dt);

    // Movement
    g.moveDir.x = 0; g.moveDir.z = 0;
    if (g.keys['KeyW'] || g.keys['ArrowUp']) g.moveDir.z = -1;
    if (g.keys['KeyS'] || g.keys['ArrowDown']) g.moveDir.z = 1;
    if (g.keys['KeyA'] || g.keys['ArrowLeft']) g.moveDir.x = -1;
    if (g.keys['KeyD'] || g.keys['ArrowRight']) g.moveDir.x = 1;

    const speed = 5 * dt;
    const dir = new THREE.Vector3(g.moveDir.x, 0, g.moveDir.z);
    if (dir.length() > 0) {
      dir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0), g.lookDir.y);
      const nx = g.camera.position.x + dir.x * speed;
      const nz = g.camera.position.z + dir.z * speed;
      if (!checkWallCollision(g.scene, nx, g.camera.position.z)) g.camera.position.x = nx;
      if (!checkWallCollision(g.scene, g.camera.position.x, nz)) g.camera.position.z = nz;
    }
    g.camera.position.x = Math.max(-48, Math.min(48, g.camera.position.x));
    g.camera.position.z = Math.max(-48, Math.min(48, g.camera.position.z));
    g.camera.position.y = 1.7;
    g.camera.rotation.order = 'YXZ';
    g.camera.rotation.y = g.lookDir.y;
    g.camera.rotation.x = g.lookDir.x;

    // Projectiles
    g.projectiles.forEach(p => {
      p.mesh.position.add(p.dir.clone().multiplyScalar(p.speed * dt));
      p.life -= dt;
      if (p.life <= 0) g.scene.remove(p.mesh);
    });
    g.projectiles = g.projectiles.filter(p => p.life > 0);

    // Items
    g.items.forEach(item => {
      if (item.collected) return;
      item.mesh.rotation.y += dt;
      const dx = item.mesh.position.x - g.camera.position.x;
      const dz = item.mesh.position.z - g.camera.position.z;
      if (dx*dx + dz*dz < 4) {
        item.collected = true;
        g.scene.remove(item.mesh);
        if (item.type === 'medkit') g.health = Math.min(g.maxHealth, g.health + 40);
        else if (item.type === 'bullets') {
          g.weapons.forEach(w => { const wd = WEAPON_DATA[w]; if (wd.ammoKey) g.ammo[wd.ammoKey] += 10; });
        }
        else if (item.type === 'food') g.health = Math.min(g.maxHealth, g.health + 15);
        else if (item.type === 'water') g.stamina = Math.min(100, g.stamina + 30);
      }
    });

    // Network sync (throttled)
    g.netTick += dt;
    if (g.netTick > 0.05) { // 20fps network updates
      g.netTick = 0;
      Network.sendPosition(
        g.camera.position.x, g.camera.position.y, g.camera.position.z,
        g.lookDir.y, g.lookDir.x, g.currentWeapon, g.health, g.alive
      );
    }

    // Update HUD
    updateHUD(g);
  }

  // ===== COMBAT =====
  function attack(g) {
    if (g.attackCooldown > 0 || !g.alive) return;
    const wp = WEAPON_DATA[g.weapons[g.currentWeapon]];
    g.attackCooldown = wp.speed;

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(g.camera.quaternion);

    if (wp.type === 'ranged') {
      if (!wp.ammoKey || (g.ammo[wp.ammoKey] || 0) <= 0) return;
      g.ammo[wp.ammoKey]--;

      const origin = g.camera.position.clone();
      Network.sendShoot(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: dir.x, y: dir.y, z: dir.z },
        g.weapons[g.currentWeapon], wp.dmg
      );

      // Muzzle flash
      const mf = new THREE.Mesh(new THREE.SphereGeometry(0.12,4,4), new THREE.MeshBasicMaterial({color:0xffcc44}));
      mf.position.copy(origin.clone().add(dir.clone().multiplyScalar(1.2)));
      g.scene.add(mf);
      setTimeout(() => g.scene.remove(mf), 40);

      // Tracer
      createTracer(g.scene, origin, dir, 0xffcc44);

      // Bullet
      const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.05,4,4), new THREE.MeshBasicMaterial({color:0xffcc44}));
      bullet.position.copy(origin);
      g.scene.add(bullet);
      g.projectiles.push({ mesh: bullet, dir: dir.clone(), speed: 55, damage: wp.dmg, life: 2 });

      // Hit detection against enemies
      g.enemies.forEach(e => {
        if (e.health <= 0) return;
        const toE = new THREE.Vector3(e.mesh.position.x - origin.x, 1.2 - origin.y, e.mesh.position.z - origin.z);
        const dot = toE.normalize().dot(dir);
        const dist = origin.distanceTo(new THREE.Vector3(e.mesh.position.x, 1.2, e.mesh.position.z));
        if (dot > 0.95 && dist < wp.range) {
          Network.sendEnemyHit(e.id, wp.dmg);
          e.mesh.children.forEach(c => { if(c.material) c.material.emissive = new THREE.Color(0x5a1a1a); });
          setTimeout(() => e.mesh.children.forEach(c => { if(c.material) c.material.emissive = new THREE.Color(0); }), 100);
        }
      });
    } else {
      // Melee
      g.enemies.forEach(e => {
        if (e.health <= 0) return;
        const dx = e.mesh.position.x - g.camera.position.x;
        const dz = e.mesh.position.z - g.camera.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist > wp.range) return;
        const toE = new THREE.Vector3(dx, 0, dz).normalize();
        if (dir.x*toE.x + dir.z*toE.z > 0.5) {
          Network.sendEnemyHit(e.id, wp.dmg);
        }
      });
    }
  }

  function dodge(g) {
    if (g.dodgeCooldown > 0 || g.stamina < 20) return;
    g.dodgeCooldown = 0.8; g.stamina -= 20;
    const dir = new THREE.Vector3(g.moveDir.x || 0, 0, g.moveDir.z || -1);
    dir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0), g.lookDir.y);
    g.camera.position.x += dir.x * 4;
    g.camera.position.z += dir.z * 4;
  }

  // ===== ENVIRONMENT =====
  function generateEnvironment(g, type) {
    const c = { city: 0x3a3530, desert: 0x5a4a35, bunker: 0x2a2825 }[type] || 0x3a3530;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshLambertMaterial({color:c}));
    ground.rotation.x = -Math.PI/2; ground.receiveShadow = true;
    g.scene.add(ground);

    // Border walls
    [[0,-50,100,8,2],[0,50,100,8,2]].forEach(([x,z,w,h,d]) => addBox(g.scene,x,0,z,w,h,d,0x4a423a));
    [[-50,0,2,8,100],[50,0,2,8,100]].forEach(([x,z,w,h,d]) => addBox(g.scene,x,0,z,w,h,d,0x4a423a));

    // Buildings
    const configs = type === 'city' ? [
      {x:-30,z:-30,w:16,d:12,h:10},{x:25,z:-25,w:14,d:14,h:14},{x:-25,z:25,w:12,d:10,h:8},
      {x:30,z:28,w:18,d:12,h:12},{x:0,z:-35,w:10,d:10,h:16},{x:-35,z:0,w:14,d:8,h:8},{x:35,z:0,w:12,d:12,h:10}
    ] : type === 'desert' ? [
      {x:-30,z:-20,w:10,d:8,h:5},{x:25,z:-15,w:12,d:8,h:6},{x:0,z:25,w:14,d:10,h:7},{x:-25,z:20,w:8,d:6,h:5}
    ] : [
      {x:-20,z:-15,w:12,d:10,h:4},{x:20,z:-15,w:10,d:10,h:4},{x:0,z:0,w:14,d:12,h:5},{x:-20,z:15,w:10,d:8,h:4},{x:20,z:15,w:12,d:10,h:4}
    ];
    configs.forEach(cfg => createBuilding(g, cfg.x, cfg.z, cfg.w, cfg.d, cfg.h));
  }

  function addBox(scene, x, y, z, w, h, d, color, isWall=true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshLambertMaterial({color}));
    mesh.position.set(x, y+h/2, z);
    mesh.castShadow = true;
    mesh.userData.isWall = isWall;
    mesh.userData.box = {min:{x:x-w/2,z:z-d/2},max:{x:x+w/2,z:z+d/2}};
    scene.add(mesh);
    return mesh;
  }

  function createBuilding(g, bx, bz, w, d, h) {
    const wt = 0.4, color = 0x4a423a, doorW = 3.5, doorH = 3;
    const sW = (w-doorW)/2;
    addBox(g.scene, bx-w/2,0,bz, wt,h,d, color);
    addBox(g.scene, bx+w/2,0,bz, wt,h,d, color);
    addBox(g.scene, bx-w/2+sW/2+wt/2,0,bz+d/2, sW,h,wt, color);
    addBox(g.scene, bx+w/2-sW/2-wt/2,0,bz+d/2, sW,h,wt, color);
    addBox(g.scene, bx,doorH,bz+d/2, doorW,h-doorH,wt, color, false);
    addBox(g.scene, bx-w/2+sW/2+wt/2,0,bz-d/2, sW,h,wt, color);
    addBox(g.scene, bx+w/2-sW/2-wt/2,0,bz-d/2, sW,h,wt, color);
    addBox(g.scene, bx,doorH,bz-d/2, doorW,h-doorH,wt, color, false);
    addBox(g.scene, bx,h,bz, w+0.5,0.25,d+0.5, 0x5a4a3a, false);
  }

  function checkWallCollision(scene, nx, nz) {
    let blocked = false;
    scene.traverse(obj => {
      if (!obj.userData.isWall || !obj.userData.box) return;
      const b = obj.userData.box, m = 0.35;
      if (nx>b.min.x-m && nx<b.max.x+m && nz>b.min.z-m && nz<b.max.z+m) blocked = true;
    });
    return blocked;
  }

  // ===== MESH CREATORS =====
  function createEnemyMesh(scene, x, z, isBoss) {
    const group = new THREE.Group();
    const size = isBoss ? 1.3 : 1;
    const bc = isBoss ? 0x8b3a3a : 0x6b5a42;
    group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.8*size,1.2*size,0.5*size), new THREE.MeshLambertMaterial({color:bc})), {position: new THREE.Vector3(0,1.2*size,0)}));
    group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.5*size,0.5*size,0.5*size), new THREE.MeshLambertMaterial({color:0xc4956a})), {position: new THREE.Vector3(0,2*size,0)}));
    group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.6), new THREE.MeshLambertMaterial({color:0x2a2a2a})), {position: new THREE.Vector3(0.6*size,1.2*size,-0.3*size)}));
    group.position.set(x, 0, z);
    scene.add(group);
    return group;
  }

  function createVehicleMesh(scene, x, z, type) {
    const group = new THREE.Group();
    if (type === 'tank') {
      group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(3.5,1.2,5), new THREE.MeshLambertMaterial({color:0x4a5540})), {position:new THREE.Vector3(0,1,0)}));
      group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.6,0.7,2), new THREE.MeshLambertMaterial({color:0x3a4a35})), {position:new THREE.Vector3(0,2.5,0)}));
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,3.5,6), new THREE.MeshLambertMaterial({color:0x2a2a2a}));
      barrel.rotation.x = Math.PI/2; barrel.position.set(0,2.5,-2.8);
      group.add(barrel);
    } else {
      group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.2,0.6,4), new THREE.MeshLambertMaterial({color:0x5a6450})), {position:new THREE.Vector3(0,0.8,0)}));
      group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2,0.8,1.8), new THREE.MeshLambertMaterial({color:0x4a5a40})), {position:new THREE.Vector3(0,1.5,0.5)}));
    }
    group.position.set(x, 0, z);
    scene.add(group);
    return group;
  }

  function createPlayerMesh(scene, p) {
    const group = new THREE.Group();
    const bc = 0x4a6a8a;
    group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.8,1.2,0.5), new THREE.MeshLambertMaterial({color:bc})), {position:new THREE.Vector3(0,1.2,0)}));
    group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), new THREE.MeshLambertMaterial({color:0xc4956a})), {position:new THREE.Vector3(0,2,0)}));
    // Nametag
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d4a054'; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Player', 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({map:tex, transparent:true, depthTest:false}));
    tag.position.y = 2.8;
    group.add(tag);
    group.position.set(p.x || 0, 0, p.z || 0);
    scene.add(group);
    return group;
  }

  function createTracer(scene, origin, direction, color) {
    const end = origin.clone().add(direction.clone().multiplyScalar(8));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const mat = new THREE.LineBasicMaterial({color, transparent:true, opacity:0.8});
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    let opacity = 0.8;
    const fade = setInterval(() => {
      opacity -= 0.15; mat.opacity = Math.max(0, opacity);
      if (opacity <= 0) { clearInterval(fade); scene.remove(line); geo.dispose(); mat.dispose(); }
    }, 30);
  }

  function spawnItems(g) {
    for (let i = 0; i < 10; i++) {
      const type = ['medkit','bullets','food','water'][Math.floor(Math.random()*4)];
      const colors = {medkit:0xff4444, bullets:0x4a5a3a, food:0x5cc46c, water:0x5ca0c4};
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,0.4), new THREE.MeshLambertMaterial({color:colors[type]}));
      mesh.position.set((Math.random()-0.5)*60, 0.5, (Math.random()-0.5)*60);
      g.scene.add(mesh);
      g.items.push({mesh, type, collected:false});
    }
  }

  // ===== HUD UPDATE =====
  function updateHUD(g) {
    const hp = document.getElementById('healthBar');
    const sp = document.getElementById('staminaBar');
    const sc = document.getElementById('scoreDisplay');
    const ac = document.getElementById('ammoCount');
    const al = document.getElementById('ammoLabel');
    if (!hp) return;
    hp.style.width = (g.health/g.maxHealth*100)+'%';
    sp.style.width = g.stamina+'%';
    sc.textContent = g.score;
    const wp = WEAPON_DATA[g.weapons[g.currentWeapon]];
    ac.textContent = wp.type === 'ranged' ? (g.ammo[wp.ammoKey]||0) : '∞';
    al.textContent = g.weapons[g.currentWeapon].replace(/_/g,' ').toUpperCase();
  }

  // ===== RENDER =====
  const sendChatMsg = () => {
    if (chatInput.trim()) { Network.sendChat(chatInput.trim()); setChatInput(''); }
  };

  return (
    <>
      {/* CONNECTION STATUS */}
      <div className={`conn-status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '● ONLINE' : '○ OFFLINE'}
      </div>

      {/* MAIN MENU */}
      <div className={`screen ${screen === 'menu' ? 'active' : ''}`}>
        <div className="screen-bg" />
        <div className="screen-content">
          <div className="title">WW III</div>
          <div className="subtitle">Multiplayer</div>
          <input className="input-field" placeholder="Your Name" value={playerName} onChange={e => setPlayerName(e.target.value)} maxLength={12} />
          <button className="btn" onClick={() => { Network.listRooms(); setScreen('browse'); }}>Find Game</button>
          <button className="btn" onClick={() => setScreen('create')}>Create Room</button>
        </div>
      </div>

      {/* BROWSE ROOMS */}
      <div className={`screen ${screen === 'browse' ? 'active' : ''}`}>
        <div className="screen-bg" />
        <div className="screen-content scroll-area">
          <div className="section-title">Available Rooms</div>
          <button className="btn small" onClick={() => Network.listRooms()} style={{marginBottom:'1em'}}>Refresh</button>
          <div className="room-list">
            {rooms.length === 0 && <div className="desc">No rooms found. Create one!</div>}
            {rooms.map(r => (
              <div key={r.id} className="room-card" onClick={() => Network.joinRoom(r.id, { name: playerName })}>
                <div><div className="room-name">{r.name}</div><div className="room-info">Level {r.level+1} | {['Easy','Normal','Hard'][r.difficulty]}</div></div>
                <div className="room-info">{r.players}/{r.maxPlayers}</div>
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => setScreen('menu')} style={{opacity:0.6}}>Back</button>
        </div>
      </div>

      {/* CREATE ROOM */}
      <div className={`screen ${screen === 'create' ? 'active' : ''}`}>
        <div className="screen-bg" />
        <div className="screen-content">
          <div className="section-title">Create Room</div>
          <input className="input-field" placeholder="Room Name" value={roomName} onChange={e => setRoomName(e.target.value)} maxLength={20} />
          <button className="btn" onClick={() => Network.createRoom(roomName, 0, 1, { name: playerName })}>Create & Join</button>
          <button className="btn" onClick={() => setScreen('menu')} style={{opacity:0.6}}>Back</button>
        </div>
      </div>

      {/* LOBBY */}
      <div className={`screen ${screen === 'lobby' ? 'active' : ''}`}>
        <div className="screen-bg" />
        <div className="screen-content">
          <div className="section-title">{currentRoom?.name || 'Lobby'}</div>
          <div className="desc">Room Code: {currentRoom?.id} | Level {(currentRoom?.level||0)+1}</div>
          <div className="player-list">
            {currentRoom?.players && Object.values(currentRoom.players).map(p => (
              <div key={p.id} className={`player-entry ${p.id === currentRoom.hostId ? 'host' : ''}`}>
                {p.name}{p.id === currentRoom.hostId && <span className="tag">HOST</span>}
                {p.id === Network.getMyId() && <span className="tag">YOU</span>}
              </div>
            ))}
          </div>
          {currentRoom?.hostId === Network.getMyId() && (
            <button className="btn" onClick={() => Network.startGame()}>Start Game</button>
          )}
          {currentRoom?.hostId !== Network.getMyId() && (
            <div className="desc">Waiting for host to start...</div>
          )}
          <button className="btn" onClick={() => setScreen('menu')} style={{opacity:0.6}}>Leave</button>
        </div>
      </div>

      {/* VICTORY */}
      <div className={`screen ${screen === 'victory' ? 'active' : ''}`}>
        <div className="screen-bg" />
        <div className="screen-content">
          <div className="title" style={{fontSize:'2rem', color:'#5cc46c'}}>TERRITORY RECLAIMED</div>
          <div className="desc">Mission Complete!</div>
          <button className="btn" onClick={() => setScreen('menu')}>Return to Menu</button>
        </div>
      </div>

      {/* GAME CANVAS */}
      <div ref={mountRef} style={{position:'fixed',inset:0,zIndex:1}} />

      {/* DAMAGE FLASH */}
      <div className="damage-flash" id="damageFlash" />

      {/* HUD */}
      <div id="hud">
        <div className="hud-top">
          <div>
            <div className="health-bar"><div className="bar-label">HEALTH</div><div className="bar-outer"><div className="bar-inner health" id="healthBar" style={{width:'100%'}} /></div></div>
            <div className="health-bar" style={{marginTop:6}}><div className="bar-label">STAMINA</div><div className="bar-outer"><div className="bar-inner stamina" id="staminaBar" style={{width:'100%'}} /></div></div>
          </div>
          <div><div className="score-display">SCORE: <span id="scoreDisplay">0</span></div></div>
        </div>
        <div className="crosshair" />
        <div className="hud-bottom">
          <div />
          <div className="ammo-display"><div className="ammo-count" id="ammoCount">24</div><div className="ammo-label" id="ammoLabel">PISTOL</div></div>
        </div>
      </div>

      {/* KILL FEED */}
      <div className="kill-feed">
        {killFeed.map((k, i) => <div key={i} className="kill-entry">{k.text}</div>)}
      </div>

      {/* SCOREBOARD (TAB) */}
      <div className={`scoreboard ${showScoreboard ? 'active' : ''}`}>
        <div className="section-title" style={{fontSize:'1rem'}}>Scoreboard</div>
        <div className="sb-row header"><span>Player</span><span>K/D</span><span>Score</span></div>
        {currentRoom?.players && Object.values(currentRoom.players).map(p => (
          <div key={p.id} className={`sb-row ${p.id === Network.getMyId() ? 'me' : ''}`}>
            <span>{p.name}</span><span>{p.kills||0}/{p.deaths||0}</span><span>{p.score||0}</span>
          </div>
        ))}
      </div>

      {/* CHAT */}
      {screen === 'playing' && (
        <div className="chat-box">
          <div className="chat-messages">
            {chatMessages.map((m, i) => <div key={i} className="chat-msg"><span className="name">{m.sender}: </span>{m.text}</div>)}
          </div>
          <input className={`chat-input ${chatVisible ? 'active' : ''}`} value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { sendChatMsg(); setChatVisible(false); } }}
            placeholder="Type a message..."
          />
        </div>
      )}
    </>
  );
}
