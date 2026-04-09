# WW III — Restructure Phase 1 Design

**Date:** 2026-04-08
**Status:** Approved — ready for implementation plan
**Phase:** 1 of 3 (Restructure → Fix Bugs → Add Desktop Controls)

---

## Goal

Split the single-file `index.html` (3193 lines of mixed HTML/CSS/JS) into a modular vanilla project using ES modules. **Zero behavior changes.** The game must play identically before and after this phase. No bug fixes, no new features, no control changes. This phase is pure reorganization so that future phases (bug fixes, desktop controls, new features) become safer and easier.

## Non-Goals

- Not fixing any bugs (Phase 2)
- Not adding desktop-specific controls (Phase 3)
- Not touching `ww3-multiplayer/` or `setup-ww3.sh` (staying as-is)
- Not introducing a build step, framework, or dependency manager
- Not changing how Vercel deploys the project
- Not merging single-player with the multiplayer Next.js project

## Stack Decision

**Vanilla HTML/CSS/JavaScript with native ES modules.**

- No Node.js, no npm, no bundler, no framework.
- Browser loads `index.html` → loads CSS files via `<link>` → loads `js/main.js` via `<script type="module">` → `main.js` imports from the rest of the module tree.
- Works identically in dev and production. No build step, no transpilation.
- Deploys to Vercel with no configuration changes.

## Folder Structure

```
/
├── index.html              Skinny shell: markup + CSS links + main.js module script
├── .vercelignore           Unchanged
├── docs/
│   └── specs/
│       └── 2026-04-08-restructure-phase-1-design.md
│
├── css/
│   ├── base.css            Reset, fonts, body, general screen styles
│   ├── menus.css           Main menu, character creator, level select, cutscene, game over, leaderboard, lore
│   ├── hud.css             In-game HUD, minimap, crosshair, damage flash, lore popup, pause overlay
│   └── touch.css           Joystick, touch action buttons
│
├── js/
│   ├── main.js             Entry point: imports and init call
│   ├── state.js            The G object (single source of truth for game state)
│   │
│   ├── data/
│   │   └── levels.js       Level definitions array
│   │
│   ├── engine/
│   │   ├── three-setup.js  initThree: scene, camera, renderer, lights
│   │   ├── textures.js     makeTex, texBrick, texConcrete, texMetal, texWood, texFloor, texGround, texMat
│   │   └── loop.js         animate, update (the main game loop tick)
│   │
│   ├── world/
│   │   ├── environment.js  clearLevel, createGround, addBox, addFloor, addStairs, generateEnvironment
│   │   └── buildings.js    createBuilding
│   │
│   ├── entities/
│   │   ├── enemies.js      createEnemy, enemyShoot
│   │   ├── vehicles.js     createVehicle, damageVehicle, killVehicle, vehicleShoot, toggleVehicle, spawnDriveableVehicle
│   │   ├── allies.js       createAllyVehicle, allyShoot
│   │   └── items.js        spawnItem, spawnLore, checkItems, showLorePopup
│   │
│   ├── combat/
│   │   ├── attack.js       attack, meleeAttack, fireProjectile
│   │   ├── damage.js       damageEnemy, killEnemy, playerTakeDamage
│   │   └── tracers.js      createTracer
│   │
│   ├── player/
│   │   └── movement.js     clampPosition, checkWallCollision, hasLineOfSight, dodge
│   │
│   ├── ui/
│   │   ├── screens.js      showScreen, initCharCreator, populateLevels, setDifficulty, showLeaderboard, showLoreCollection
│   │   ├── hud.js          updateHUD, updateMinimap, switchWeapon
│   │   ├── flow.js         startGame, startLevel, launchLevel, checkLevelComplete, levelComplete, gameOver, togglePause, quitToMenu
│   │   └── cutscene.js     showCutsceneLine, advanceCutscene
│   │
│   └── input/
│       ├── keyboard-mouse.js   setupInput (desktop portion: keyboard, mouse, pointer lock)
│       └── touch.js            setupTouchControls, hideTouchControls
```

