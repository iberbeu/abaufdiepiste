// BERGAB — flow_spec.md §5 (D1 bergab_roll, D2 bergab_result), §10.2 (Ohne Befugnis), §10.3 (Extraaktivität).
// D1: descent die (level stars) + event die, both "?", Würfeln (back possible).
// D2: event effect, Joker badge on the event die, crossings headline + dots, 2×2 slope tiles
// (top half +, bottom half −), Ohne-Befugnis sheet on the first + of a forbidden slope,
// 🎲 Extraaktivität, one primary button with the turn total → turn end.
// State lives in turn.data (turn_state.js); coins from Sonne / +1 Fahrt are booked at roll time.

import {
  DESCENT_DICE, ALLOWED_SLOPES, SLOPE_PTS, EVENT_SYMBOLS, JOKER_EVENTS, EXTRA_ACTIVITY_POINTS,
  getLevel, levelLabel, levelStars,
} from '../../game_logic.js';
import { rollDice, gainCoin, spendCoin, addHistory, currentPlayer, descentTurn } from '../flow_logic.js';
import { store, saveGame } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { renderChrome } from '../v2_chrome.js';
import { openSheet } from '../v2_sheet.js';
import { beginAction, activeTurn, markRolled } from '../turn_state.js';
import { playRoll } from '../v2_dice.js';

const SLOPES = ['blue', 'red', 'black', 'yellow'];
const SLOPE_NAMES = { blue: 'Blau', red: 'Rot', black: 'Schwarz', yellow: 'Gelb' };
const EVENT_NAMES = {
  fahrt: '+1 Fahrt', helikopter: 'Helikopter', schneesturm: 'Schneesturm',
  pulverschnee: 'Pulverschnee', unfall: 'Unfall', sonne: 'Sonne',
};
const BLOCKED_TEXT = { unfall: 'Unfall – diese Runde keine Abfahrt', helikopter: 'Helikopter – ab ins nächste Tal' };
const IMG_HAPPY = '../img/entscheidung_froehlich.svg';
const IMG_SAD = '../img/entscheidung_traurig.svg';

const clone = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
const filledStars = level => levelStars(level).replace(/☆/g, '');
const eventImg = sym => `../img/event_${sym}.png`;
const rollOne = faces => rollDice([null], [false], faces)[0];
const rollSmiley = () => rollOne([true, false]);   // true = happy smiley
const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

// ── D1: before the roll ──

registerScreen('bergab_roll', {
  chrome: true,
  mount(el) {
    const game = store.game;
    if (!game) return go('home');
    const t = activeTurn(game);
    if (t?.rolled) return go(t.resume);

    const ref = name => el.querySelector(`[data-ref="${name}"]`);
    const level = getLevel(currentPlayer(game).points);
    ref('stars').textContent = filledStars(level);
    ref('descent').setAttribute('aria-label', `Abfahrtswürfel ${levelLabel(level)}`);
    ref('back').addEventListener('click', () => go('turn_start', {}, { back: true }));

    ref('roll').addEventListener('click', () => {
      const event = rollOne(EVENT_SYMBOLS);
      // Coins from the event die are booked right away: the roll is final.
      const coin = event === 'sonne' ? 'joker' : event === 'fahrt' ? 'gratis' : null;
      const limitHit = coin ? gainCoin(game, coin).limitHit : false;
      beginAction(game, 'bergab', {
        level,
        descent: rollOne(DESCENT_DICE[level].faces),
        event,
        jokerOnEvent: false,
        slopes: { blue: 0, red: 0, black: 0, yellow: 0 },
        ohneBefugnis: null,     // null = not rolled, true = happy smiley, false = sad smiley
        extra: null,            // null = not rolled, 0 or EXTRA_ACTIVITY_POINTS
        pendingRoll: true,      // played once by D2, then cleared
        coinLimitHit: limitHit, // the event coin was the 3rd → all coins returned
        pendingLimit: limitHit, // coin-limit sheet shown once by D2
      });
      markRolled('bergab_result');
      saveGame();
      go('bergab_result');
    }, { once: true });
  },
});

