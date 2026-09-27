// MENU — flow_spec.md §8: menu, Punkte (ranking + Punkteverlauf + round detail, FEAT-23),
// Würfel & Regeln, Anpassungen (behind a confirm sheet), Neues Spiel, Zum Start.
// The menu pages remember the game screen they were opened from (`origin`) and always
// return there — the router's back() only knows one level, which would bounce between pages.

import {
  DESCENT_DICE, ALLOWED_SLOPES, SLOPE_PTS, LEVEL_MAX_POINTS, EVENT_SYMBOLS, TRANSPORT_SYMBOLS, TRANSPORT_NAMES,
  PAUSE_POINTS, EXTRA_ACTIVITY_POINTS, COIN_LIMIT, PULVERSCHNEE_BONUS, getLevel, levelLabel, levelStars,
} from '../../game_logic.js';
import { currentTime, ranking, scoreRows, roundEntries, adjustPlayer } from '../flow_logic.js';
import { store, saveGame } from '../v2_store.js';
import { registerScreen, go, previousScreen } from '../v2_router.js';
import { openSheet } from '../v2_sheet.js';
import { initial, formatPoints, formatDelta } from '../v2_chrome.js';
import { startNewGame } from './setup_screens.js';

const MENU_SCREENS = new Set(['menu', 'menu_scores', 'menu_rules', 'menu_adjust']);
const LEVELS = ['anfaenger', 'fortgeschritten', 'profi'];
const SLOPE_NAMES = { blue: 'Blau', red: 'Rot', black: 'Schwarz', yellow: 'Gelb' };

let origin = null;   // { id, params } of the game screen the menu was opened from

const clone = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
const refIn = el => name => el.querySelector(`[data-ref="${name}"]`);

/** Call first in every menu mount: remembers where to return, returns whether we came from the menu. */
function enterMenu() {
  const prev = previousScreen();
  if (prev && !MENU_SCREENS.has(prev.id)) origin = prev;
  return prev?.id === 'menu';
}

function closeMenu() {
  go(origin?.id ?? 'turn_start', origin?.params ?? {}, { back: true });
}

/** A page opened from the menu goes back to the menu; opened directly (score strip) back to the game. */
function pageBack(cameFromMenu) {
  return () => (cameFromMenu ? go('menu', {}, { back: true }) : closeMenu());
}

// ── Menu ──

registerScreen('menu', {
  chrome: false,
  mount(el) {
    enterMenu();
    const game = store.game;
    if (!game) return go('home');
    const ref = refIn(el);
    ref('status').textContent = `Runde ${game.round} von ${game.totalRounds} · ${currentTime(game)}`;
    ref('close').addEventListener('click', closeMenu);
    ref('scores').addEventListener('click', () => go('menu_scores'));
    ref('rules').addEventListener('click', () => go('menu_rules'));
    ref('adjust').addEventListener('click', () => openSheet({
      title: 'Punkte und Münzen ändern?',
      text: 'Nur zum Korrigieren von Fehlern.',
      actions: [
        { label: 'Anpassen', onClick: () => go('menu_adjust') },
        { label: 'Abbrechen', kind: 'text' },
      ],
    }));
    ref('newGame').addEventListener('click', startNewGame);
    ref('home').addEventListener('click', () => go('home'));
  },
});

// ── Punkte: ranking + Punkteverlauf ──