## Module Boundaries and Communication

### State sharing pattern

- `js/state.js` exports a single mutable `G` object.
- Every other module imports `G` from `state.js` and reads/mutates it directly.
- This matches the current pattern (global `G` object) but makes the dependency explicit instead of implicit.

```js
// js/state.js
export const G = { /* ... all game state ... */ };

// js/combat/attack.js
import { G } from '../state.js';
```

### Three.js objects

- `scene`, `camera`, `renderer`, `clock` live on the `G` object as `G.scene`, `G.camera`, `G.renderer`, `G.clock`.
- This matches the current code's pattern (where these are top-level variables inside the single closure) and keeps the restructure faithful to "zero behavior change."
- Files that need to add or remove 3D objects read `G.scene`, etc., after importing `G` from `state.js`.

### DOM element access

- UI modules use `document.getElementById` the same way the current code does.
- Element IDs stay identical to the current code to avoid breakage.

### No circular imports

- Dependency direction: `main.js` → `engine/` + `data/` → `world/` + `entities/` → `combat/` + `player/` → `ui/` + `input/`.
- State (`state.js`) is the root — every module imports from it, it imports from nothing.

## index.html Changes

Before: one 3193-line file containing HTML markup, inline `<style>` block (~130 lines), and inline `<script>` block (~2900 lines).

After:
- Keep all HTML markup (the screens, HUD, touch controls, pause overlay, etc.).
- Replace `<style>` block with `<link rel="stylesheet">` tags pointing to the four CSS files.
- Replace `<script>` block with `<script type="module" src="js/main.js"></script>`.
- Expected line count: ~250 lines (just markup).

## Global Functions Called from HTML

The current HTML has inline `onclick` handlers like `onclick="showScreen('charScreen')"`, `onclick="startGame()"`, etc. These need global access to module-level functions.

**Approach:** In `main.js`, after importing the relevant functions, attach them to `window` so the inline handlers keep working:

```js
// js/main.js
import { showScreen, setDifficulty, showLeaderboard, showLoreCollection } from './ui/screens.js';
import { startGame, startLevel, togglePause, quitToMenu } from './ui/flow.js';
import { advanceCutscene } from './ui/cutscene.js';

window.showScreen = showScreen;
window.startGame = startGame;
// ...etc for every function referenced in an inline onclick
```

This is a deliberate compromise. A cleaner approach would be to replace `onclick` attributes with `addEventListener` calls — but that's a behavior-adjacent edit and Phase 1 is strict zero-behavior-change. The `window` attachments are a temporary bridge; Phase 2 or 3 can migrate them to proper event listeners.

## CSS Split Mapping

| CSS file | Current `<style>` sections |
|---|---|
| `base.css` | `* { reset }`, `body`, `canvas`, `.screen`, `.screen-bg`, `.screen-content`, `.title`, `.subtitle`, `.btn`, `.section-title`, `.desc`, `.scroll-area` |
| `menus.css` | `.char-preview`, `.color-options`, `.color-opt`, `.levels-grid`, `.level-card`, `.diff-options`, `.cutscene-panel`, `.cutscene-text`, `.cutscene-speaker`, `.leaderboard`, `.lb-entry`, `.lb-rank`, `.lb-name`, `.lb-score` |
| `hud.css` | `#hud`, `.hud-top`, `.hud-bottom`, `.health-bar`, `.bar-label`, `.bar-outer`, `.bar-inner`, `.ammo-display`, `.ammo-count`, `.ammo-label`, `.minimap`, `.minimap-dot`, `.inventory-bar`, `.inv-slot`, `.score-display`, `.level-display`, `.crosshair`, `.damage-flash`, `.lore-popup`, `.lore-title`, `.lore-text`, `.pause-overlay` |
| `touch.css` | `.touch-controls`, `.joystick-area`, `.joystick-knob`, `.touch-btn`, `#btn-attack`, `#btn-block`, `#btn-dodge`, `#btn-ranged`, `#btn-weapon` |

