// Entry point for WW III — wires up modules, bridges inline onclick handlers,
// then runs the init sequence.
import { G } from './state.js';
import { initThree } from './engine/three-setup.js';
import { animate } from './engine/loop.js';
import { setupInput } from './input/keyboard-mouse.js';
import { setupTouchControls } from './input/touch.js';
import { showScreen, setDifficulty, showLeaderboard, showLoreCollection, initCharCreator } from './ui/screens.js';
import { startGame, startLevel, togglePause, quitToMenu } from './ui/flow.js';
import { advanceCutscene } from './ui/cutscene.js';
import { switchWeapon } from './ui/hud.js';

// Bridge module functions to window so inline onclick="..." handlers keep working.
window.showScreen = showScreen;
window.startGame = startGame;
window.setDifficulty = setDifficulty;
window.startLevel = startLevel;
window.advanceCutscene = advanceCutscene;
window.togglePause = togglePause;
window.quitToMenu = quitToMenu;
window.switchWeapon = switchWeapon;

// ===== INPUT MODE DETECTION =====
// (hover: hover) is true for devices with a mouse/trackpad that can hover over elements.
// This correctly treats hybrid devices (touchscreen laptops, iPad + trackpad) as desktop,
// so the keyboard stays enabled. Pure-touch devices (phones, iPad alone) flip to touch mode.
G.isTouch = !window.matchMedia('(hover: hover)').matches;

// ===== INIT =====
initThree();
setupInput();
// Touch listeners are bound exactly once here, regardless of device type. showTouchControls()
// (called from launchLevel) only reveals the UI on devices actually in touch mode.
setupTouchControls();
initCharCreator();
animate();
