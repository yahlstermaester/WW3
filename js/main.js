// Entry point for WW III — wires up modules, bridges inline onclick handlers,
// then runs the init sequence.
import { G } from './state.js';
import { initThree } from './engine/three-setup.js';
import { animate } from './engine/loop.js';
import { setupInput } from './input/keyboard-mouse.js';
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

// ===== INIT =====
initThree();
setupInput();
initCharCreator();
animate();