registerScreen('menu_scores', {
  chrome: false,
  mount(el) {
    const cameFromMenu = enterMenu();
    const game = store.game;
    if (!game) return go('home');
    const ref = refIn(el);
    ref('close').addEventListener('click', pageBack(cameFromMenu));

    ref('ranking').replaceChildren(...ranking(game).map(({ playerIdx, rank, points }) => {
      const p = game.players[playerIdx];
      const row = clone('tpl-rank-row');
      const r = refIn(row);
      row.classList.add(`player-${p.colorIndex}`);
      r('rank').textContent = `${rank}.`;
      r('avatar').textContent = initial(p.name);
      r('name').textContent = p.name;
      r('meta').textContent = levelStars(getLevel(points));
      r('meta').setAttribute('aria-label', levelLabel(getLevel(points)));
      r('points').textContent = formatPoints(points);
      return row;
    }));

    const rows = scoreRows(game);
    // The live row always exists, so "no data" means: nobody has played a turn yet.
    const hasData = rows.some(row => row.cells.some(Boolean));
    ref('empty').hidden = hasData;
    ref('tableWrap').hidden = !hasData;
    ref('head').append(...game.players.map(p => {
      const th = clone('tpl-score-head');
      th.classList.add(`player-${p.colorIndex}`);
      th.querySelector('[data-ref="avatar"]').textContent = initial(p.name);
      th.setAttribute('aria-label', p.name);
      return th;
    }));
    ref('body').replaceChildren(...rows.map(row => {
      const tr = clone('tpl-score-row');
      tr.classList.toggle('is-live', row.live);
      tr.querySelector('[data-ref="time"]').textContent = row.time;
      tr.append(...row.cells.map((cell, playerIdx) => {
        if (!cell) return clone('tpl-score-empty');
        const td = clone('tpl-score-cell');
        const r = refIn(td);
        r('points').textContent = formatPoints(cell.points);
        r('delta').textContent = formatDelta(cell.delta);
        r('delta').classList.add(cell.delta > 0 ? 'is-up' : cell.delta < 0 ? 'is-down' : 'is-zero');
        r('btn').setAttribute('aria-label', `${game.players[playerIdx].name}, ${row.time}: ${formatPoints(cell.points)} Punkte (${formatDelta(cell.delta)})`);
        r('btn').addEventListener('click', () => showRound(game, row, playerIdx));
        return td;
      }));
      return tr;
    }));
  },
});

/** Round detail (FEAT-23): everything the player did in that round. */
function showRound(game, row, playerIdx) {
  const entries = roundEntries(game, row.round, playerIdx);
  const list = clone('tpl-round-entries');
  list.append(...entries.map(h => {
    const li = clone('tpl-round-entry');
    li.textContent = h.text;
    return li;
  }));
  openSheet({
    title: `${game.players[playerIdx].name} · ${row.time}`,
    text: entries.length ? '' : 'Keine Einträge in dieser Runde.',
    body: entries.length ? list : null,
    actions: [{ label: 'OK' }],
  });
}

// ── Würfel & Regeln ──

registerScreen('menu_rules', {
  chrome: false,
  mount(el) {
    const cameFromMenu = enterMenu();
    const ref = refIn(el);
    ref('close').addEventListener('click', pageBack(cameFromMenu));
    ref('cards').replaceChildren(...ruleCards().map(({ title, items }) => {
      const card = clone('tpl-rule-card');
      card.querySelector('[data-ref="title"]').textContent = title;
      card.querySelector('[data-ref="list"]').append(...items.map(({ img, label, text }) => {
        const li = clone('tpl-rule-item');
        const r = refIn(li);
        if (img) {
          r('img').src = img;
          r('img').hidden = false;
        }
        r('label').textContent = label;
        r('text').textContent = text;
        return li;
      }));
      return card;
    }));
  },
});

