// BERGAUF — flow_spec.md §5 (B1 bergauf_roll, B2 bergauf_result) and §10.1 (Joker on a die).
// B1: six "?" dice + Würfeln (back possible). B2: faces, hold after roll 1, second roll,
// one result line per ride, Joker turns one die to any face. Fertig → turn end (points only for
// six of a kind, the jackpot).
// Dice state lives in the shared turn state (turn_state.js), so the menu / back remount B2 as it was.

import {
  TRANSPORT_SYMBOLS, TRANSPORT_NAMES, transportOptions, FREE_RIDE_COUNT, JACKPOT_COUNT, JACKPOT_POINTS,
} from '../game_logic.js';
import { rollDice, spendCoin, addHistory, currentPlayer } from '../flow_logic.js';
import { store, saveGame } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { renderChrome, offerJokerTakeBack } from '../v2_chrome.js';
import { openSheet, closeSheet } from '../v2_sheet.js';
import { beginAction, activeTurn, markRolled, recordJoker, setTurnView } from '../turn_state.js';
import { playRoll } from '../v2_dice.js';

const DICE = 6;
const MAX_ROLLS = 2;
const IMG_UNKNOWN = 'img/dice/die_question.svg';

const nameOf = sym => TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(sym)];
const imgOf = sym => `img/transport_${sym}.png`;
const clone = id => document.getElementById(id).content.firstElementChild.cloneNode(true);

// ── B1: before the first roll ──

registerScreen('bergauf_roll', {
  chrome: true,
  mount(el) {
    const game = store.game;
    if (!game) return go('home');
    const t = activeTurn(game);
    if (t?.rolled) return go(t.resume);

    const ref = name => el.querySelector(`[data-ref="${name}"]`);
    ref('dice').replaceChildren(...Array.from({ length: DICE }, () => {
      const die = clone('tpl-transport-die');
      die.disabled = true;
      die.querySelector('[data-ref="img"]').src = IMG_UNKNOWN;
      return die;
    }));
    ref('back').addEventListener('click', () => go('turn_start', {}, { back: true }));
    ref('roll').addEventListener('click', () => {
      beginAction(game, 'bergauf', {
        dice: rollDice(Array(DICE).fill(null), Array(DICE).fill(false)),
        held: Array(DICE).fill(false),
        jokered: Array(DICE).fill(false),
        jokerFrom: Array(DICE).fill(null),   // face before a Joker turned the die (to take it back)
        rolls: 1,
        pendingRoll: Array(DICE).fill(true),   // played once by B2, then cleared
      });
      markRolled('bergauf_result');
      go('bergauf_result');
    }, { once: true });
  },
});

// ── B2: rolled dice, hold, second roll, result, Joker ──

