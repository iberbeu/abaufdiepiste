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
  Object.assign(turn, { game: null, round: 0, playerIdx: -1, action: null, rolled: false, resume: null, data: {} });
}
