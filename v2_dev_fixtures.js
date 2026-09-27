// ═══════════════════════════════════════════════════════════════
// DEV ONLY — fixture panel for app v2. Toggle with Ctrl+Shift+D.
// Remove the two DEV ONLY lines in index.html before shipping.
// Round → time: round n = 08:00 + (n-1)·30 min (round 7 = 11:00, round 20 = 17:30).
// ═══════════════════════════════════════════════════════════════

import { createGame } from './flow_logic.js';
import { setGame } from './v2_store.js';
import { go } from './v2_router.js';

function game(names, overrides = {}, playerData = []) {
  const g = createGame(names.map(([name, talstation = '']) => ({ name, talstation })), overrides.totalRounds);
  playerData.forEach((data, i) => Object.assign(g.players[i], data));
  return Object.assign(g, overrides);
}

const FOUR = [['Anna', 'Dorf'], ['Ben', 'Bahnhof'], ['Clara', 'Dorf'], ['Dani', 'Parkplatz Süd']];
const FOUR_POINTS = [{ points: 47, gratis: 1, joker: 1 }, { points: 52 }, { points: 31, joker: 2 }, { points: 40 }];

const FIXTURES = [
  ['2 Spieler · 08:00', () => game([['Anna', 'Dorf'], ['Ben', 'Bahnhof']])],
  ['4 Spieler · 10:30 (Mockup)', () => game(FOUR, { round: 6 }, FOUR_POINTS)],
  ['Gleich 11:00 → Mittag-Karte', () => game(FOUR, { round: 6, currentPlayerIndex: 3 }, FOUR_POINTS)],
  ['Pause offen · 11:30', () => game(FOUR, { round: 8, eventsShown: ['lunch_open'] }, FOUR_POINTS)],
  ['Gleich 3 Runden übrig', () => game(FOUR, { round: 17, currentPlayerIndex: 3, eventsShown: ['lunch_open', 'lunch_close'] }, FOUR_POINTS)],
  ['Letzter Zug · 17:30', () => game(FOUR, { round: 20, currentPlayerIndex: 3, eventsShown: ['lunch_open', 'lunch_close', 'three_rounds'] }, FOUR_POINTS)],
  ['Spiel beendet → Schlusswertung', () => game(FOUR, { round: 20, finished: true, eventsShown: ['lunch_open', 'lunch_close', 'three_rounds'] }, FOUR_POINTS)],
];

function openTarget(g) {
  setGame(g);
  go(g.finished ? 'game_end' : 'turn_start');
}

function buildPanel() {
  const panel = document.createElement('aside');
  panel.className = 'dev-panel';
  panel.hidden = true;

  const title = document.createElement('p');
  title.className = 'dev-panel__title';
  title.textContent = 'DEV · Fixtures (Ctrl+Shift+D)';
  panel.append(title);

  FIXTURES.forEach(([label, make]) => panel.append(button(label, () => openTarget(make()))));
  panel.append(button('Spielstand löschen', () => { setGame(null); go('home'); }, true));

  document.body.append(panel);
  return panel;
}

function button(label, onClick, danger = false) {
  const btn = document.createElement('button');
  btn.className = danger ? 'dev-panel__btn dev-panel__btn--danger' : 'dev-panel__btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

const panel = buildPanel();
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    panel.hidden = !panel.hidden;
  }
});