registerScreen('bergauf_result', {
  chrome: true,
  mount(el) {
    const game = store.game;
    const turn = game && activeTurn(game);
    if (!turn || turn.action !== 'bergauf' || !turn.rolled) return go(game ? 'turn_start' : 'home');

    const d = turn.data;
    const ref = name => el.querySelector(`[data-ref="${name}"]`);
    let cancelRoll = () => {};
    let rolling = false;
    let pickingJoker = false;
    let finished = false;   // primary/secondary swap roles, so { once: true } cannot guard "Fertig"

    const dieEls = d.dice.map((_, i) => {
      const die = clone('tpl-transport-die');
      die.addEventListener('click', () => onDieTap(i));
      return die;
    });
    ref('dice').replaceChildren(...dieEls);

    function render() {
      const p = currentPlayer(game);
      const canHold = d.rolls < MAX_ROLLS && !rolling;
      dieEls.forEach((die, i) => {
        die.querySelector('[data-ref="img"]').src = imgOf(d.dice[i]);
        die.querySelector('[data-ref="img"]').alt = nameOf(d.dice[i]);
        die.classList.toggle('is-held', d.held[i]);
        die.classList.toggle('is-pickable', pickingJoker);
        die.querySelector('[data-ref="held"]').hidden = !d.held[i] || d.jokered[i];
        die.querySelector('[data-ref="jokered"]').hidden = !d.jokered[i];
        die.setAttribute('aria-pressed', String(d.held[i]));
        const state = d.jokered[i] ? ', mit Joker gedreht – antippen zum Zurücknehmen' : d.held[i] ? ', behalten' : pickingJoker ? ', antippen zum Drehen' : '';
        die.setAttribute('aria-label', nameOf(d.dice[i]) + state);
        // A die turned with a Joker is never held/unheld, rolled or turned again — a tap takes the Joker back.
        die.disabled = rolling || (d.jokered[i] ? pickingJoker : !pickingJoker && !canHold);
      });

      ref('dots').querySelectorAll('.dot').forEach((dot, i) => dot.classList.toggle('is-used', i < d.rolls));
      ref('dots').setAttribute('aria-label', `Wurf ${d.rolls} von ${MAX_ROLLS}`);

      const hint = ref('hint');
      hint.textContent = pickingJoker ? 'Welchen Würfel drehen?' : canHold ? 'Antippen = behalten' : '';
      hint.hidden = !hint.textContent;

      const opts = transportOptions(d.dice, d.jokered);
      const valid = Boolean(opts.freeRide || opts.pairs.length || opts.exchanges.length);
      ref('lines').replaceChildren(...(rolling ? [] : resultLines(opts)));

      const joker = ref('joker');
      joker.hidden = rolling || p.joker === 0;
      joker.classList.toggle('is-active', pickingJoker);
      joker.setAttribute('aria-pressed', String(pickingJoker));
      ref('jokerLabel').textContent = pickingJoker ? 'Abbrechen' : `Joker einsetzen (${p.joker})`;

      // After roll 1 the second roll is the usual move, so it is the big button; after roll 2 only "Fertig".
      const canReroll = d.rolls < MAX_ROLLS;
      const allHeld = d.held.every(Boolean);
      const rerollFirst = canReroll && !allHeld;
      const primary = ref('primary');
      const secondary = ref('secondary');
      primary.textContent = rerollFirst ? 'Nochmal würfeln' : 'Fertig →';
      primary.classList.toggle('btn-primary--secondary', rerollFirst);
      secondary.textContent = rerollFirst ? 'Fertig' : 'Nochmal würfeln';
      secondary.hidden = !canReroll;
      primary.disabled = rolling;
      secondary.disabled = rolling || !rerollFirst;
      primary.dataset.action = rerollFirst ? 'reroll' : 'finish';
      secondary.dataset.action = rerollFirst ? 'finish' : 'reroll';
    }

    function onDieTap(i) {
      if (rolling) return;
      if (d.jokered[i]) {
        if (!pickingJoker) offerJokerTakeBack(`die-${i}`, `Der Würfel zeigt wieder ${nameOf(d.jokerFrom[i])}.`);
        return;
      }
      if (pickingJoker) return openFacePicker(i);
      if (d.rolls >= MAX_ROLLS) return;
      d.held[i] = !d.held[i];
      render();
    }

    function onAction(action) {
      if (action === 'reroll') return reroll();
      if (finished) return;
      finished = true;
      const opts = transportOptions(d.dice, d.jokered);
      const points = opts.jackpot ? JACKPOT_POINTS : 0;
      currentPlayer(game).points += points;
      addHistory(game, `Bergauf: ${historyText(opts)}`);
      saveGame();
      go('turn_end', { points });
    }

    function reroll() {
      if (rolling || d.rolls >= MAX_ROLLS || d.held.every(Boolean)) return;
      const toRoll = d.held.map(h => !h);
      d.dice = rollDice(d.dice, d.held);
      d.rolls++;
      pickingJoker = false;
      animateRoll(toRoll);
    }

    /** Rolls the given dice (mask) with the shared animation, then shows the real result. */
    function animateRoll(which) {
      rolling = true;
      render();
      const dice = dieEls.filter((_, i) => which[i]);
      cancelRoll = playRoll(dice, die => {
        die.querySelector('[data-ref="img"]').src = imgOf(TRANSPORT_SYMBOLS[Math.floor(Math.random() * DICE)]);
      }, () => {
        rolling = false;
        render();
      });
    }

    function openFacePicker(i) {
      const body = clone('tpl-face-picker');
      body.append(...TRANSPORT_SYMBOLS.map(sym => {
        const option = clone('tpl-face-option');
        option.querySelector('[data-ref="img"]').src = imgOf(sym);
        option.querySelector('[data-ref="name"]').textContent = nameOf(sym);
        option.classList.toggle('is-selected', sym === d.dice[i]);
        option.addEventListener('click', () => {
          closeSheet();
          if (!spendCoin(game, 'joker')) return;
          const before = { face: d.dice[i], held: d.held[i] };
          d.jokerFrom[i] = before.face;
          recordJoker(game, `die-${i}`, () => {
            d.dice[i] = before.face;
            d.held[i] = before.held;
            d.jokered[i] = false;
          });
          d.dice[i] = sym;
          d.held[i] = true;      // a die turned with a Joker is never rolled again
          d.jokered[i] = true;
          pickingJoker = false;
          saveGame();
          renderChrome();
          render();
        });
        return option;
      }));
      openSheet({ title: 'Würfel drehen auf …', text: 'Kostet 1 Joker.', body, actions: [{ label: 'Abbrechen', kind: 'text' }] });
    }

    ref('primary').addEventListener('click', e => onAction(e.currentTarget.dataset.action));
    ref('secondary').addEventListener('click', e => onAction(e.currentTarget.dataset.action));
    ref('joker').addEventListener('click', () => {
      pickingJoker = !pickingJoker;
      render();
    });

    setTurnView({
      render,
      // The 🃏 in the top bar starts the same "which die?" pick as the button here.
      joker: () => (rolling || finished ? null : { label: 'Würfel drehen', run: () => { pickingJoker = true; render(); } }),
    });

    // Only the first mount after a roll animates; a remount (menu → back) shows the result directly.
    const pending = d.pendingRoll;
    d.pendingRoll = null;
    if (pending) animateRoll(pending);
    else render();

    return () => {
      cancelRoll();
      setTurnView(null);
    };
  },
});

