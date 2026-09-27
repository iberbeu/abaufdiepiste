// ═══════════════════════════════════════════════════════════════
// App v2 — the turn in progress (not persisted; a reload returns to the turn start).
// Shared by the action screens so that once dice are rolled the action is locked
// (flow_spec §1.8, like v1's diceRolled): the turn start sends the player back to
// the rolled dice instead of offering a new action.
// ═══════════════════════════════════════════════════════════════

export const turn = {
  game: null,       // the game object this turn belongs to
  round: 0,
  playerIdx: -1,
  action: null,     // 'bergauf' | 'bergab' | 'pause'
  rolled: false,    // true after the first roll → action locked
  resume: null,     // screen id to return to while rolled
  data: {},         // action-specific state (dice, held …)
};

/** Starts an action for the current player, discarding any previous turn state. */
export function beginAction(game, action, data = {}) {
  Object.assign(turn, {
    game, round: game.round, playerIdx: game.currentPlayerIndex,
    action, rolled: false, resume: null, data,
  });
  return turn;
}

/** The turn state if it belongs to the current player of `game`, else null. */
export function activeTurn(game) {
  const same = turn.game === game && turn.round === game.round && turn.playerIdx === game.currentPlayerIndex;
  return same && turn.action ? turn : null;
}

/** Locks the action: from now on the turn start resumes `screenId`. */
export function markRolled(screenId) {
  turn.rolled = true;
  turn.resume = screenId;
}

export function clearTurn() {
  jokers.uses = [];
  Object.assign(turn, { game: null, round: 0, playerIdx: -1, action: null, rolled: false, resume: null, data: {} });
}

// ── Joker uses of this turn (take back) ──
// Every Joker the current player spends is recorded under the place it acts on (`id`), with a way
// to undo it, until the turn ends. The player takes it back by tapping that place (the die, the
// smiley, the Extraaktivität); a Joker spent on the physical board (id 'board') from the 🃏 sheet.
// Kept apart from `turn`, because a board Joker can be spent before any action began.

const jokers = { game: null, round: 0, playerIdx: -1, uses: [] };

/** The Joker uses of the current player's turn (oldest first); empty for a different turn. */
function jokerUses(game) {
  const same = jokers.game === game && jokers.round === game.round && jokers.playerIdx === game.currentPlayerIndex;
  if (!same) Object.assign(jokers, { game, round: game.round, playerIdx: game.currentPlayerIndex, uses: [] });
  return jokers.uses;
}

/**
 * Records a Joker the current player has just spent.
 * @param {string} id — where it acts: 'die-0' … 'die-5' (Bergauf), 'event', 'ohne', 'extra', 'board'
 * @param {() => void} undo — reverts the effect on the turn (the coin itself is refunded by the caller)
 */
export function recordJoker(game, id, undo) {
  jokerUses(game).push({ id, undo });
}

/** Whether a Joker of this turn acts on `id` (and can be taken back). */
export function jokerUsed(game, id) {
  return jokerUses(game).some(u => u.id === id);
}

/**
 * Takes back the (last) Joker on `id`: removes it and runs its undo. The caller refunds the coin.
 * @returns {boolean} false if there was none
 */
export function takeBackJoker(game, id) {
  const uses = jokerUses(game);
  const i = uses.findLastIndex(u => u.id === id);
  if (i === -1) return false;
  const [use] = uses.splice(i, 1);
  use.undo();
  return true;
}

// ── The screen that shows the turn ──
// The action screen registers how it re-renders and, optionally, what a Joker from the top bar
// would do right now (e.g. avert the Helikopter), so the 🃏 sheet can act on the dice.

let view = null;   // { render: () => void, joker?: { label: string, run: () => void } | null }

/** @param {{ render: () => void, joker?: () => ({ label: string, run: () => void } | null) } | null} v */
export function setTurnView(v) {
  view = v;
}

export function turnView() {
  return view;
}
