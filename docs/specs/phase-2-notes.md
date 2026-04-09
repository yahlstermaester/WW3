# Phase 2 Notes — Bugs and Cleanup Found During Phase 1

These issues were noticed while restructuring the single-file `index.html` into modules. They were deliberately NOT fixed in Phase 1 (which is strict zero-behavior-change). Phase 2 should triage and address them.

## Dead Code

1. **`G.playerBody` and `G.ground`** — declared top-level in the original `<script>` block but never assigned or read anywhere. Dead variables. Safe to delete from `js/state.js`.

2. **`addStairs` first parameter (`_scene`, formerly `scene`)** — the function accepts it but never uses it. The parameter was kept during the restructure (renamed to `_scene`) so existing call sites still work unchanged. Phase 2 can drop the parameter and update all 6 call sites in `js/world/environment.js` and `js/world/buildings.js`.

## Logic / Design Issues

3. **"Next Mission" button bypasses `startGame`** — on the victory screen, clicking Next Mission runs `showScreen('levelScreen')` which skips `startGame`. A player who completes level 3 and moves to level 4 keeps their accumulated weapons/ammo, which may or may not be intentional. Needs product decision.

4. **`gameOver` recursion through `deathAnim`** — the death animation function calls `gameOver()` again. Current code avoids infinite recursion via the `G.inGame` flag, but the pattern is fragile. Should refactor so the animation callback doesn't re-enter the function that spawned it.

5. **Pointer lock requested twice** — once in `launchLevel` and again on the left-click handler in `setupInput`. Redundant but harmless on desktop. Clean this up when Phase 3 adds proper desktop controls.

## Code Quality

6. **Inline `onclick="switchWeapon(${i})"` in `updateHUD`** — the HUD inventory is rebuilt with a template string that injects inline handlers. This requires `switchWeapon` to be attached to `window`. Phase 2 or 3 should replace this with `addEventListener` for cleaner separation.

7. **`updateHUD` transitively reads `G.camera`** — calls `updateMinimap`, which uses the camera position. Works today, but creates a hidden coupling between UI and engine layers. Consider making `updateMinimap` accept the camera as an argument, or having the engine push minimap updates instead of having the UI pull them.

## Layering Concerns

8. **Cross-imports between `vehicles.js` ↔ `flow.js`, `damage.js` ↔ `flow.js`, and `cutscene.js` ↔ `flow.js`** — these are resolvable by ES modules because the circular references are only used inside function bodies (runtime), never at module initialization. The code is correct today. But the layering (entities → flow, combat → flow, cutscene → flow) is a smell that suggests `flow.js` may be doing too many things. Phase 2 could extract the level-transition logic out of `flow.js` to break the cycles.

---

**None of these are blockers. The game should play identically after Phase 1. These are a roadmap for Phase 2.**