/** The reference content, built from the rule constants so it can never drift from the game logic. */
function ruleCards() {
  const levelRange = {
    anfaenger: `0–${LEVEL_MAX_POINTS.anfaenger} Punkte`,
    fortgeschritten: `${LEVEL_MAX_POINTS.anfaenger + 1}–${LEVEL_MAX_POINTS.fortgeschritten} Punkte`,
    profi: `ab ${LEVEL_MAX_POINTS.fortgeschritten + 1} Punkten`,
  };
  const eventText = {
    fahrt: '+1 Gratis Fahrt (Münze)',
    helikopter: 'Ins nächste Tal, keine Abfahrt – Joker wendet ab',
    schneesturm: 'Nur halb so viele Kreuzungen, Punkte bleiben voll – Joker: volle Fahrt',
    pulverschnee: '+' + PULVERSCHNEE_BONUS + ' Punkte, wenn du abfährst',
    unfall: 'Keine Abfahrt diese Runde – Joker wendet ab',
    sonne: '+1 Joker (Münze)',
  };
  const eventName = {
    fahrt: '+1 Fahrt', helikopter: 'Helikopter', schneesturm: 'Schneesturm',
    pulverschnee: 'Pulverschnee', unfall: 'Unfall', sonne: 'Sonne',
  };
  return [
    {
      title: 'Fahrniveau & Abfahrtswürfel',
      items: LEVELS.map(level => ({
        label: `${levelStars(level)} ${levelLabel(level)}`,
        text: `${levelRange[level]} · Würfel ${[...new Set(DESCENT_DICE[level].faces)].join(' / ')} · `
          + `Pisten: ${ALLOWED_SLOPES[level].map(c => SLOPE_NAMES[c]).join(', ')}`,
      })),
    },
    {
      title: 'Pisten',
      items: [
        ...Object.entries(SLOPE_PTS).map(([c, pts]) => ({ label: SLOPE_NAMES[c], text: `${pts} Punkte pro Kreuzung` })),
        { label: 'Ohne Befugnis', text: 'Entscheidungswürfel: fröhlich = volle Punkte, traurig = Punkte negativ' },
      ],
    },
    {
      title: 'Ereigniswürfel',
      items: EVENT_SYMBOLS.map(sym => ({ img: `../img/event_${sym}.png`, label: eventName[sym], text: eventText[sym] })),
    },
    {
      title: 'Beförderungswürfel',
      items: [
        { label: '2 gleiche', text: 'Eine Fahrt mit diesem Lift' },
        { label: '3 gleiche', text: 'Gegen ein Symbol tauschen, das 1× gewürfelt wurde' },
        { label: '6 gleiche', text: 'Freie Fahrt, beliebig weit' },
        { label: '2 Würfe', text: 'Nach dem 1. Wurf Würfel behalten und nochmal würfeln' },
        { label: 'Joker', text: 'Dreht einen Würfel auf ein beliebiges Symbol' },
        ...TRANSPORT_SYMBOLS.map((sym, i) => ({ img: `../img/transport_${sym}.png`, label: TRANSPORT_NAMES[i], text: '' })),
      ],
    },
    {
      title: 'Weitere Regeln',
      items: [
        { img: '../img/entscheidung_froehlich.svg', label: 'Extraaktivität', text: `Ab ★★: fröhlicher Smiley = +${EXTRA_ACTIVITY_POINTS} Punkte` },
        { label: 'Mittagspause', text: `11:00–12:30, einmal: Restaurant +${PAUSE_POINTS.restaurant}, Bar +${PAUSE_POINTS.bar}` },
        { label: 'Sehenswürdigkeiten', text: '+5, +10, +15 … – jede weitere 5 mehr' },
        { label: 'Münzen', text: `${COIN_LIMIT} gleichzeitig → alle zurückgeben · übrige Münzen +5 in der Schlusswertung` },
        { label: 'Talstation', text: 'Am Ende nicht erreicht → Strafpunkte in der Schlusswertung' },
      ],
    },
  ];
}

// ── Anpassungen ──

registerScreen('menu_adjust', {
  chrome: false,
  mount(el) {
    const cameFromMenu = enterMenu();
    const game = store.game;
    if (!game) return go('home');
    const ref = refIn(el);
    const back = pageBack(cameFromMenu);
    ref('close').addEventListener('click', back);

    // Edited on a copy; nothing changes until "Speichern".
    const draft = game.players.map(p => ({ points: p.points, joker: p.joker, gratis: p.gratis }));
    const maxCoins = COIN_LIMIT - 1;

    ref('players').replaceChildren(...game.players.map((p, i) => {
      const card = clone('tpl-adjust-card');
      const r = refIn(card);
      const d = draft[i];
      card.classList.add(`player-${p.colorIndex}`);
      r('avatar').textContent = initial(p.name);
      r('name').textContent = p.name;
      const input = r('points');
      input.setAttribute('aria-label', `Punkte ${p.name}`);

      function render() {
        input.value = d.points;
        r('joker').textContent = d.joker;
        r('gratis').textContent = d.gratis;
        card.querySelectorAll('[data-field="joker"] .stepper__btn, [data-field="gratis"] .stepper__btn').forEach(btn => {
          const field = btn.closest('[data-field]').dataset.field;
          const step = Number(btn.dataset.step);
          btn.disabled = step < 0 ? d[field] === 0 : d.joker + d.gratis >= maxCoins;
        });
      }

      card.querySelectorAll('.stepper__btn').forEach(btn => {
        const field = btn.closest('[data-field]').dataset.field;
        const label = { points: 'Punkte', joker: 'Joker', gratis: 'Gratis Fahrt' }[field];
        btn.setAttribute('aria-label', `${label} ${p.name} ${Number(btn.dataset.step) > 0 ? 'mehr' : 'weniger'}`);
        btn.addEventListener('click', () => {
          d[field] += Number(btn.dataset.step);
          render();
        });
      });
      input.addEventListener('change', () => {
        const value = parseInt(input.value, 10);
        if (Number.isFinite(value)) d.points = value;
        render();
      });

      render();
      return card;
    }));

    ref('save').addEventListener('click', () => {
      draft.forEach((values, i) => adjustPlayer(game, i, values));
      saveGame();
      back();
    }, { once: true });
  },
});
