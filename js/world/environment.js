// Environment generation, geometry helpers, and per-level world building.
import { G } from '../state.js';
import { texBrick, texConcrete, texMetal, texWood, texFloor, texGround } from '../engine/textures.js';
import { createBuilding } from './buildings.js';
import { spawnItem } from '../entities/items.js';

const PI = Math.PI;

export function clearLevel() {
  const toRemove = [];
  G.scene.traverse(c => { if (c.userData.levelObj) toRemove.push(c); });
  toRemove.forEach(o => { G.scene.remove(o); if(o.geometry) o.geometry.dispose(); });
  G.enemies = []; G.vehicles = []; G.allies = []; G.items = []; G.loreItems = []; G.projectiles = [];
}

export function createGround(color1, type) {
  const geo = new THREE.PlaneGeometry(600, 600, 30, 30);
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setZ(i, (Math.random() - 0.5) * 0.5);
  }
  geo.computeVertexNormals();
  const gt = texGround(type||'city'); 
  const gClone = gt.clone(); gClone.repeat.set(36,36); gClone.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({ map: gClone, color: color1 });
  const g = new THREE.Mesh(geo, mat);
  g.rotation.x = -PI / 2;
  g.receiveShadow = true;
  g.userData.levelObj = true;
  G.scene.add(g);
  return g;
}

