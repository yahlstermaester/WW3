// Building generator with working stairs, windows, loot, furniture.
import { G } from '../state.js';
import { addBox, addFloor, addStairs } from './environment.js';
import { spawnItem } from '../entities/items.js';

export function createBuilding(bx, bz, w, d, h, floors, c, name) {
  const wt=0.4;
  const wallColor=name==='hospital'?0x607060:name==='skyscraper'?0x6a6a70:name==='gunshop'?0x5a6a5a:name==='pharmacy'?0x606a68:name==='foodstore'?0x6a6a5a:c.wall;
  const trimColor=name==='hospital'?0x5a7a6a:name==='skyscraper'?0x5a5a65:0x6a5a4a;
  const doorW=3.5,doorH=3;
  const frontZ=bz+d/2,backZ=bz-d/2,leftX=bx-w/2,rightX=bx+w/2;
  const sideW=(w-doorW)/2;
  const wallTex=name==='skyscraper'||name==='hospital'?'concrete':'brick';
  const floorH=h/Math.max(floors,1);
  
  // OUTER WALLS
  addBox(leftX,0,bz,wt,h,d,wallColor,true,wallTex);
  addBox(rightX,0,bz,wt,h,d,wallColor,true,wallTex);
  addBox(leftX+sideW/2+wt/2,0,frontZ,sideW,h,wt,wallColor,true,wallTex);
  addBox(rightX-sideW/2-wt/2,0,frontZ,sideW,h,wt,wallColor,true,wallTex);
  addBox(bx,doorH,frontZ,doorW,h-doorH,wt,wallColor,false,wallTex);
  addBox(leftX+sideW/2+wt/2,0,backZ,sideW,h,wt,wallColor,true,wallTex);
  addBox(rightX-sideW/2-wt/2,0,backZ,sideW,h,wt,wallColor,true,wallTex);
  addBox(bx,doorH,backZ,doorW,h-doorH,wt,wallColor,false,wallTex);
  addBox(bx,0,frontZ+0.15,doorW+0.5,doorH+0.2,0.12,trimColor,false,'metal');
  addBox(bx,0,backZ-0.15,doorW+0.5,doorH+0.2,0.12,trimColor,false,'metal');
  
  // GROUND FLOOR
  addFloor(bx,-0.02,bz,w-0.5,d-0.5,0x7a7568,'floor');
  
  // UPPER FLOORS + WORKING STAIRS (only for 2+ floor buildings)
  if (floors >= 2) {
    // Stair position: inside building, away from walls
    const stairX = rightX - Math.min(3, w/2 - 0.8); // keep away from right wall
    const stairStartZ = backZ + 1.5; // start away from back wall
    const maxStairLen = d - 3; // don't exceed building depth minus margins
    
    for(let f=1;f<floors;f++){
      const fy=f*floorH;
      addFloor(bx,fy,bz,w-1,d-1,0x7a7568,'floor');
      addStairs(G.scene, stairX, stairStartZ, fy, (f-1)*floorH, 'z', Math.min(2, w/2-1), maxStairLen);
    }
    // Stairs from top floor to roof
    addStairs(G.scene, stairX, stairStartZ, h-0.3, (floors-1)*floorH, 'z', Math.min(2, w/2-1), maxStairLen);
  }
  
  // WALKABLE ROOF with railings
  addFloor(bx,h-0.1,bz,w+0.5,d+0.5,trimColor,'concrete');
  addBox(bx,h,frontZ+0.3,w+0.5,1,0.1,0x6a6a60,false,'metal');
  addBox(bx,h,backZ-0.3,w+0.5,1,0.1,0x6a6a60,false,'metal');
  addBox(leftX-0.3,h,bz,0.1,1,d+0.5,0x6a6a60,false,'metal');
  addBox(rightX+0.3,h,bz,0.1,1,d+0.5,0x6a6a60,false,'metal');
  
  // INTERIOR DIVIDERS per floor
  if(w>10){for(let f=0;f<floors;f++){const fy=f*floorH;const pl=(d-doorW-2)/2;
    if(pl>0.5){addBox(bx,fy,bz-d/4,wt,floorH,pl,wallColor,true,wallTex);addBox(bx,fy,bz+d/4,wt,floorH,pl,wallColor,true,wallTex);}}}
  
  // WINDOWS per floor
  const nw=Math.max(1,Math.floor(w/5));
  for(let i=0;i<nw;i++){const wx=leftX+(i+1)*(w/(nw+1));
    for(let f=0;f<floors;f++){const wy=f*floorH+floorH*0.6;
      [frontZ+0.22,backZ-0.22].forEach(wz=>{
        const wm=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.5),new THREE.MeshLambertMaterial({color:0x3a5a7a,side:THREE.DoubleSide,transparent:true,opacity:0.6}));
        wm.position.set(wx,wy,wz);wm.userData.levelObj=true;G.scene.add(wm);});}}
  
  // SHOP SIGN
  const shopNames={gunshop:'GUN SHOP',foodstore:'FOOD MART',pharmacy:'PHARMACY',clothing:'CLOTHING',electronics:'ELECTRONICS',hardware:'HARDWARE'};
  if(shopNames[name]){
    const sc2=document.createElement('canvas');sc2.width=512;sc2.height=96;const sx=sc2.getContext('2d');
    sx.fillStyle=name==='gunshop'?'#3a5a3a':name==='pharmacy'?'#3a5a5a':name==='foodstore'?'#5a5a3a':'#4a4a5a';
    sx.fillRect(0,0,512,96);sx.fillStyle='#ddddaa';sx.font='bold 48px sans-serif';sx.textAlign='center';sx.fillText(shopNames[name],256,64);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(w*0.7,1.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc2),side:THREE.DoubleSide}));
    sign.position.set(bx,h-1,frontZ+0.3);sign.userData.levelObj=true;G.scene.add(sign);
  }
  
  // LOOT (shops give themed loot)
  const nl=Math.floor(2+Math.random()*3+floors);
  for(let i=0;i<nl;i++){const lx=bx+(Math.random()-0.5)*(w-3),lz=bz+(Math.random()-0.5)*(d-3);
    const lt2=name==='gunshop'?'bullets':name==='pharmacy'||name==='hospital'?'medkit':name==='foodstore'?'food':Math.random()>0.45?'bullets':'medkit';
    spawnItem(lx,lz,lt2);}
  if(Math.random()>0.3)spawnItem(bx+(Math.random()-0.5)*(w-4),bz+(Math.random()-0.5)*(d-4),Math.random()>0.5?'food':'water');
  
  // FURNITURE per floor
  for(let f=0;f<floors;f++){const fc2=Math.floor(3+Math.random()*3);
    for(let i=0;i<fc2;i++){const fx=bx+(Math.random()-0.5)*(w-4),fz=bz+(Math.random()-0.5)*(d-4),fy=f*floorH;const ft=Math.random();
      if(ft<0.2)addBox(fx,fy,fz,1.5,0.8,0.8,0x6a5a4a,false,'wood');
      else if(ft<0.35)addBox(fx,fy,fz,0.4,1.8,1.2,0x5a5a5a,false,'metal');
      else if(ft<0.5)addBox(fx,fy,fz,0.8,0.8,0.8,0x6a5f45,false,'wood');
      else if(ft<0.65){const b=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,1,8),new THREE.MeshLambertMaterial({color:0x5a6a5a}));b.position.set(fx,fy+0.5,fz);b.userData.levelObj=true;G.scene.add(b);}
      else if(ft<0.8){addBox(fx,fy,fz,1.2,0.75,0.6,0x5a5550,false,'wood');addBox(fx,fy+0.75,fz-0.15,0.5,0.4,0.05,0x2a2a2a,false);}
      else addBox(fx,fy,fz,1.8,0.2,0.9,0x6a6560,false);}}
  
  // LIGHTS per floor
  for(let f=0;f<floors;f++){
    const pl2=new THREE.PointLight(0xffd090,0.5,12);pl2.position.set(bx,f*floorH+floorH-0.5,bz);pl2.userData.levelObj=true;G.scene.add(pl2);
    const lm=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.05,0.15),new THREE.MeshBasicMaterial({color:0xeedd99,transparent:true,opacity:0.7}));
    lm.position.set(bx,f*floorH+floorH-0.3,bz);lm.userData.levelObj=true;G.scene.add(lm);
  }
}