// ── D2: result, slopes, total ──

registerScreen('bergab_result', {
  chrome: true,
  mount(el) {
    const game = store.game;
    const turn = game && activeTurn(game);
    if (!turn || turn.action !== 'bergab' || !turn.rolled) return go(game ? 'turn_start' : 'home');

    const d = turn.data;
    const allowed = ALLOWED_SLOPES[d.level];
    const ref = name => el.querySelector(`[data-ref="${name}"]`);
    const player = () => currentPlayer(game);
    let rolling = false;
    let cancelRoll = () => {};

    const tiles = Object.fromEntries(SLOPES.map(color => {
      const tile = clone('tpl-slope-tile');
      tile.classList.add(`slope-tile--${color}`);
      tile.querySelector('[data-ref="name"]').textContent = SLOPE_NAMES[color];
      tile.querySelector('[data-ref="pts"]').textContent = `${SLOPE_PTS[color]} Punkte`;
      tile.querySelector('[data-ref="plus"]').setAttribute('aria-label', `${SLOPE_NAMES[color]}: eine Kreuzung mehr`);
      tile.querySelector('[data-ref="minus"]').setAttribute('aria-label', `${SLOPE_NAMES[color]}: eine Kreuzung weniger`);
      tile.querySelector('[data-ref="plus"]').addEventListener('click', () => add(color));
      tile.querySelector('[data-ref="minus"]').addEventListener('click', () => remove(color));
      return [color, tile];
    }));
    ref('tiles').replaceChildren(...SLOPES.map(c => tiles[c]));

    function render() {
      const p = player();
      const state = descentTurn(d, allowed);

      ref('value').textContent = rolling ? ref('value').textContent : d.descent;
      ref('stars').textContent = filledStars(d.level);
      ref('descent').setAttribute('aria-label', `Abfahrtswürfel ${levelLabel(d.level)}: ${d.descent}`);
      if (!rolling) {
        ref('eventImg').src = eventImg(d.event);
        ref('eventImg').alt = EVENT_NAMES[d.event];
      }
      ref('eventJoker').hidden = rolling || !JOKER_EVENTS.includes(d.event) || d.jokerOnEvent || p.joker === 0;

      renderEventLine();

      // Crossings headline + dots
      ref('crossings').hidden = rolling || state.blocked;
      ref('crossLabel').textContent = `${state.maxCrossings} ${state.maxCrossings === 1 ? 'Kreuzung' : 'Kreuzungen'}`;
      ref('dots').replaceChildren(...Array.from({ length: state.maxCrossings }, (_, i) => {
        const dot = clone('tpl-dot');
        dot.classList.toggle('is-used', i < state.used);
        return dot;
      }));

      // Tiles or the blocked message
      ref('tiles').hidden = rolling || state.blocked;
      ref('blocked').hidden = rolling || !state.blocked;
      ref('blockedText').textContent = BLOCKED_TEXT[d.event] ?? '';
      SLOPES.forEach(renderTile);

      // Extraaktivität: from Fortgeschritten on, not while the descent is blocked
      const extra = ref('extra');
      extra.hidden = rolling || d.level === 'anfaenger' || state.blocked;
      extra.classList.toggle('is-done-good', d.extra === EXTRA_ACTIVITY_POINTS);
      extra.classList.toggle('is-done-bad', d.extra === 0);
      extra.disabled = d.extra !== null;
      ref('extraIcon').hidden = d.extra !== null;
      ref('extraLabel').hidden = d.extra === null;
      ref('extraLabel').textContent = d.extra === null ? '' : signed(d.extra);
      extra.setAttribute('aria-label', d.extra === null ? 'Extraaktivität würfeln' : `Extraaktivität: ${signed(d.extra)} Punkte`);

      // Spoken summary for screen readers (the dots and tile badges are visual only)
      ref('live').textContent = rolling || state.blocked ? ''
        : `${state.used} von ${state.maxCrossings} Kreuzungen, ${signed(state.total)} Punkte`;

      // Primary button = turn total
      const primary = ref('primary');
      primary.disabled = rolling;
      primary.textContent = state.total === 0 ? 'Weiter →' : `${signed(state.total)} →`;
      primary.classList.toggle('btn-primary--negative', state.total < 0);
    }

    function renderEventLine() {
      const line = ref('eventLine');
      const text = eventLineText();
      line.hidden = rolling || !text;
      line.textContent = text;
      const good = d.jokerOnEvent || (!d.coinLimitHit && ['sonne', 'fahrt', 'pulverschnee'].includes(d.event));
      line.classList.toggle('result-line--good', good);
      line.classList.toggle('result-line--bad', !good);
    }

    function eventLineText() {
      if (d.jokerOnEvent) return d.event === 'schneesturm' ? 'Joker: volle Fahrt' : `Joker: ${EVENT_NAMES[d.event]} abgewendet`;
      if (d.coinLimitHit) return '3 Münzen – alle zurückgegeben';
      return {
        sonne: '+1 Joker',
        fahrt: '+1 Gratis Fahrt',
        pulverschnee: 'Pulverschnee: +5 mit Abfahrt',
        schneesturm: 'Schneesturm – halbe Strecke',
      }[d.event] ?? '';
    }

    function renderTile(color) {
      const tile = tiles[color];
      const count = d.slopes[color];
      const forbidden = !allowed.includes(color);
      tile.classList.toggle('is-selected', count > 0);
      tile.classList.toggle('is-empty', count === 0);
      tile.classList.toggle('is-forbidden', forbidden);
      const badge = tile.querySelector('[data-ref="count"]');
      badge.hidden = count === 0;
      badge.textContent = count;
      // Flag (top left): ⚠ on forbidden slopes, replaced by the Entscheidungswürfel result once rolled.
      tile.querySelector('[data-ref="flag"]').hidden = !forbidden;
      tile.querySelector('[data-ref="warn"]').hidden = d.ohneBefugnis !== null;
      const smiley = tile.querySelector('[data-ref="smiley"]');
      smiley.hidden = d.ohneBefugnis === null;
      if (d.ohneBefugnis !== null) {
        smiley.src = d.ohneBefugnis ? IMG_HAPPY : IMG_SAD;
        smiley.alt = d.ohneBefugnis ? 'Fröhlicher Smiley' : 'Trauriger Smiley';
      }
      tile.querySelector('[data-ref="minus"]').disabled = count === 0;
      tile.querySelector('[data-ref="plus"]').setAttribute('aria-label',
        `${SLOPE_NAMES[color]}${forbidden ? ' (ohne Befugnis)' : ''}: eine Kreuzung mehr, jetzt ${count}`);
    }

    function add(color) {
      const { used, maxCrossings } = descentTurn(d, allowed);
      if (used >= maxCrossings) return bump(color);
      if (!allowed.includes(color) && d.ohneBefugnis === null) return openOhneBefugnis(color);
      d.slopes[color]++;
      render();
    }

    function remove(color) {
      if (d.slopes[color] === 0) return;
      d.slopes[color]--;
      render();
    }

    /** All crossings used: the tile shakes, the dots flash (animations replay only on a fresh class). */
    function bump(color) {
      const tile = tiles[color];
      const crossings = ref('crossings');
      tile.classList.remove('is-bumped');
      crossings.classList.remove('is-full');
      void tile.offsetWidth;
      tile.classList.add('is-bumped');
      crossings.classList.add('is-full');
    }

    // ── Sheets ──

    function openOhneBefugnis(color) {
      openSheet({
        title: 'Ohne Befugnis',
        text: 'Der Entscheidungswürfel entscheidet.',
        actions: [
          { label: 'Würfeln', onClick: () => {
            d.ohneBefugnis = rollSmiley();
            d.slopes[color]++;
            render();
            showSmiley(d.ohneBefugnis, {
              happy: { title: 'Geschafft – volle Punkte' },
              sad: { title: 'Negative Punkte', text: 'Pisten ohne Befugnis zählen minus.' },
              onJoker: () => { d.ohneBefugnis = true; },
            });
          } },
          { label: 'Abbrechen', kind: 'text' },
        ],
      });
    }

    function openExtra() {
      if (d.extra !== null) return;
      openSheet({
        title: 'Extraaktivität',
        text: `Fröhlicher Smiley: +${EXTRA_ACTIVITY_POINTS} Punkte`,
        actions: [
          { label: 'Würfeln', onClick: () => {
            const happy = rollSmiley();
            d.extra = happy ? EXTRA_ACTIVITY_POINTS : 0;
            render();
            showSmiley(happy, {
              happy: { title: `+${EXTRA_ACTIVITY_POINTS} Punkte` },
              sad: { title: 'Leider nicht geschafft' },
              onJoker: () => { d.extra = EXTRA_ACTIVITY_POINTS; },
            });
          } },
          { label: 'Abbrechen', kind: 'text' },
        ],
      });
    }

    /** Result of an Entscheidungswürfel roll; on a sad smiley a Joker can turn it happy (§10.2, §10.3). */
    function showSmiley(happy, { happy: happyText, sad: sadText, onJoker }) {
      const body = clone('tpl-decision-die');
      body.src = happy ? IMG_HAPPY : IMG_SAD;
      body.alt = happy ? 'Fröhlicher Smiley' : 'Trauriger Smiley';
      const actions = [];
      if (!happy && player().joker > 0) {
        actions.push({ label: 'Joker nutzen', onClick: () => {
          if (!spendCoin(game, 'joker')) return;
          onJoker();
          saveGame();
          renderChrome();
          render();
        } });
      }
      actions.push({ label: 'OK', kind: actions.length ? 'text' : 'primary' });
      openSheet({ ...(happy ? happyText : sadText), body, actions });
    }

    function openEventJoker() {
      const text = d.event === 'schneesturm'
        ? `Volle Fahrt: ${d.descent} Kreuzungen`
        : `${EVENT_NAMES[d.event]} abwenden – du darfst fahren.`;
      openSheet({
        title: 'Joker einsetzen?',
        text,
        actions: [
          { label: 'Einsetzen', onClick: () => {
            if (!spendCoin(game, 'joker')) return;
            d.jokerOnEvent = true;
            saveGame();
            renderChrome();
            render();
          } },
          { label: 'Abbrechen', kind: 'text' },
        ],
      });
    }

    function finish() {
      const state = descentTurn(d, allowed);
      const p = player();
      p.points += state.total;
      addHistory(game, historyText(d, state));
      saveGame();
      go('turn_end', { points: state.total });
    }

    ref('eventJoker').addEventListener('click', openEventJoker);
    ref('extra').addEventListener('click', openExtra);
    ref('primary').addEventListener('click', finish, { once: true });

    function showCoinLimit() {
      if (!d.pendingLimit) return;
      d.pendingLimit = false;
      openSheet({
        title: '3 Münzen – alle zurückgeben',
        text: 'Wer drei Münzen gleichzeitig hat, gibt alle zurück.',
        actions: [{ label: 'OK' }],
      });
    }

    // Only the first mount after the roll animates; a remount (menu → back) shows the result directly.
    if (d.pendingRoll) {
      d.pendingRoll = false;
      rolling = true;
      render();
      cancelRoll = playRoll([ref('descent'), ref('event')], die => {
        if (die === ref('descent')) ref('value').textContent = rollOne(DESCENT_DICE[d.level].faces);
        else ref('eventImg').src = eventImg(rollOne(EVENT_SYMBOLS));
      }, () => {
        rolling = false;
        render();
        showCoinLimit();
      });
    } else {
      render();
      showCoinLimit();
    }

    return () => cancelRoll();
  },
});

function historyText(d, state) {
  if (state.blocked) return `Bergab: ${EVENT_NAMES[d.event]} – keine Abfahrt`;
  // Pulverschnee / Ohne-Befugnis notes belong to the slopes, the Extraaktivität comes after them.
  const slopes = state.parts.length ? state.parts.join(', ') + state.bonusText : 'keine Kreuzung';
  const extra = d.extra === null ? '' : `, Extraaktivität ${d.extra ? `+${d.extra}` : '0'}`;
  return `Bergab: ${slopes}${extra} → ${signed(state.total)} Punkte`;
}
