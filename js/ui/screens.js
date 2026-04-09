// Screen switching + character creator + level list + leaderboard + lore collection UI.
import { G } from '../state.js';
import { LEVELS, LORE_ENTRIES } from '../data/levels.js';

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  if (id === 'levelScreen') populateLevels();
  if (id === 'leaderboardScreen') showLeaderboard();
  if (id === 'loreScreen') showLoreCollection();
}

const skinTones = ['#f5d0a9','#c4956a','#8d5524','#6b3a1f','#3b1f0e'];
const armorTones = ['#5a6b52','#4a5a6b','#6b5a4a','#5a4a5a','#3a3a3a','#8b6b3a'];

export function initCharCreator() {
  const sc = document.getElementById('skinColors');
  const ac = document.getElementById('armorColors');
  sc.innerHTML = '';
  ac.innerHTML = '';
  skinTones.forEach((c,i) => {
    const d = document.createElement('div');
    d.className = 'color-opt' + (c === G.playerChar.skin ? ' selected' : '');
    d.style.background = c;
    d.onclick = () => { G.playerChar.skin = c; initCharCreator(); };
    sc.appendChild(d);
  });
  armorTones.forEach((c,i) => {
    const d = document.createElement('div');
    d.className = 'color-opt' + (c === G.playerChar.armor ? ' selected' : '');
    d.style.background = c;
    d.onclick = () => { G.playerChar.armor = c; initCharCreator(); };
    ac.appendChild(d);
  });
}

export function populateLevels() {
  const grid = document.getElementById('levelsGrid');
  grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const card = document.createElement('div');
    const locked = i + 1 > G.unlockedLevel;
    card.className = 'level-card' + (locked ? ' locked' : '') + (i === G.selectedLevel ? ' selected' : '');
    card.style.borderColor = i === G.selectedLevel ? '#d4a054' : '';
    card.innerHTML = `<div class="lnum">${String(i+1).padStart(2,'0')}</div><div class="lname">${locked ? '???' : lv.name}</div>`;
    if (!locked) card.onclick = () => { G.selectedLevel = i; populateLevels(); };
    grid.appendChild(card);
  });
}

export function setDifficulty(d) {
  G.difficulty = d;
  [0,1,2].forEach(i => document.getElementById('diff'+i).classList.toggle('selected', i === d));
}

export function showLeaderboard() {
  const list = document.getElementById('leaderboardList');
  const sorted = [...G.leaderboard].sort((a,b) => b.score - a.score).slice(0, 10);
  if (sorted.length === 0) {
    list.innerHTML = '<div class="desc">No entries yet. Survive to earn your place.</div>';
    return;
  }
  list.innerHTML = sorted.map((e, i) => 
    `<div class="lb-entry"><span class="lb-rank">#${i+1}</span><span class="lb-name">${e.name}</span><span class="lb-score">${e.score}</span></div>`
  ).join('');
}

export function showLoreCollection() {
  const list = document.getElementById('loreList');
  if (G.collectedLore.length === 0) {
    list.innerHTML = '<div class="desc">No lore found yet. Explore the wasteland.</div>';
    return;
  }
  list.innerHTML = G.collectedLore.map(idx => {
    const l = LORE_ENTRIES[idx];
    return `<div style="margin:12px 0;padding:12px;border:1px solid rgba(212,160,84,0.15)"><div class="lore-title">${l.title}</div><div class="lore-text">${l.text}</div></div>`;
  }).join('');
}
