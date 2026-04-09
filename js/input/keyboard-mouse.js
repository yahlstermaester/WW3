// Desktop input: keyboard, mouse, pointer lock, scroll wheel.
import { G } from '../state.js';
import { attack } from '../combat/attack.js';
import { dodge } from '../player/movement.js';
import { togglePause } from '../ui/flow.js';
import { toggleVehicle } from '../entities/vehicles.js';
import { updateHUD } from '../ui/hud.js';

const PI = Math.PI;

// Mouse sensitivity — tweak these to taste. Higher = faster camera movement.
// Pointer-lock mode uses raw pixel deltas; drag mode uses screen-space deltas.
const SENSITIVITY_LOCK = 0.002;
const SENSITIVITY_DRAG = 0.004;

export function setupInput() {
  document.addEventListener('keydown', e => {
    G.keys[e.code] = true;
    if (!G.inGame) return;

    if (e.code === 'Escape') togglePause();
    if (e.code === 'Space') dodge();
    if (e.code === 'KeyF') G.blocking = true;
    if (e.code === 'KeyE') toggleVehicle();
    if (e.code === 'KeyR') attack(); // alt fire / quick-melee fallback

    // Weapon cycling with Q (forward) — preserved from original
    if (e.code === 'KeyQ') {
      G.currentWeapon = (G.currentWeapon + 1) % G.weapons.length;
      updateHUD();
    }

    // Number keys 1–9 to jump directly to a weapon slot
    const digitMatch = e.code.match(/^Digit(\d)$/);
    if (digitMatch) {
      const slot = parseInt(digitMatch[1]) - 1; // Digit1 → slot 0
      if (slot >= 0 && slot < G.weapons.length) {
        G.currentWeapon = slot;
        updateHUD();
      }
    }

    // Shift = sprint (held)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.sprinting = true;
  });

  document.addEventListener('keyup', e => {
    G.keys[e.code] = false;
    if (e.code === 'KeyF') G.blocking = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.sprinting = false;
  });

  // Mouse look — works with AND without pointer lock
  let rightMouseDown = false;
  let prevMX = 0, prevMY = 0;

  document.addEventListener('mousemove', e => {
    if (!G.inGame || G.paused) return;
    if (document.pointerLockElement) {
      G.lookDir.y -= e.movementX * SENSITIVITY_LOCK;
      G.lookDir.x -= e.movementY * SENSITIVITY_LOCK;
    } else if (rightMouseDown) {
      G.lookDir.y -= (e.clientX - prevMX) * SENSITIVITY_DRAG;
      G.lookDir.x -= (e.clientY - prevMY) * SENSITIVITY_DRAG;
    }
    G.lookDir.x = Math.max(-PI / 2.5, Math.min(PI / 2.5, G.lookDir.x));
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

  // Scroll wheel — cycle weapons up/down (standard FPS convention)
  document.addEventListener('wheel', e => {
    if (!G.inGame || G.paused || G.weapons.length < 2) return;
    if (e.deltaY > 0) {
      // Scroll down → next weapon
      G.currentWeapon = (G.currentWeapon + 1) % G.weapons.length;
    } else {
      // Scroll up → previous weapon
      G.currentWeapon = (G.currentWeapon - 1 + G.weapons.length) % G.weapons.length;
    }
    updateHUD();
  }, { passive: true });

  // Clear stuck keys and block state when the window loses focus.
  // Fixes the "hold W → Alt-Tab → release W outside → come back still walking" bug.
  window.addEventListener('blur', () => {
    G.keys = {};
    G.blocking = false;
    G.sprinting = false;
  });
}