export function addBox(x, y, z, w, h, d, color, isWall = true, texType) {
  const geo = new THREE.BoxGeometry(w, h, d);
  let mat;
  if (texType === 'brick') {
    const t = texBrick().clone(); t.repeat.set(Math.max(1,w/3),Math.max(1,h/3)); t.needsUpdate=true;
    mat = new THREE.MeshLambertMaterial({ map: t, color });
  } else if (texType === 'concrete') {
    const t = texConcrete().clone(); t.repeat.set(Math.max(1,w/4),Math.max(1,h/4)); t.needsUpdate=true;
    mat = new THREE.MeshLambertMaterial({ map: t, color });
  } else if (texType === 'metal') {
    const t = texMetal().clone(); t.repeat.set(Math.max(1,w/2),Math.max(1,h/2)); t.needsUpdate=true;
    mat = new THREE.MeshLambertMaterial({ map: t, color });
  } else if (texType === 'wood') {
    const t = texWood().clone(); t.repeat.set(Math.max(1,w/2),Math.max(1,h/2)); t.needsUpdate=true;
    mat = new THREE.MeshLambertMaterial({ map: t, color });
  } else if (texType === 'floor') {
    const t = texFloor().clone(); t.repeat.set(Math.max(1,w/4),Math.max(1,d/4)); t.needsUpdate=true;
    mat = new THREE.MeshLambertMaterial({ map: t, color });
  } else {
    mat = new THREE.MeshLambertMaterial({ color });
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + h/2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.levelObj = true;
  mesh.userData.isWall = isWall;
  mesh.userData.box = { min: { x: x-w/2, z: z-d/2 }, max: { x: x+w/2, z: z+d/2 } };
  G.scene.add(mesh);
  return mesh;
}

// Add a walkable floor slab (player Y adjusts on it)
export function addFloor(x, y, z, w, d, color, texType) {
  const m = addBox(x, y, z, w, 0.2, d, color, false, texType || 'floor');
  m.userData.isWall = false;
  m.userData.isFloor = true;
  return m;
}

// Add a staircase from bottom Y to top Y
export function addStairs(_scene, sx, sz, topY, bottomY, dir, stairW, maxLen) {
  const rise = topY - bottomY;
  if (rise <= 0) return;
  const stepH = 0.4;
  let steps = Math.max(3, Math.ceil(rise / stepH));
  const stepD = 0.7;
  const w = stairW || 2;
  // Clamp total length to maxLen if provided
  let totalLen = steps * stepD;
  if (maxLen && totalLen > maxLen) {
    steps = Math.floor(maxLen / stepD);
    totalLen = steps * stepD;
  }
  if (steps < 2) return;
  const actualStepH = rise / steps;
  
  for (let i = 0; i < steps; i++) {
    const sy = bottomY + i * actualStepH;
    const oz = dir === 'z' ? (i * stepD) : 0;
    const ox = dir === 'x' ? (i * stepD) : 0;
    const step = addBox(sx + ox, sy, sz + oz, dir === 'z' ? w : stepD, actualStepH, dir === 'z' ? stepD : w, 0x7a7068, false, 'concrete');
    step.userData.isWall = false;
    step.userData.isRamp = true;
    step.userData.isFloor = true;
  }
  // Railings
  if (dir === 'z') {
    addBox(sx - w/2, (topY+bottomY)/2, sz + totalLen/2, 0.06, rise + 0.8, totalLen, 0x6a6560, false, 'metal');
    addBox(sx + w/2, (topY+bottomY)/2, sz + totalLen/2, 0.06, rise + 0.8, totalLen, 0x6a6560, false, 'metal');
  } else {
    addBox(sx + totalLen/2, (topY+bottomY)/2, sz - w/2, totalLen, rise + 0.8, 0.06, 0x6a6560, false, 'metal');
    addBox(sx + totalLen/2, (topY+bottomY)/2, sz + w/2, totalLen, rise + 0.8, 0.06, 0x6a6560, false, 'metal');
  }
}

export function generateEnvironment(type) {
  clearLevel();
  const colors = {
    city: { ground: 0x6a6055, wall: 0x7a6e60, accent: 0x8a7e6e },
    desert: { ground: 0x8a7a60, wall: 0x9a8a70, accent: 0xaa9a80 },
    bunker: { ground: 0x5a5550, wall: 0x6a6560, accent: 0x7a7570 },
    canyon: { ground: 0x9a7a55, wall: 0x9a8a60, accent: 0xaa9a70 },
    airbase: { ground: 0x8a7a60, wall: 0x8a8070, accent: 0x9a9080 },
    ocean: { ground: 0x4a5a6a, wall: 0x5a5a5a, accent: 0x6a6a65 },
    refinery: { ground: 0x5a5550, wall: 0x6a6560, accent: 0x7a7570 },
    trainyard: { ground: 0x6a6055, wall: 0x7a6e60, accent: 0x8a7e6e },
    dam: { ground: 0x5a6a60, wall: 0x6a7a70, accent: 0x7a8a7e },
    highway: { ground: 0x6a6058, wall: 0x7a7068, accent: 0x8a8078 }
  };
  const c = colors[type] || colors.city;
  
  if (type !== 'ocean') {
    createGround(c.ground, type);
    addBox(0, 0, -150, 300, 8, 2, c.wall, true, 'concrete');
    addBox(0, 0, 150, 300, 8, 2, c.wall, true, 'concrete');
    addBox(-150, 0, 0, 2, 8, 300, c.wall, true, 'concrete');
    addBox(150, 0, 0, 2, 8, 300, c.wall, true, 'concrete');
  }
  
  if (type === 'city') {
    const B = [
      // SKYSCRAPERS
      {x:-90,z:-80,w:16,d:14,h:45,floors:7,name:'skyscraper'},{x:80,z:-70,w:14,d:14,h:40,floors:6,name:'skyscraper'},
      {x:0,z:-110,w:18,d:16,h:55,floors:8,name:'skyscraper'},{x:-70,z:90,w:14,d:12,h:35,floors:5,name:'skyscraper'},
      // TALL BUILDINGS
      {x:90,z:80,w:16,d:12,h:24,floors:4,name:'apartment'},{x:-100,z:40,w:14,d:14,h:20,floors:3,name:'office'},
      {x:50,z:-30,w:12,d:12,h:18,floors:3,name:'office'},{x:-40,z:-50,w:14,d:10,h:16,floors:3,name:'apartment'},
      {x:110,z:-20,w:12,d:10,h:14,floors:2,name:'office'},
      // SHOPS
      {x:-30,z:15,w:12,d:10,h:6,floors:1,name:'gunshop'},{x:25,z:20,w:10,d:8,h:5,floors:1,name:'foodstore'},
      {x:-15,z:-25,w:14,d:10,h:6,floors:1,name:'pharmacy'},{x:55,z:35,w:12,d:8,h:5,floors:1,name:'clothing'},
      {x:-55,z:-15,w:10,d:10,h:6,floors:1,name:'electronics'},{x:35,z:-85,w:11,d:9,h:5,floors:1,name:'hardware'},
      // OTHER
      {x:-65,z:100,w:18,d:14,h:10,floors:2,name:'warehouse'},{x:100,z:0,w:14,d:10,h:8,floors:1,name:'hospital'},
      {x:0,z:70,w:16,d:12,h:12,floors:2,name:'tower'},{x:110,z:50,w:14,d:8,h:8,floors:1,name:'garage'},
      {x:-120,z:-10,w:12,d:10,h:8,floors:1,name:'store'},{x:70,z:110,w:10,d:10,h:10,floors:2,name:'apartment'},
    ];
    B.forEach(cfg => createBuilding(cfg.x,cfg.z,cfg.w,cfg.d,cfg.h,cfg.floors,c,cfg.name));
    
    // === ROADS ===
    function road(x,z,w,d){addBox(x,0.02,z,w,0.05,d,0x4a4a4a,false,'concrete');}
    function roadLine(x,z,horiz){
      for(let i=-130;i<130;i+=12){
        if(horiz) addBox(i,0.06,z,5,0.02,0.3,0xaaaa44,false);
        else addBox(x,0.06,i,0.3,0.02,5,0xaaaa44,false);
      }
    }
    road(0,0,280,10); roadLine(0,0,true); // Main E-W
    road(0,0,10,280); roadLine(0,0,false); // Main N-S
    road(0,-65,240,8); road(0,65,240,8); // Secondary E-W
    road(-65,0,8,240); road(65,0,8,240); // Secondary N-S
    // Sidewalks
    [6,-6].forEach(o=>{addBox(0,0.04,o,280,0.08,2,0x7a7a70,false,'concrete');addBox(o,0.04,0,2,0.08,280,0x7a7a70,false,'concrete');});
    
    // === VEHICLE WRECKAGE ===
    for(let i=0;i<20;i++){
      const x=(Math.random()-0.5)*260,z=(Math.random()-0.5)*260;
      let skip=false; B.forEach(b=>{if(Math.abs(x-b.x)<b.w/2+3&&Math.abs(z-b.z)<b.d/2+3)skip=true;}); if(skip||Math.abs(x)<7&&Math.abs(z)<7)continue;
      const r=Math.random();
      if(r<0.3){// Civilian car
        addBox(x,0,z,3.5,1.2,1.8,0x5a5550,false);addBox(x,1.2,z,2.5,0.8,1.6,0x4a4540,false);
      }else if(r<0.5){// Bus
        addBox(x,0,z,2.5,2,6,0x6a5a4a,false);addBox(x,2,z,2.3,1,5.5,0x5a4a3a,false);
      }else if(r<0.65){// Destroyed tank wreck
        addBox(x,0,z,3,1,4.5,0x4a5540,false);addBox(x,1,z,1.5,0.6,1.8,0x3a4535,false);
        const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,2.5,6),new THREE.MeshLambertMaterial({color:0x3a3a3a}));
        barrel.rotation.x=Math.PI/2;barrel.position.set(x,1.5,z-2);barrel.userData.levelObj=true;G.scene.add(barrel);
      }else if(r<0.75){// Helicopter crash
        addBox(x,0,z,2,0.8,5,0x5a5a55,false);
        const rotor=new THREE.Mesh(new THREE.BoxGeometry(8,0.05,0.3),new THREE.MeshLambertMaterial({color:0x4a4a4a}));
        rotor.position.set(x,1.2,z);rotor.rotation.y=Math.random()*PI;rotor.userData.levelObj=true;G.scene.add(rotor);
        const tail=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.6,4),new THREE.MeshLambertMaterial({color:0x5a5a55}));
        tail.position.set(x+3,0.5,z+2);tail.rotation.y=0.4;tail.userData.levelObj=true;G.scene.add(tail);
      }else{// Rubble pile
        addBox(x,0,z,1+Math.random()*2.5,0.3+Math.random()*0.6,1+Math.random()*2.5,c.accent,false);
      }
    }
    
    // === STREET PROPS ===
    for(let i=0;i<15;i++){
      const x=(Math.random()-0.5)*240,z=(Math.random()-0.5)*240;
      const r=Math.random();
      if(r<0.25){// Street light
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,6,6),new THREE.MeshLambertMaterial({color:0x6a6a60}));
        pole.position.set(x,3,z);pole.userData.levelObj=true;G.scene.add(pole);
        const lamp=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.15,0.15),new THREE.MeshBasicMaterial({color:0xddcc88,transparent:true,opacity:0.5}));
        lamp.position.set(x,6,z);lamp.userData.levelObj=true;G.scene.add(lamp);
      }else if(r<0.45){// Traffic light
        const pole2=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,5,6),new THREE.MeshLambertMaterial({color:0x5a5a5a}));
        pole2.position.set(x,2.5,z);pole2.userData.levelObj=true;G.scene.add(pole2);
        addBox(x,4.5,z,0.4,1,0.4,0x3a3a3a,false);
        [0x884444,0x888844,0x448844].forEach((cl,ci)=>{
          const light2=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,6),new THREE.MeshBasicMaterial({color:cl,transparent:true,opacity:0.6}));
          light2.position.set(x,4.8-ci*0.35,z-0.22);light2.userData.levelObj=true;G.scene.add(light2);
        });
      }else if(r<0.6){// Park bench
        addBox(x,0,z,2,0.45,0.5,0x6a5540,false,'wood');
        addBox(x,0.45,z+0.2,2,0.6,0.08,0x6a5540,false,'wood');
      }else if(r<0.72){// Billboard
        const bpole=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,8,6),new THREE.MeshLambertMaterial({color:0x5a5a5a}));
        bpole.position.set(x,4,z);bpole.userData.levelObj=true;G.scene.add(bpole);
        addBox(x,7.5,z,5,3,0.2,0x5a5550,false);
        const bc=document.createElement('canvas');bc.width=256;bc.height=128;const bctx=bc.getContext('2d');
        bctx.fillStyle='#4a4a55';bctx.fillRect(0,0,256,128);
        bctx.fillStyle='#aa8855';bctx.font='bold 32px sans-serif';bctx.textAlign='center';
        bctx.fillText(['EVACUATE NOW','DANGER ZONE','STAY INDOORS','HELP US'][Math.floor(Math.random()*4)],128,75);
        const btex=new THREE.CanvasTexture(bc);
        const bsign=new THREE.Mesh(new THREE.PlaneGeometry(4.8,2.8),new THREE.MeshBasicMaterial({map:btex,side:THREE.DoubleSide}));
        bsign.position.set(x,7.5,z+0.12);bsign.userData.levelObj=true;G.scene.add(bsign);
      }else if(r<0.85){// Road sign
        const spole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,3,6),new THREE.MeshLambertMaterial({color:0x6a6a60}));
        spole.position.set(x,1.5,z);spole.userData.levelObj=true;G.scene.add(spole);
        addBox(x,2.8,z,0.8,0.5,0.05,0x447744,false);
      }else{// Playground swing frame
        addBox(x,0,z,3,2.5,0.1,0x6a5a50,false,'metal');addBox(x,2.5,z,3,0.1,1.5,0x6a5a50,false,'metal');
      }
    }
    
    // === ENVIRONMENTAL DETAILS ===
    for(let i=0;i<12;i++){// Dead trees
      const x=(Math.random()-0.5)*240,z=(Math.random()-0.5)*240;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.25,4+Math.random()*3,5),new THREE.MeshLambertMaterial({color:0x5a4a35}));
      trunk.position.set(x,2,z);trunk.userData.levelObj=true;G.scene.add(trunk);
      for(let b=0;b<3;b++){
        const branch=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.08,1.5+Math.random(),4),new THREE.MeshLambertMaterial({color:0x5a4a35}));
        branch.position.set(x+(Math.random()-0.5)*1.5,3+b*0.7,z+(Math.random()-0.5)*1.5);
        branch.rotation.set(Math.random()-0.5,0,Math.random()-0.5);branch.userData.levelObj=true;G.scene.add(branch);
      }
    }
    for(let i=0;i<8;i++){// Craters
      const x=(Math.random()-0.5)*200,z=(Math.random()-0.5)*200;
      const crater=new THREE.Mesh(new THREE.CylinderGeometry(2+Math.random()*2,3+Math.random()*2,0.4,12),new THREE.MeshLambertMaterial({color:0x3a3530}));
      crater.position.set(x,-0.1,z);crater.userData.levelObj=true;G.scene.add(crater);
      // Crater rim
      const rim=new THREE.Mesh(new THREE.TorusGeometry(2.5+Math.random(),0.3,6,12),new THREE.MeshLambertMaterial({color:0x5a5550}));
      rim.rotation.x=-PI/2;rim.position.set(x,0.1,z);rim.userData.levelObj=true;G.scene.add(rim);
    }
    for(let i=0;i<10;i++){// Sandbag bunkers with ammo
      const x=(Math.random()-0.5)*220,z=(Math.random()-0.5)*220;
      let skip2=false;B.forEach(b=>{if(Math.abs(x-b.x)<b.w/2+3&&Math.abs(z-b.z)<b.d/2+3)skip2=true;});if(skip2)continue;
      addBox(x,0,z,3,1,0.5,0x8a8060,true);addBox(x,0,z-1,3,1,0.5,0x8a8060,true);addBox(x-1.5,0,z-0.5,0.5,1,1.5,0x8a8060,true);
      spawnItem(x,z-0.5,'bullets');
    }
    for(let i=0;i<6;i++){// Burning debris
      const x=(Math.random()-0.5)*200,z=(Math.random()-0.5)*200;
      addBox(x,0,z,1+Math.random()*2,0.5+Math.random(),1+Math.random()*2,0x3a2a1a,false);
      // Fire glow
      const fire=new THREE.PointLight(0xff6622,0.8,8);fire.position.set(x,1.5,z);fire.userData.levelObj=true;G.scene.add(fire);
      const ember=new THREE.Mesh(new THREE.SphereGeometry(0.3,4,4),new THREE.MeshBasicMaterial({color:0xff6622,transparent:true,opacity:0.6}));
      ember.position.set(x,0.8,z);ember.userData.levelObj=true;G.scene.add(ember);
    }
    
    // === LARGE STRUCTURES ===
    // Water tower
    const wtp=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,12,6),new THREE.MeshLambertMaterial({color:0x6a6a60}));
    wtp.position.set(-110,6,80);wtp.userData.levelObj=true;G.scene.add(wtp);
    [[-110.8,80],[-109.2,80],[-110,80.8],[-110,79.2]].forEach(([lx,lz])=>{
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,10,4),new THREE.MeshLambertMaterial({color:0x5a5a5a}));
      leg.position.set(lx,5,lz);leg.userData.levelObj=true;G.scene.add(leg);
    });
    const wtank=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,3,8),new THREE.MeshLambertMaterial({color:0x6a7a6a}));
    wtank.position.set(-110,11,80);wtank.userData.levelObj=true;G.scene.add(wtank);
    // Radio antenna
    const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.15,18,4),new THREE.MeshLambertMaterial({color:0x8a8a8a}));
    ant.position.set(120,-90+9,0);ant.userData.levelObj=true;G.scene.add(ant);
    // Construction crane
    const craneBase=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.4,20,4),new THREE.MeshLambertMaterial({color:0x9a8a40}));
    craneBase.position.set(-30,10,-100);craneBase.userData.levelObj=true;G.scene.add(craneBase);
    const craneArm=new THREE.Mesh(new THREE.BoxGeometry(18,0.3,0.3),new THREE.MeshLambertMaterial({color:0x9a8a40}));
    craneArm.position.set(-25,20,-100);craneArm.userData.levelObj=true;G.scene.add(craneArm);
    // Bridge/overpass
    addBox(0,4,120,60,0.5,8,0x6a6a60,false,'concrete');
    addBox(-30,0,120,1,4,8,0x6a6a60,true,'concrete');addBox(30,0,120,1,4,8,0x6a6a60,true,'concrete');
    addBox(0,4.3,116.5,60,1,0.2,0x5a5a55,false,'metal');addBox(0,4.3,123.5,60,1,0.2,0x5a5a55,false,'metal');
    
  } else if (type === 'desert') {
    const mkRoad = (x,z,w,d) => addBox(x,0.02,z,w,0.05,d,0x5a5550,false,'concrete');
    for(let i=0;i<15;i++){const x=(Math.random()-0.5)*260,z=(Math.random()-0.5)*260;if(Math.abs(x)<8&&Math.abs(z)<8)continue;
      const geo=new THREE.DodecahedronGeometry(2+Math.random()*4,0);const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:c.wall}));
      m.position.set(x,1+Math.random()*2,z);m.rotation.set(Math.random(),Math.random(),Math.random());m.userData.levelObj=true;m.userData.isWall=true;
      m.userData.box={min:{x:x-3,z:z-3},max:{x:x+3,z:z+3}};G.scene.add(m);
    }
    mkRoad(0,0,8,280);
    const dB=[{x:-70,z:-50,w:12,d:8,h:6,floors:1,name:'shack'},{x:60,z:-40,w:14,d:10,h:8,floors:2,name:'outpost'},
      {x:0,z:70,w:16,d:12,h:8,floors:2,name:'depot'},{x:-50,z:50,w:10,d:8,h:5,floors:1,name:'shack'},
      {x:80,z:60,w:12,d:10,h:7,floors:1,name:'outpost'},{x:-90,z:20,w:14,d:10,h:10,floors:2,name:'warehouse'},
      {x:40,z:-90,w:10,d:8,h:6,floors:1,name:'gunshop'},{x:-30,z:-80,w:12,d:8,h:5,floors:1,name:'hardware'}];
    dB.forEach(cfg=>createBuilding(cfg.x,cfg.z,cfg.w,cfg.d,cfg.h,cfg.floors,c,cfg.name));
    for(let i=0;i<8;i++){const x=(Math.random()-0.5)*200,z=(Math.random()-0.5)*200;addBox(x,0,z,4,1.5,2,0x6a5a4a,false);}
    for(let i=0;i<6;i++){const x=(Math.random()-0.5)*200,z=(Math.random()-0.5)*200;
      addBox(x,0,z,3,1,0.5,0x8a8060,true);spawnItem(x,z,'bullets');}
    // Cactuses
    for(let i=0;i<30;i++){const cx=(Math.random()-0.5)*240,cz=(Math.random()-0.5)*240;const ch=2+Math.random()*3;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.25,ch,6),new THREE.MeshLambertMaterial({color:0x4a7a3a}));
      trunk.position.set(cx,ch/2,cz);trunk.userData.levelObj=true;G.scene.add(trunk);
      for(let a=0;a<1+Math.floor(Math.random()*2);a++){const s=(a===0?1:-1);const ay=ch*0.4+Math.random()*ch*0.3;const ah=1+Math.random()*1.5;
        const hA=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,0.8,5),new THREE.MeshLambertMaterial({color:0x4a7a3a}));
        hA.rotation.z=PI/2*s;hA.position.set(cx+s*1.2,ay,cz);hA.userData.levelObj=true;G.scene.add(hA);
        const vA=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,ah,5),new THREE.MeshLambertMaterial({color:0x4a7a3a}));
        vA.position.set(cx+s*1.6,ay+ah/2,cz);vA.userData.levelObj=true;G.scene.add(vA);}
    }
  } else if (type === 'bunker') {
    const vB=[{x:-60,z:-40,w:16,d:12,h:5,floors:1,name:'armory'},{x:60,z:-40,w:14,d:12,h:5,floors:1,name:'barracks'},
      {x:-60,z:40,w:12,d:10,h:5,floors:1,name:'storage'},{x:60,z:40,w:16,d:12,h:5,floors:1,name:'command'},
      {x:0,z:0,w:20,d:16,h:8,floors:2,name:'mainHall'},{x:-60,z:0,w:12,d:10,h:5,floors:1,name:'pharmacy'},
      {x:60,z:0,w:12,d:10,h:5,floors:1,name:'electronics'},{x:0,z:-80,w:14,d:10,h:5,floors:1,name:'gunshop'},
      {x:0,z:80,w:14,d:10,h:5,floors:1,name:'warehouse'}];
    vB.forEach(cfg=>createBuilding(cfg.x,cfg.z,cfg.w,cfg.d,cfg.h,cfg.floors,c,cfg.name));
    addBox(0,0.02,-40,100,0.05,6,0x5a5a55,false,'floor');addBox(0,0.02,40,100,0.05,6,0x5a5a55,false,'floor');
    addBox(-60,0.02,0,6,0.05,60,0x5a5a55,false,'floor');addBox(60,0.02,0,6,0.05,60,0x5a5a55,false,'floor');
    addBox(0,0.02,0,6,0.05,140,0x5a5a55,false,'floor');
    addBox(0,6,0,200,0.3,200,0x4a4845,false);
    for(let px=-80;px<=80;px+=40){const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,200,6),new THREE.MeshLambertMaterial({color:0x6a6a60}));
      pipe.rotation.z=PI/2;pipe.position.set(0,5.5,px);pipe.userData.levelObj=true;G.scene.add(pipe);}
    G.scene.fog=new THREE.FogExp2(0x3a3530,0.012);
  
  } else if (type === 'canyon') {
    // DESERT CANYON — massive layered cliff walls, bridges, mounted guns
    G.scene.background = new THREE.Color(0x9a8060);
    
    // === CANYON WALLS — layered rock faces on both sides ===
    for(let side=-1;side<=1;side+=2){
      // Base layer (wide, low)
      for(let i=0;i<12;i++){
        const z=-130+i*22; const bw=12+Math.random()*8; const bh=25+Math.random()*20;
        addBox(side*(55+Math.random()*5),0,z,bw,bh,18+Math.random()*8,0x9a7a50,true);
      }
      // Second layer (narrower, taller, offset)
      for(let i=0;i<10;i++){
        const z=-125+i*26; const bw=6+Math.random()*6; const bh=15+Math.random()*18;
        addBox(side*(48+Math.random()*8),bh*0.3,z,bw,bh,12+Math.random()*6,0x8a6a45,true);
      }
      // Top jagged rocks (irregular shapes)
      for(let i=0;i<15;i++){
        const z=-130+i*18+Math.random()*10;
        const rx=side*(50+Math.random()*15);
        const geo=new THREE.DodecahedronGeometry(4+Math.random()*5,0);
        const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0x9a7a48}));
        m.position.set(rx,20+Math.random()*15,z);
        m.rotation.set(Math.random(),Math.random(),Math.random());
        m.userData.levelObj=true; G.scene.add(m);
      }
      // Overhanging ledges
      for(let i=0;i<5;i++){
        const z=-100+i*45;
        addBox(side*(40+Math.random()*5),18+Math.random()*8,z,8+Math.random()*4,1.5,6+Math.random()*4,0x8a6a42,false);
      }
    }
    
    // === CANYON FLOOR — sandy path with rocks ===
    addBox(0,0.02,0,30,0.05,280,0x9a8050,false);
    // Scattered boulders on floor
    for(let i=0;i<20;i++){
      const x=(Math.random()-0.5)*35,z=(Math.random()-0.5)*240;
      const geo=new THREE.DodecahedronGeometry(0.8+Math.random()*1.5,0);
      const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0x8a7045}));
      m.position.set(x,0.5+Math.random(),z);m.rotation.set(Math.random(),Math.random(),Math.random());
      m.userData.levelObj=true;G.scene.add(m);
    }
    // Rock pillars in the canyon
    for(let i=0;i<8;i++){const x=(Math.random()-0.5)*30,z=(Math.random()-0.5)*220;
      const ph=10+Math.random()*12;
      const pillar=new THREE.Mesh(new THREE.CylinderGeometry(1+Math.random()*1.5,2+Math.random()*2,ph,6),new THREE.MeshLambertMaterial({color:0x9a7a4a}));
      pillar.position.set(x,ph/2,z);pillar.userData.levelObj=true;pillar.userData.isWall=true;
      pillar.userData.box={min:{x:x-2.5,z:z-2.5},max:{x:x+2.5,z:z+2.5}};G.scene.add(pillar);
      // Cap rock
      const cap=new THREE.Mesh(new THREE.DodecahedronGeometry(2+Math.random(),0),new THREE.MeshLambertMaterial({color:0x8a6a40}));
      cap.position.set(x,ph+1,z);cap.userData.levelObj=true;G.scene.add(cap);
    }
    
    // === HIGHWAY OVERPASSES on pillars connecting canyon walls ===
    [{z:-80,y:12},{z:10,y:9},{z:70,y:14},{z:-20,y:8}].forEach(bp => {
      // Concrete road deck spanning wall to wall
      const deck=addBox(0,bp.y,bp.z,90,0.5,6,0x6a6a65,false,'concrete');
      deck.userData.isFloor=true;deck.userData.isRamp=true;deck.userData.isWall=false;
      // Guardrails
      addBox(0,bp.y+0.5,bp.z-3.2,90,1,0.12,0x6a6a60,false,'metal');
      addBox(0,bp.y+0.5,bp.z+3.2,90,1,0.12,0x6a6a60,false,'metal');
      // Lane markings
      for(let lx=-40;lx<40;lx+=8){addBox(lx,bp.y+0.28,bp.z,3,0.02,0.3,0xaaaa55,false);}
      // Support pillars from ground to deck
      for(let px=-30;px<=30;px+=15){
        const pil=new THREE.Mesh(new THREE.CylinderGeometry(0.8,1.1,bp.y,8),new THREE.MeshLambertMaterial({color:0x7a7a75}));
        pil.position.set(px,bp.y/2,bp.z);pil.userData.levelObj=true;pil.userData.isWall=true;
        pil.userData.box={min:{x:px-1.2,z:bp.z-1.2},max:{x:px+1.2,z:bp.z+1.2}};G.scene.add(pil);
        // Wider cap where pillar meets road
        addBox(px,bp.y-0.4,bp.z,2.8,0.4,7,0x7a7a75,false,'concrete');
      }
      // Abutments where road meets canyon walls
      [-44,44].forEach(ax=>{addBox(ax,bp.y/2,bp.z,6,bp.y,8,0x8a7a55,true);});
    });
    
    // === CACTUSES ===
    for(let i=0;i<25;i++){
      const cx=(Math.random()-0.5)*35,cz=(Math.random()-0.5)*240;
      const ch=2+Math.random()*3;
      // Main trunk
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.25,ch,6),new THREE.MeshLambertMaterial({color:0x4a7a3a}));
      trunk.position.set(cx,ch/2,cz);trunk.userData.levelObj=true;G.scene.add(trunk);
      // Arms (1-2 per cactus)
      const arms=1+Math.floor(Math.random()*2);
      for(let a=0;a<arms;a++){
        const side=(a===0?1:-1)*(0.3);
        const armH=1+Math.random()*1.5;
        const ay=ch*0.4+Math.random()*ch*0.3;
        // Horizontal bit
        const hArm=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,0.8,5),new THREE.MeshLambertMaterial({color:0x4a7a3a}));
        hArm.rotation.z=PI/2*side/Math.abs(side);hArm.position.set(cx+side*1.2,ay,cz);hArm.userData.levelObj=true;G.scene.add(hArm);
        // Vertical bit going up
        const vArm=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,armH,5),new THREE.MeshLambertMaterial({color:0x4a7a3a}));
        vArm.position.set(cx+side*1.6,ay+armH/2,cz);vArm.userData.levelObj=true;G.scene.add(vArm);
      }
    }
    
    // === BIG MOUNTED GUNS ===
    [{x:-8,z:-90},{x:10,z:-30},{x:-5,z:50},{x:8,z:110},{x:0,z:-130},{x:-10,z:130}].forEach(gp=>{
      for(let a=0;a<6;a++){const ang=a/6*PI*2;addBox(gp.x+Math.cos(ang)*2.5,0,gp.z+Math.sin(ang)*2.5,1.5,1,0.6,0x8a8060,true);}
      const mount=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.3,1.2,6),new THREE.MeshLambertMaterial({color:0x4a4a4a}));
      mount.position.set(gp.x,0.9,gp.z);mount.userData.levelObj=true;G.scene.add(mount);
      const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.12,3,6),new THREE.MeshLambertMaterial({color:0x3a3a3a}));
      barrel.rotation.x=PI/2;barrel.position.set(gp.x,1.3,gp.z-1.8);barrel.userData.levelObj=true;G.scene.add(barrel);
      addBox(gp.x+1,0,gp.z+0.5,0.6,0.4,0.4,0x4a5a3a,false,'metal');spawnItem(gp.x+1,gp.z+0.5,'bullets');
      addBox(gp.x,0.8,gp.z-0.8,1.5,0.8,0.1,0x5a5a55,false,'metal');
    });
    
    for(let i=0;i<4;i++){spawnItem((Math.random()-0.5)*25,(Math.random()-0.5)*200,'medkit');}
    G.scene.fog=new THREE.FogExp2(0x9a8060,0.004);
  
  } else if (type === 'airbase') {
    // DESERT AIRBASE — runways, hangars, control tower
    G.scene.background = new THREE.Color(0x9a8868);
    // Main runway
    addBox(0,0.02,0,15,0.06,250,0x5a5a5a,false,'concrete');
    for(let rz=-120;rz<120;rz+=8){addBox(0,0.06,rz,1,0.02,4,0xcccc88,false);}//center line
    // Taxiway
    addBox(40,0.02,0,8,0.05,200,0x5a5a58,false,'concrete');
    // Hangars (big open buildings)
    [{x:-50,z:-60,w:24,d:18,h:10,floors:1,name:'warehouse'},{x:-50,z:60,w:24,d:18,h:10,floors:1,name:'warehouse'}].forEach(b=>createBuilding(b.x,b.z,b.w,b.d,b.h,b.floors,c,b.name));
    // Control tower
    createBuilding(60,-20,10,10,20,4,c,'skyscraper');
    // Barracks & shops
    [{x:60,z:40,w:14,d:10,h:6,floors:1,name:'barracks'},{x:60,z:80,w:10,d:8,h:5,floors:1,name:'gunshop'},
     {x:-60,z:0,w:12,d:8,h:5,floors:1,name:'pharmacy'}].forEach(b=>createBuilding(b.x,b.z,b.w,b.d,b.h,b.floors,c,b.name));
    // Destroyed planes on runway
    for(let i=0;i<4;i++){const z=-80+i*50;
      addBox(5+Math.random()*8,0,z,3,1,8,0x6a6a65,false);// fuselage
      addBox(5+Math.random()*8,0.8,z,12,0.15,2,0x6a6a65,false);// wings
      addBox(5+Math.random()*8,1.5,z+3.5,1.5,1.2,1.5,0x5a5a55,false);// cockpit
    }
    // Radar dish
    const dish=new THREE.Mesh(new THREE.SphereGeometry(3,8,6,0,PI*2,0,PI/2),new THREE.MeshLambertMaterial({color:0x8a8a8a,side:THREE.DoubleSide}));
    dish.position.set(-80,8,0);dish.rotation.x=PI/4;dish.userData.levelObj=true;G.scene.add(dish);
    const dishPole=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,8,6),new THREE.MeshLambertMaterial({color:0x6a6a6a}));
    dishPole.position.set(-80,4,0);dishPole.userData.levelObj=true;G.scene.add(dishPole);
    for(let i=0;i<8;i++){const x=(Math.random()-0.5)*180,z=(Math.random()-0.5)*180;addBox(x,0,z,3,1,0.5,0x8a8060,true);spawnItem(x,z,'bullets');}
    // Cactuses
    for(let i=0;i<15;i++){const cx=(Math.random()-0.5)*180,cz=(Math.random()-0.5)*180;const ch=2+Math.random()*2.5;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.22,ch,6),new THREE.MeshLambertMaterial({color:0x4a7a3a}));
      trunk.position.set(cx,ch/2,cz);trunk.userData.levelObj=true;G.scene.add(trunk);
      const hA=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,0.7,5),new THREE.MeshLambertMaterial({color:0x4a7a3a}));
      hA.rotation.z=PI/2;hA.position.set(cx+1,ch*0.5,cz);hA.userData.levelObj=true;G.scene.add(hA);
      const vA=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,1+Math.random(),5),new THREE.MeshLambertMaterial({color:0x4a7a3a}));
      vA.position.set(cx+1.4,ch*0.5+0.5,cz);vA.userData.levelObj=true;G.scene.add(vA);
    }
    G.scene.fog=new THREE.FogExp2(0x9a8868,0.004);
  
  } else if (type === 'ocean') {
    // STORMY OCEAN BATTLESHIP
    G.scene.background = new THREE.Color(0x2a3a4a);
    // Ocean water plane
    const waterGeo=new THREE.PlaneGeometry(600,600,40,40);
    const waterPos=waterGeo.attributes.position;
    for(let i=0;i<waterPos.count;i++){waterPos.setZ(i,(Math.random()-0.5)*1.5);}
    waterGeo.computeVertexNormals();
    const water=new THREE.Mesh(waterGeo,new THREE.MeshLambertMaterial({color:0x2a4a5a}));
    water.rotation.x=-PI/2;water.position.y=-1;water.userData.levelObj=true;G.scene.add(water);
    // YOUR BATTLESHIP (main platform)
    addBox(0,0,0,20,2,80,0x5a5a5a,false,'metal');// hull
    addBox(0,2,0,18,0.3,78,0x6a6a65,false,'metal');// deck
    addFloor(0,2,0,18,78,0x6a6a65,'metal');
    // Superstructure (bridge tower)
    addBox(0,2,10,10,8,12,0x5a5a5a,true,'metal');
    addBox(0,10,10,8,3,8,0x5a5a55,true,'metal');
    addBox(0,13,10,4,2,4,0x5a5a55,true,'metal');// bridge windows
    addStairs(G.scene,4,6,10,2,'z',2,8);
    // Big gun turrets
    [[-25],[25]].forEach(([tz])=>{
      addBox(0,2.3,tz,5,1.5,5,0x5a5a55,false,'metal');// turret base
      const barrel1=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.35,8,6),new THREE.MeshLambertMaterial({color:0x4a4a4a}));
      barrel1.rotation.x=PI/2;barrel1.position.set(-1,4,tz-(tz>0?5:-5));barrel1.userData.levelObj=true;G.scene.add(barrel1);
      const barrel2=barrel1.clone();barrel2.position.x=1;barrel2.userData.levelObj=true;G.scene.add(barrel2);
    });
    // Anti-air guns
    [-15,0,15].forEach(tz=>{[-8,8].forEach(tx=>{
      addBox(tx,2.3,tz,1,0.8,1,0x5a5a55,false,'metal');
      const aa=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,2,6),new THREE.MeshLambertMaterial({color:0x4a4a4a}));
      aa.rotation.x=PI/2.5;aa.position.set(tx,3.5,tz);aa.userData.levelObj=true;G.scene.add(aa);
    });});
    // Below deck rooms
    createBuilding(0,-35,14,10,4,1,{wall:0x5a5a5a,accent:0x6a6a65},'barracks');
    createBuilding(0,30,14,10,4,1,{wall:0x5a5a5a,accent:0x6a6a65},'armory');
    // Ammo crates on deck
    for(let i=0;i<8;i++){const x=(Math.random()-0.5)*14,z=(Math.random()-0.5)*60;
      addBox(x,2.3,z,0.8,0.8,0.8,0x4a5a3a,false,'wood');spawnItem(x,z,Math.random()>0.5?'bullets':'medkit');}
    // Storm lighting
    const stormLight=new THREE.DirectionalLight(0x6688aa,0.5);stormLight.position.set(-10,20,-10);stormLight.userData.levelObj=true;G.scene.add(stormLight);
    G.scene.fog=new THREE.FogExp2(0x2a3a4a,0.008);
  
  } else if (type === 'refinery') {
    // OIL REFINERY / INDUSTRIAL PLANT
    G.scene.background = new THREE.Color(0x5a5550);
    // Pipes everywhere
    for(let i=0;i<20;i++){
      const x=(Math.random()-0.5)*200,z=(Math.random()-0.5)*200,h2=4+Math.random()*8;
      const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.2+Math.random()*0.3,0.2+Math.random()*0.3,h2,6),new THREE.MeshLambertMaterial({color:0x6a6a65}));
      pipe.position.set(x,h2/2,z);pipe.userData.levelObj=true;G.scene.add(pipe);
      // Horizontal connecting pipes
      if(Math.random()>0.5){const hp=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,8+Math.random()*10,6),new THREE.MeshLambertMaterial({color:0x6a6a60}));
        hp.rotation.z=PI/2;hp.position.set(x,h2*0.7,z);hp.userData.levelObj=true;G.scene.add(hp);}
    }
    // Storage tanks (big cylinders)
    for(let i=0;i<6;i++){const x=-80+i*32,z=-60+Math.random()*40;
      const tank2=new THREE.Mesh(new THREE.CylinderGeometry(5,5,8,12),new THREE.MeshLambertMaterial({color:0x7a7a75}));
      tank2.position.set(x,4,z);tank2.userData.levelObj=true;tank2.userData.isWall=true;
      tank2.userData.box={min:{x:x-5,z:z-5},max:{x:x+5,z:z+5}};G.scene.add(tank2);}
    // Buildings
    [{x:-60,z:60,w:16,d:12,h:10,floors:2,name:'office'},{x:60,z:60,w:14,d:10,h:8,floors:2,name:'warehouse'},
     {x:0,z:80,w:10,d:8,h:6,floors:1,name:'gunshop'},{x:-80,z:-80,w:12,d:10,h:6,floors:1,name:'pharmacy'}].forEach(b=>createBuilding(b.x,b.z,b.w,b.d,b.h,b.floors,c,b.name));
    // Catwalks (elevated walkways between tanks)
    addFloor(0,6,0,80,3,0x6a6a60,'metal');addFloor(-40,6,-30,3,40,0x6a6a60,'metal');addFloor(40,6,-30,3,40,0x6a6a60,'metal');
    addStairs(G.scene,-38,-50,6,0,'z',2.5,8);addStairs(G.scene,38,-50,6,0,'z',2.5,8);
    // Burning gas flare
    for(let i=0;i<3;i++){const fx=(Math.random()-0.5)*100,fz=(Math.random()-0.5)*100;
      const flare=new THREE.PointLight(0xff6622,1,15);flare.position.set(fx,10,fz);flare.userData.levelObj=true;G.scene.add(flare);
      const fv=new THREE.Mesh(new THREE.SphereGeometry(0.5,4,4),new THREE.MeshBasicMaterial({color:0xff6622,transparent:true,opacity:0.7}));
      fv.position.set(fx,10,fz);fv.userData.levelObj=true;G.scene.add(fv);}
    // Roads
    addBox(0,0.02,0,8,0.05,280,0x4a4a4a,false,'concrete');addBox(0,0.02,0,280,0.05,8,0x4a4a4a,false,'concrete');
    for(let i=0;i<10;i++){const x=(Math.random()-0.5)*180,z=(Math.random()-0.5)*180;addBox(x,0,z,3,1,0.5,0x8a8060,true);spawnItem(x,z,'bullets');}
    G.scene.fog=new THREE.FogExp2(0x5a5550,0.006);
  
  } else if (type === 'trainyard') {
    // TRAIN YARD WITH DERAILED TRAINS
    G.scene.background = new THREE.Color(0x5a5a55);
    // Rail tracks
    for(let tx=-60;tx<=60;tx+=15){
      addBox(tx,0.02,0,1.5,0.04,280,0x5a4a3a,false,'metal');// rail bed
      addBox(tx-0.6,0.06,0,0.1,0.06,280,0x6a6a60,false,'metal');// left rail
      addBox(tx+0.6,0.06,0,0.1,0.06,280,0x6a6a60,false,'metal');// right rail
      // Sleepers
      for(let sz=-130;sz<130;sz+=3){addBox(tx,0.02,sz,2,0.06,0.3,0x5a4a35,false,'wood');}
    }
    // Derailed train cars
    for(let i=0;i<5;i++){const tx=-45+i*20,tz=-60+Math.random()*120;const tilt=Math.random()*0.3-0.15;
      // Car body
      const car=new THREE.Mesh(new THREE.BoxGeometry(3,3,12),new THREE.MeshLambertMaterial({color:[0x8a4a3a,0x4a6a4a,0x4a4a6a,0x6a6a4a,0x5a5a5a][i%5]}));
      car.position.set(tx,1.8,tz);car.rotation.z=tilt;car.userData.levelObj=true;car.userData.isWall=true;
      car.userData.box={min:{x:tx-2,z:tz-7},max:{x:tx+2,z:tz+7}};G.scene.add(car);
      // Wheels
      for(let wz=-4;wz<=4;wz+=4){[-1.3,1.3].forEach(wx=>{
        const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.2,8),new THREE.MeshLambertMaterial({color:0x3a3a3a}));
        wh.rotation.z=PI/2;wh.position.set(tx+wx,0.4,tz+wz);wh.userData.levelObj=true;G.scene.add(wh);
      });}
    }
    // Overturned locomotive
    const loco=new THREE.Mesh(new THREE.BoxGeometry(3.5,3.5,16),new THREE.MeshLambertMaterial({color:0x3a3a3a}));
    loco.position.set(15,2.5,-20);loco.rotation.z=0.8;loco.userData.levelObj=true;loco.userData.isWall=true;
    loco.userData.box={min:{x:12,z:-28},max:{x:18,z:-12}};G.scene.add(loco);
    const locoFront=new THREE.Mesh(new THREE.BoxGeometry(3,2,3),new THREE.MeshLambertMaterial({color:0x5a5a55}));
    locoFront.position.set(15,4,-28);locoFront.rotation.z=0.8;locoFront.userData.levelObj=true;G.scene.add(locoFront);
    // Station building
    createBuilding(80,0,18,14,10,2,c,'warehouse');
    createBuilding(-80,0,14,10,8,2,c,'office');
    createBuilding(0,80,10,8,5,1,c,'gunshop');
    // Signal towers
    for(let sx=-40;sx<=40;sx+=40){
      const sp=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,8,6),new THREE.MeshLambertMaterial({color:0x5a5a55}));
      sp.position.set(sx,4,-100);sp.userData.levelObj=true;G.scene.add(sp);
      const sl=new THREE.Mesh(new THREE.SphereGeometry(0.3,6,6),new THREE.MeshBasicMaterial({color:0xaa3333}));
      sl.position.set(sx,8,-100);sl.userData.levelObj=true;G.scene.add(sl);}
    for(let i=0;i<8;i++){const x=(Math.random()-0.5)*160,z=(Math.random()-0.5)*200;addBox(x,0,z,3,1,0.5,0x8a8060,true);spawnItem(x,z,'bullets');}
    G.scene.fog=new THREE.FogExp2(0x5a5a55,0.005);
  
  } else if (type === 'dam') {
    // DAM / HYDROELECTRIC PLANT
    G.scene.background = new THREE.Color(0x5a6a6a);
    // Dam wall (massive concrete structure)
    addBox(0,0,0,120,30,6,0x7a7a75,true,'concrete');
    // Dam top (walkway)
    addFloor(0,30,0,120,8,0x7a7a75,'concrete');
    addBox(0,30,4,120,1.2,0.15,0x6a6a60,false,'metal');// railing front
    addBox(0,30,-4,120,1.2,0.15,0x6a6a60,false,'metal');// railing back
    addStairs(G.scene,-55,-10,30,0,'z',3,20);addStairs(G.scene,55,-10,30,0,'z',3,20);
    // Water below (behind dam)
    const waterGeo2=new THREE.PlaneGeometry(200,200);
    const water2=new THREE.Mesh(waterGeo2,new THREE.MeshLambertMaterial({color:0x3a5a6a}));
    water2.rotation.x=-PI/2;water2.position.set(0,-1,60);water2.userData.levelObj=true;G.scene.add(water2);
    // Power plant building at base
    createBuilding(-30,-30,18,14,12,2,c,'office');
    createBuilding(30,-30,16,12,10,2,c,'warehouse');
    createBuilding(0,-60,12,10,6,1,c,'electronics');
    // Turbine room
    for(let tx=-20;tx<=20;tx+=10){
      const turbine=new THREE.Mesh(new THREE.CylinderGeometry(3,3,4,12),new THREE.MeshLambertMaterial({color:0x5a6a5a}));
      turbine.position.set(tx,2,-15);turbine.userData.levelObj=true;G.scene.add(turbine);
    }
    // Transmission towers
    for(let i=0;i<3;i++){const tx=-40+i*40;
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.4,18,4),new THREE.MeshLambertMaterial({color:0x6a6a65}));
      tower.position.set(tx,9,-80);tower.userData.levelObj=true;G.scene.add(tower);
      // Power lines
      if(i<2){const line=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,42,4),new THREE.MeshLambertMaterial({color:0x3a3a3a}));
        line.rotation.z=PI/2;line.position.set(tx+20,16,-80);line.userData.levelObj=true;G.scene.add(line);}
    }
    for(let i=0;i<6;i++){const x=(Math.random()-0.5)*100,z=-30+(Math.random()-0.5)*60;addBox(x,0,z,3,1,0.5,0x8a8060,true);spawnItem(x,z,'bullets');}
    G.scene.fog=new THREE.FogExp2(0x5a6a6a,0.005);
  
  } else if (type === 'highway') {
    // COLLAPSED HIGHWAY OVERPASS MAZE
    G.scene.background = new THREE.Color(0x6a6058);
    // Ground-level road
    addBox(0,0.02,0,280,0.05,20,0x4a4a4a,false,'concrete');
    // Collapsed overpass sections at various heights/angles
    for(let i=0;i<8;i++){const x=-100+i*30,z=(Math.random()-0.5)*40;const h2=4+Math.random()*6;const tilt=Math.random()*0.15-0.075;
      const slab=new THREE.Mesh(new THREE.BoxGeometry(25,0.8,12),new THREE.MeshLambertMaterial({color:0x7a7a70}));
      slab.position.set(x,h2,z);slab.rotation.z=tilt;slab.rotation.x=(Math.random()-0.5)*0.1;
      slab.userData.levelObj=true;G.scene.add(slab);
      // Support pillars (some broken)
      if(Math.random()>0.3){
        const pil=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.8,h2,6),new THREE.MeshLambertMaterial({color:0x7a7a75}));
        pil.position.set(x-8,h2/2,z);pil.userData.levelObj=true;pil.userData.isWall=true;
        pil.userData.box={min:{x:x-9,z:z-1},max:{x:x-7,z:z+1}};G.scene.add(pil);
      }
      if(Math.random()>0.3){
        const pil2=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.8,h2,6),new THREE.MeshLambertMaterial({color:0x7a7a75}));
        pil2.position.set(x+8,h2/2,z);pil2.userData.levelObj=true;pil2.userData.isWall=true;
        pil2.userData.box={min:{x:x+7,z:z-1},max:{x:x+9,z:z+1}};G.scene.add(pil2);
      }
      // Make some walkable
      if(i%2===0){const fl=addFloor(x,h2+0.4,z,24,10,0x7a7a70,'concrete');
        addStairs(G.scene,x-10,z-4,h2+0.4,0,'z',2.5,h2*1.5);}
      // Rebar hanging down
      for(let r=0;r<3;r++){const rb=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2+Math.random()*3,4),new THREE.MeshLambertMaterial({color:0x6a5a4a}));
        rb.position.set(x+(Math.random()-0.5)*20,h2-1.5,z+(Math.random()-0.5)*8);rb.userData.levelObj=true;G.scene.add(rb);}
    }
    // Concrete barriers everywhere
    for(let i=0;i<20;i++){const x=(Math.random()-0.5)*220,z=(Math.random()-0.5)*100;
      addBox(x,0,z,3+Math.random()*2,1.2,0.6,0x7a7a70,true,'concrete');}
    // Destroyed vehicles under/on overpass
    for(let i=0;i<12;i++){const x=(Math.random()-0.5)*200,z=(Math.random()-0.5)*80;
      addBox(x,0,z,3.5,1.2,1.8,0x5a5550,false);addBox(x,1.2,z,2.5,0.8,1.6,0x4a4540,false);}
    // Small buildings at edges
    [{x:-100,z:60,w:12,d:10,h:8,floors:2,name:'office'},{x:100,z:-50,w:10,d:8,h:6,floors:1,name:'gunshop'},
     {x:0,z:70,w:14,d:10,h:6,floors:1,name:'pharmacy'}].forEach(b=>createBuilding(b.x,b.z,b.w,b.d,b.h,b.floors,c,b.name));
    for(let i=0;i<8;i++){const x=(Math.random()-0.5)*180,z=(Math.random()-0.5)*80;addBox(x,0,z,3,1,0.5,0x8a8060,true);spawnItem(x,z,'bullets');}
    G.scene.fog=new THREE.FogExp2(0x6a6058,0.005);
  }
  if (!['bunker','canyon','airbase','ocean','refinery','trainyard','dam','highway'].includes(type)) G.scene.fog = new THREE.FogExp2(0x6a5a48, 0.005);
}
