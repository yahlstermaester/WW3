// Touch controls: virtual joystick, look-drag, touch action buttons.
import { G } from '../state.js';
import { WEAPON_DATA } from '../data/weapons.js';
import { attack } from '../combat/attack.js';
import { dodge } from '../player/movement.js';
import { updateHUD } from '../ui/hud.js';

const PI = Math.PI;

let joyTouchId = null, lookTouchId = null;
let ltX = 0, ltY = 0;

export function setupTouchControls() {
  if (!G.isTouch) return;
  document.getElementById('joystickArea').classList.add('active');
  ['btn-attack','btn-block','btn-dodge','btn-ranged','btn-weapon'].forEach(id => document.getElementById(id).classList.add('active'));
  
  const jArea = document.getElementById('joystickArea');
  const jKnob = document.getElementById('joystickKnob');
  
  jArea.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    const r = jArea.getBoundingClientRect();
    G._jc = { x: r.left + r.width/2, y: r.top + r.height/2 };
  }, {passive:false});
  
  jArea.addEventListener('touchmove', e => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== joyTouchId) continue;
      let dx = t.clientX - G._jc.x, dy = t.clientY - G._jc.y;
      const d = Math.sqrt(dx*dx+dy*dy), mx = 40;
      if (d > mx) { dx=dx/d*mx; dy=dy/d*mx; }
      jKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      G.moveDir.x = dx/mx; G.moveDir.z = dy/mx;
    }
  }, {passive:false});
  
  jArea.addEventListener('touchend', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId) {
        joyTouchId = null;
        jKnob.style.transform = 'translate(-50%,-50%)';
        G.moveDir.x = 0; G.moveDir.z = 0;
      }
    }
  });
  
  // Look — swipe anywhere on right 70% of canvas, tracked by ID for multi-touch
  G.renderer.domElement.addEventListener('touchstart', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX > window.innerWidth * 0.25 && lookTouchId === null) {
        lookTouchId = t.identifier; ltX = t.clientX; ltY = t.clientY;
      }
    }
  }, {passive:true});
  G.renderer.domElement.addEventListener('touchmove', e => {
    if (!G.inGame) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== lookTouchId) continue;
      G.lookDir.y -= (t.clientX - ltX) * 0.005;
      G.lookDir.x -= (t.clientY - ltY) * 0.005;
      G.lookDir.x = Math.max(-PI/2.5, Math.min(PI/2.5, G.lookDir.x));
      ltX = t.clientX; ltY = t.clientY;
    }
  }, {passive:true});
  G.renderer.domElement.addEventListener('touchend', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId) lookTouchId = null;
    }
  });
  
  document.getElementById('btn-attack').addEventListener('touchstart', e => { e.preventDefault(); attack(); }, {passive:false});
  document.getElementById('btn-block').addEventListener('touchstart', e => { e.preventDefault(); G.blocking = true; }, {passive:false});
  document.getElementById('btn-block').addEventListener('touchend', () => { G.blocking = false; });
  document.getElementById('btn-dodge').addEventListener('touchstart', e => { e.preventDefault(); dodge(); }, {passive:false});
  document.getElementById('btn-ranged').addEventListener('touchstart', e => { e.preventDefault();
    const ri = G.weapons.findIndex(w => WEAPON_DATA[w].type === 'ranged');
    if (ri >= 0) { G.currentWeapon = ri; attack(); updateHUD(); }
  }, {passive:false});
  document.getElementById('btn-weapon').addEventListener('touchstart', e => { e.preventDefault(); G.currentWeapon = (G.currentWeapon+1)%G.weapons.length; updateHUD(); }, {passive:false});
}

export function hideTouchControls() {
  document.getElementById('joystickArea').classList.remove('active');
  ['btn-attack','btn-block','btn-dodge','btn-ranged','btn-weapon'].forEach(id => document.getElementById(id).classList.remove('active'));
}
