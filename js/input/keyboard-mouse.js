// Desktop input: keyboard, mouse, pointer lock.
import { G } from '../state.js';
import { attack } from '../combat/attack.js';
import { dodge } from '../player/movement.js';
import { togglePause } from '../ui/flow.js';
import { toggleVehicle } from '../entities/vehicles.js';
import { updateHUD } from '../ui/hud.js';

const PI = Math.PI;

export function setupInput() {
  document.addEventListener('keydown', e => {
    G.keys[e.code] = true;
    if (e.code === 'Escape' && G.inGame) togglePause();
    if (e.code === 'KeyQ' && G.inGame) { G.currentWeapon = (G.currentWeapon + 1) % G.weapons.length; updateHUD(); }
    if (e.code === 'Space' && G.inGame) dodge();
    if (e.code === 'KeyF' && G.inGame) G.blocking = true;
    if (e.code === 'KeyE' && G.inGame) toggleVehicle();
  });
  document.addEventListener('keyup', e => {
    G.keys[e.code] = false;
    if (e.code === 'KeyF') G.blocking = false;
  });
  
  // Mouse look — works with AND without pointer lock
  let rightMouseDown = false;
  let prevMX = 0, prevMY = 0;
  
  document.addEventListener('mousemove', e => {
    if (!G.inGame || G.paused) return;
    if (document.pointerLockElement) {
      G.lookDir.y -= e.movementX * 0.002;
      G.lookDir.x -= e.movementY * 0.002;
    } else if (rightMouseDown) {
      G.lookDir.y -= (e.clientX - prevMX) * 0.004;
      G.lookDir.x -= (e.clientY - prevMY) * 0.004;
    }
    G.lookDir.x = Math.max(-PI/2.5, Math.min(PI/2.5, G.lookDir.x));
    prevMX = e.clientX; prevMY = e.clientY;
  });
  
  document.addEventListener('mousedown', e => {
    if (!G.inGame || G.paused) return;
    if (e.button === 0) {
      if (!document.pointerLockElement && !G.isTouch) G.renderer.domElement.requestPointerLock();
      attack();
    }
    if (e.button === 2) { rightMouseDown = true; G.blocking = true; }
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 2) { rightMouseDown = false; G.blocking = false; }
  });
  document.addEventListener('contextmenu', e => e.preventDefault());

  // Clear stuck keys and block state when the window loses focus.
  // Fixes the "hold W → Alt-Tab → release W outside → come back still walking" bug.
  window.addEventListener('blur', () => {
    G.keys = {};
    G.blocking = false;
  });
}