/** One line per ride (flow_spec §5 B2), built from transportOptions(). */
function resultLines(opts) {
  const line = (kind, icon, text) => {
    const li = clone('tpl-result-line');
    li.classList.add(`result-line--${kind}`);
    li.querySelector('[data-ref="icon"]').classList.add(`icon--${icon}`);
    li.querySelector('[data-ref="text"]').textContent = text;
    return li;
  };
  if (opts.freeRide) {
    const count = opts.jackpot ? JACKPOT_COUNT : FREE_RIDE_COUNT;
    const ride = line('good', 'check', `${count}× ${nameOf(opts.freeRide)} – freie Fahrt, beliebig weit`);
    return opts.jackpot ? [ride, line('good', 'check', `Jackpot: +${JACKPOT_POINTS} Punkte`)] : [ride];
  }
  const lines = [
    ...opts.pairs.map(sym => line('good', 'check', `2× ${nameOf(sym)}`)),
    ...opts.exchanges.map(({ from, targets }) =>
      line('good', 'check', `3× ${nameOf(from)} → ${targets.map(t => `2× ${nameOf(t)}`).join(' / ')}`)),
  ];
  return lines.length ? lines : [line('bad', 'warning', 'Liftschlange – nächste Runde nochmal')];
}

function historyText(opts) {
  if (opts.jackpot) return `${JACKPOT_COUNT}× ${nameOf(opts.freeRide)} (freie Fahrt) → +${JACKPOT_POINTS} Punkte`;
  if (opts.freeRide) return `${FREE_RIDE_COUNT}× ${nameOf(opts.freeRide)} (freie Fahrt)`;
  const rides = [
    ...opts.pairs.map(nameOf),
    ...opts.exchanges.map(({ from }) => `Tausch 3× ${nameOf(from)}`),
  ];
  return rides.length ? rides.join(', ') : 'Liftschlange';
}
