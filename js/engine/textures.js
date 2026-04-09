// Procedural texture cache + factories.
// TEX is module-local; THREE is a global from the CDN script in index.html.

const TEX = {};
export function makeTex(name, sz, fn) {
  if (TEX[name]) return TEX[name];
  const c = document.createElement('canvas'); c.width = c.height = sz;
  const x = c.getContext('2d'); fn(x, sz);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  TEX[name] = t; return t;
}
export function texBrick() {
  return makeTex('brick', 128, (x, s) => {
    x.fillStyle='#7a6a5a'; x.fillRect(0,0,s,s);
    for(let r=0;r<10;r++) { const off=(r%2)*15;
      for(let c=-1;c<6;c++) { const v=Math.random()*20-10;
        x.fillStyle=`rgb(${140+v|0},${105+v|0},${85+v|0})`; x.fillRect(off+c*26,r*13,24,11); }}
    for(let i=0;i<200;i++){x.fillStyle=`rgba(0,0,0,${Math.random()*0.08})`;x.fillRect(Math.random()*s,Math.random()*s,2,2);}
  });
}
export function texConcrete() {
  return makeTex('concrete', 128, (x, s) => {
    x.fillStyle='#8a8580'; x.fillRect(0,0,s,s);
    for(let i=0;i<800;i++){const v=110+Math.random()*40;x.fillStyle=`rgb(${v|0},${v-3|0},${v-6|0})`;x.fillRect(Math.random()*s,Math.random()*s,1+Math.random()*3,1+Math.random()*3);}
    x.strokeStyle='rgba(0,0,0,0.06)';x.lineWidth=1;
    for(let i=0;i<4;i++){const p=Math.random()*s;x.beginPath();x.moveTo(p,0);x.lineTo(p+20,s);x.stroke();}
  });
}
export function texMetal() {
  return makeTex('metal', 64, (x, s) => {
    x.fillStyle='#6a6a6a'; x.fillRect(0,0,s,s);
    for(let i=0;i<s;i++){const v=85+Math.random()*30;x.fillStyle=`rgb(${v|0},${v|0},${v+5|0})`;x.fillRect(0,i,s,1);}
    x.fillStyle='rgba(255,255,255,0.05)';x.fillRect(0,0,s,s/2);
    for(let i=0;i<6;i++){x.fillStyle='rgba(0,0,0,0.1)';const y=Math.random()*s;x.fillRect(0,y,s,1);}
  });
}
export function texWood() {
  return makeTex('wood', 64, (x, s) => {
    x.fillStyle='#8a7560'; x.fillRect(0,0,s,s);
    for(let i=0;i<s;i++){const v=Math.sin(i*0.3)*10;x.fillStyle=`rgb(${120+v|0},${90+v|0},${65+v|0})`;x.fillRect(0,i,s,1);}
    for(let i=0;i<100;i++){x.fillStyle=`rgba(0,0,0,${Math.random()*0.06})`;x.fillRect(Math.random()*s,Math.random()*s,1,3+Math.random()*5);}
  });
}
export function texFloor() {
  return makeTex('floor', 128, (x, s) => {
    x.fillStyle='#6a6560'; x.fillRect(0,0,s,s);
    const ts=32;for(let r=0;r<s/ts;r++)for(let c=0;c<s/ts;c++){
      const v=Math.random()*15-7;x.fillStyle=`rgb(${95+v|0},${88+v|0},${80+v|0})`;x.fillRect(c*ts+1,r*ts+1,ts-2,ts-2);}
    for(let i=0;i<300;i++){x.fillStyle=`rgba(0,0,0,${Math.random()*0.06})`;x.fillRect(Math.random()*s,Math.random()*s,2,2);}
  });
}
export function texGround(type) {
  return makeTex('ground_'+type, 256, (x, s) => {
    const bases = {desert:[140,120,90],bunker:[80,77,72],city:[100,92,82],canyon:[150,120,80],airbase:[140,125,95],
      ocean:[40,60,75],refinery:[85,82,78],trainyard:[90,85,75],dam:[80,90,85],highway:[90,88,82]};
    const base = bases[type] || bases.city;
    x.fillStyle=`rgb(${base[0]},${base[1]},${base[2]})`; x.fillRect(0,0,s,s);
    for(let i=0;i<2000;i++){const v=Math.random()*25-12;
      x.fillStyle=`rgb(${base[0]+v|0},${base[1]+v|0},${base[2]+v|0})`;
      x.fillRect(Math.random()*s,Math.random()*s,2+Math.random()*4,2+Math.random()*4);}
    if(type==='desert'||type==='canyon'||type==='airbase'){for(let i=0;i<5;i++){x.strokeStyle='rgba(160,140,100,0.12)';x.lineWidth=8+Math.random()*12;x.beginPath();x.moveTo(0,Math.random()*s);x.quadraticCurveTo(s/2,Math.random()*s,s,Math.random()*s);x.stroke();}}
  });
}

export function texMat(texFn, color, repeatX, repeatY) {
  const t = texFn(); t.repeat.set(repeatX||1, repeatY||1);
  return new THREE.MeshLambertMaterial({ map: t.clone ? (() => { const c=t.clone(); c.repeat.set(repeatX||1,repeatY||1); c.needsUpdate=true; return c; })() : t, color });
}
