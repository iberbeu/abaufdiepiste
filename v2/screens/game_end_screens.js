// GAME END — flow_spec.md §6: game_end → schlusswertung (per player, FEAT-22) → ranking.
// Schlusswertung steps per player: 1 "Talstation erreicht?" (Ja → 3), 2 Rückweg (slope tiles at
// half points, rides, extra Talstationen), 3 summary → Bestätigen books it (applySchlusswertung).
// Answers live in a module-level draft until confirmed; a reload restarts the current player.

import { SLOPE_PTS } from '../../game_logic.js';
import {
  endTime, ranking, nextSchlusswertungPlayer, previewSchlusswertung, applySchlusswertung,
} from '../flow_logic.js';
import { store, saveGame } from '../v2_store.js';
import { registerScreen, go, previousScreen } from '../v2_router.js';
import { initial, formatPoints, formatDelta } from '../v2_chrome.js';
import { confetti } from '../v2_fx.js';

const SLOPES = ['blue', 'red', 'black', 'yellow'];
const SLOPE_NAMES = { blue: 'Blau', red: 'Rot', black: 'Schwarz', yellow: 'Gelb' };
const PODIUM_PLACES = 3;

const clone = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
const refIn = el => name => el.querySelector(`[data-ref="${name}"]`);

/** Where a finished game continues: the next Schlusswertung, or the ranking once all are done. */
export function finishedGameScreen(game) {
  return nextSchlusswertungPlayer(game) === -1 ? 'ranking' : 'game_end';
}

// ── Game end ──

registerScreen('game_end', {
  chrome: false,
  mount(el) {
    const game = store.game;
    if (!game) return go('home');
    if (!game.finished) return go('turn_start');
    if (nextSchlusswertungPlayer(game) === -1) return go('ranking');
    const ref = refIn(el);
    ref('time').textContent = endTime(game.totalRounds);
    ref('start').addEventListener('click', () => go('schlusswertung'), { once: true });
  },
});

// ── Schlusswertung ──

let draft = null;   // { game, playerIdx, step: 'reached'|'return'|'summary', reached, slopes, transports, extraTalstationen }

function draftFor(game, playerIdx) {
  // Keyed by game too: another game's unconfirmed answers must never leak into this one.
  if (draft?.game !== game || draft.playerIdx !== playerIdx) {
    draft = {
      game, playerIdx, step: 'reached', reached: null,
      slopes: { blue: 0, red: 0, black: 0, yellow: 0 }, transports: 0, extraTalstationen: 0,
    };
  }
  return draft;
}

