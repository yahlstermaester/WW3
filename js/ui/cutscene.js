// Cutscene line display and advancement.
import { G } from '../state.js';
import { launchLevel } from './flow.js';

export function showCutsceneLine() {
  if (G.cutsceneIdx >= G.cutsceneLines.length) {
    launchLevel();
    return;
  }
  const line = G.cutsceneLines[G.cutsceneIdx];
  const colonIdx = line.indexOf(': ');
  const speaker = colonIdx > 0 ? line.slice(0, colonIdx) : '';
  const text = colonIdx > 0 ? line.slice(colonIdx + 2) : line;
  const speakerEl = document.getElementById('cutsceneSpeaker');
  const textEl = document.getElementById('cutsceneText');
  speakerEl.textContent = speaker;
  textEl.textContent = text;
  // Color code speakers
  if (speaker === 'GREG') speakerEl.style.color = '#5cc46c';
  else if (speaker === 'G') speakerEl.style.color = '#d4a054';
  else speakerEl.style.color = '#8a7560';
  // Silence effect
  if (line === '...') { speakerEl.textContent = ''; textEl.textContent = '· · ·'; textEl.style.opacity = '0.4'; }
  else { textEl.style.opacity = '1'; }
  document.getElementById('cutsceneNext').textContent = G.cutsceneIdx >= G.cutsceneLines.length - 1 ? 'Begin Mission' : 'Continue';
}

export function advanceCutscene() {
  G.cutsceneIdx++;
  showCutsceneLine();
}