The font `@import` stays in `base.css` at the top.

## Verification Strategy

After the restructure is complete, verify zero regressions by running through this checklist in the browser:

1. Load `index.html` — main menu appears with no console errors.
2. Click "New Game" → character creator loads, skin/armor colors selectable, name input works.
3. Click "Enter the Wasteland" → level select appears, levels populate.
4. Select a level + difficulty → "Deploy" → cutscene plays through → gameplay starts.
5. Move with the joystick/keys, rotate camera, attack an enemy, take damage.
6. Switch weapons, dodge, pick up an item.
7. Pause (menu + resume).
8. Die → game over screen → return to menu.
9. Check leaderboard and lore screens.
10. No console errors or warnings at any point.

If any step fails, the restructure has a regression and must be fixed before the phase is considered complete.

## Deployment Impact

- No change to `.vercelignore`.
- Vercel auto-detects `index.html` at root and serves the site as a static deployment.
- New files (`css/`, `js/`, `docs/`) are all served as static assets by Vercel's default behavior — no configuration needed.
- First push triggers a preview deploy; once verified, the same commit becomes production on merge to `main`.

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Circular import between modules | Medium | Root rule: only `state.js` is imported by many; everything else flows outward. `main.js` wires things at the top. |
| `onclick` attribute handlers lose access to functions | High if missed | Explicit `window.X = X` bridge in `main.js` for every inline handler referenced in `index.html`. Grep the HTML first to build a complete list. |
| A function in one section secretly depends on variables from another section | Medium | The current file uses a single closure scope — many functions read/write free variables. Before splitting, inventory every top-level `let`/`const` and either put it on `G` in `state.js` or export it from its owning module. |
| CSS specificity or cascade order changes when split into files | Low | Load CSS files in a fixed order (`base → menus → hud → touch`). The order matches the current top-to-bottom order in the inline `<style>`. |
| Module load order issues (scripts loaded before DOM is ready) | Low | `<script type="module">` defers execution by default, so DOM is guaranteed ready when `main.js` runs. |
| Game state variable references break after split | High | Before writing any new file, read the ENTIRE current `<script>` block and list every top-level variable. Every one of them must end up either inside `G` in `state.js` or exported from a single owning module. |

## Implementation Order

1. Create `docs/specs/` directory and write this spec (done).
2. Create all empty placeholder files (`css/*.css`, `js/**/*.js`) so the tree exists.
3. Extract CSS to the four files, verify visually by loading the game.
4. Extract `state.js` first — the G object and all shared mutable state.
5. Extract data (`levels.js`) — no dependencies.
6. Extract engine layer (`three-setup.js`, `textures.js`) — depends only on state.
7. Extract world (`environment.js`, `buildings.js`) — depends on engine + state.
8. Extract entities (`enemies.js`, `vehicles.js`, `allies.js`, `items.js`) — depends on world + state.
9. Extract combat, player modules — depends on entities + state.
10. Extract UI modules (`screens.js`, `hud.js`, `flow.js`, `cutscene.js`).
11. Extract input modules (`keyboard-mouse.js`, `touch.js`).
12. Extract engine loop (`loop.js`) last — it calls into everything.
13. Write `main.js` with all imports and the init call.
14. Delete the inline `<style>` and `<script>` from `index.html`, replace with `<link>` and `<script type="module">`.
15. Run the verification checklist in Safari.
16. Fix any regressions.
17. Commit and push.

Each step should result in a game that still loads and plays. After each extraction, reload the browser and do a quick smoke test before moving on.

## Rollback Plan

If the restructure introduces bugs that can't be resolved quickly:
- Git revert the restructure commit(s) to restore the original single-file `index.html`.
- Live site rolls back on the next Vercel deploy.
- Document what went wrong in a new design doc for Phase 1b.