registerScreen('schlusswertung', {
  chrome: false,
  mount(el) {
    const game = store.game;
    if (!game) return go('home');
    if (!game.finished) return go('turn_start');
    const idx = nextSchlusswertungPlayer(game);
    if (idx === -1) return go('ranking');

    const d = draftFor(game, idx);
    const p = game.players[idx];
    const ref = refIn(el);
    const answers = () => ({ reached: d.reached, slopes: d.slopes, transports: d.transports, extraTalstationen: d.extraTalstationen });

    ref('hero').classList.add(`player-${p.colorIndex}`);
    ref('avatar').textContent = initial(p.name);
    ref('name').textContent = p.name;
    ref('progress').textContent = `Schlusswertung ${idx + 1}/${game.players.length}`;
    ref('talstation').textContent = p.talstation || 'Talstation vom Spielbeginn';

    const tiles = Object.fromEntries(SLOPES.map(color => {
      const tile = clone('tpl-slope-tile');
      tile.classList.add(`slope-tile--${color}`);
      tile.querySelector('[data-ref="name"]').textContent = SLOPE_NAMES[color];
      tile.querySelector('[data-ref="pts"]').textContent = `−${SLOPE_PTS[color] / 2} pro Kreuzung`;
      tile.querySelector('[data-ref="plus"]').setAttribute('aria-label', `${SLOPE_NAMES[color]}: eine Kreuzung mehr`);
      tile.querySelector('[data-ref="minus"]').setAttribute('aria-label', `${SLOPE_NAMES[color]}: eine Kreuzung weniger`);
      tile.querySelector('[data-ref="plus"]').addEventListener('click', () => { d.slopes[color]++; render(); });
      tile.querySelector('[data-ref="minus"]').addEventListener('click', () => {
        if (d.slopes[color] > 0) d.slopes[color]--;
        render();
      });
      return [color, tile];
    }));
    ref('tiles').replaceChildren(...SLOPES.map(c => tiles[c]));

    el.querySelectorAll('.stepper[data-field]').forEach(stepper => {
      const field = stepper.dataset.field;
      stepper.querySelectorAll('.stepper__btn').forEach(btn => btn.addEventListener('click', () => {
        d[field] = Math.max(0, d[field] + Number(btn.dataset.step));
        render();
      }));
    });

    function render() {
      ref('stepReached').hidden = d.step !== 'reached';
      ref('stepReturn').hidden = d.step !== 'return';
      ref('stepSummary').hidden = d.step !== 'summary';
      ref('back').hidden = d.step === 'reached';
      el.classList.toggle('is-compact', d.step !== 'reached');   // small header, room for tiles and steppers

      SLOPES.forEach(color => {
        const count = d.slopes[color];
        const tile = tiles[color];
        tile.classList.toggle('is-selected', count > 0);
        tile.classList.toggle('is-empty', count === 0);
        tile.querySelector('[data-ref="count"]').hidden = count === 0;
        tile.querySelector('[data-ref="count"]').textContent = count;
        tile.querySelector('[data-ref="minus"]').disabled = count === 0;
      });
      ['transports', 'extraTalstationen'].forEach(field => {
        ref(field).textContent = d[field];
        el.querySelector(`.stepper[data-field="${field}"] [data-step="-1"]`).disabled = d[field] === 0;
      });

      if (d.reached !== null) {
        const result = previewSchlusswertung(game, idx, answers());
        ref('penalty').textContent = `Strafe: ${formatDelta(result.penaltyTotal)}`;
        renderSummary(result);
      }
    }

    function renderSummary(result) {
      const lines = [...result.penaltyItems];
      const coins = p.joker + p.gratis;
      if (coins > 0) lines.push({ label: `${coins} ${coins === 1 ? 'Münze' : 'Münzen'} übrig`, amount: result.coinBonus });
      if (lines.length === 0) lines.push({ label: 'Talstation erreicht', amount: 0 });
      ref('lines').replaceChildren(...lines.map(({ label, amount }) => {
        const li = clone('tpl-summary-line');
        li.querySelector('[data-ref="label"]').textContent = label;
        const a = li.querySelector('[data-ref="amount"]');
        a.textContent = formatDelta(amount);
        a.classList.toggle('is-up', amount > 0);
        a.classList.toggle('is-down', amount < 0);
        return li;
      }));
      ref('total').textContent = `${formatDelta(result.netDelta)} → ${formatPoints(p.points + result.netDelta)} Punkte`;
    }

    ref('yes').addEventListener('click', () => {
      // "Ja" makes any Rückweg answers from an earlier "Nein" void — start clean if they switch back.
      Object.assign(d, { reached: true, step: 'summary', slopes: { blue: 0, red: 0, black: 0, yellow: 0 }, transports: 0, extraTalstationen: 0 });
      render();
    });
    ref('no').addEventListener('click', () => { d.reached = false; d.step = 'return'; render(); });
    ref('toSummary').addEventListener('click', () => { d.step = 'summary'; render(); });
    ref('back').addEventListener('click', () => {
      d.step = d.step === 'summary' && d.reached === false ? 'return' : 'reached';
      render();
    });
    ref('confirm').addEventListener('click', () => {
      applySchlusswertung(game, idx, answers());
      saveGame();
      draft = null;
      go(finishedGameScreen(game) === 'ranking' ? 'ranking' : 'schlusswertung');
    }, { once: true });

    render();
  },
});

// ── Ranking ──

registerScreen('ranking', {
  chrome: false,
  mount(el) {
    const game = store.game;
    if (!game) return go('home');
    if (!game.finished) return go('turn_start');
    if (nextSchlusswertungPlayer(game) !== -1) return go('game_end');
    const ref = refIn(el);
    fillRanking(ref, ranking(game), game.players);

    ref('newGame').addEventListener('click', () => go('setup_players', { fresh: true }));
    ref('history').addEventListener('click', () => go('menu_scores'));

    // Confetti only right after the last Schlusswertung — not on every return from the Punkteverlauf.
    if (previousScreen()?.id === 'schlusswertung') return confetti();
  },
});

/**
 * Fills a ranking view: podium for the top places, the rest as rows. Shared with the Punkteblock end.
 * @param {(name: string) => Element} ref — finds [data-ref="podium"] and [data-ref="rest"]
 * @param {Array<{ playerIdx: number, rank: number, points: number }>} order — from ranking() / padRanking()
 * @param {Array<{ name: string, colorIndex: number }>} players
 */
export function fillRanking(ref, order, players) {
  const place = ({ playerIdx, rank, points }, i) => {
    const position = i + 1;
    const pl = players[playerIdx];
    const li = clone('tpl-podium-place');
    const r = refIn(li);
    // Position decides the podium order (2nd – 1st – 3rd), rank the block height: tied players stand equally high.
    li.classList.add(`player-${pl.colorIndex}`, `podium__place--pos-${position}`, `podium__place--${Math.min(rank, PODIUM_PLACES)}`);
    r('avatar').textContent = initial(pl.name);
    r('name').textContent = pl.name;
    r('points').textContent = formatPoints(points);
    r('rank').textContent = rank;
    li.setAttribute('aria-label', `${rank}. Platz: ${pl.name}, ${formatPoints(points)} Punkte`);
    return li;
  };
  ref('podium').replaceChildren(...order.slice(0, PODIUM_PLACES).map(place));
  ref('rest').replaceChildren(...order.slice(PODIUM_PLACES).map(({ playerIdx, rank, points }) => {
    const pl = players[playerIdx];
    const row = clone('tpl-rank-row');
    const r = refIn(row);
    row.classList.add(`player-${pl.colorIndex}`);
    r('rank').textContent = `${rank}.`;
    r('avatar').textContent = initial(pl.name);
    r('name').textContent = pl.name;
    r('points').textContent = formatPoints(points);
    return row;
  }));
}
