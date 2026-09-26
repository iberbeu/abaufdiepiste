// ═══════════════════════════════════════════════════════════════
// App v2 — pure game-flow logic (no DOM). Tested in tests/v2_flow_logic.test.js.
// Rules live in game_logic.js; this file only covers the flow of a game:
// creating it, advancing turns and rounds, and which one-shot round events are due.
// ═══════════════════════════════════════════════════════════════

import { gameTime, gameTimeHour } from '../game_logic.js';

export const START_HOUR = 8;          // fixed since BUG-13
export const MAX_ROUNDS = 20;         // 08:00–17:30
export const MIN_ROUNDS = 10;
export const MAX_PLAYERS = 6;
export const LUNCH_START_H = 11;      // 11:00
export const LUNCH_END_H = 12.5;      // 12:30

/**
 * Creates a fresh game.
 * @param {Array<{name: string, talstation?: string}>} players — in turn order
 * @param {number} totalRounds — MIN_ROUNDS…MAX_ROUNDS
 */
export function createGame(players, totalRounds = MAX_ROUNDS) {
  if (!Array.isArray(players) || players.length < 1 || players.length > MAX_PLAYERS) {
    throw new Error(`createGame: 1–${MAX_PLAYERS} players required`);
  }
  const rounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.round(totalRounds)));
  return {
    version: 1,
    players: players.map((p, i) => ({
      name: String(p.name ?? '').trim() || `Spieler ${i + 1}`,
      talstation: String(p.talstation ?? '').trim(),
      colorIndex: i + 1,             // → CSS class .player-<n>
      points: 0,
      joker: 0,
      gratis: 0,
      sightings: 0,
      pauseDone: false,
      schlusswertungDone: false,
    })),
    currentPlayerIndex: 0,
    round: 1,
    totalRounds: rounds,
    startHour: START_HOUR,
    eventsShown: [],
    roundSnapshots: [],
    history: [],
    finished: false,
  };
}

/** Current in-game time, e.g. "10:30". */
export function currentTime(game) {
  return gameTime(game.startHour, game.round);
}

export function currentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

/**
 * Ends the current player's turn. Mutates `game`.
 * When the last player has played, the round advances and a points snapshot is stored.
 * After the last round the game is marked finished (round stays at totalRounds).
 * @returns {{ roundAdvanced: boolean, gameOver: boolean }}
 */
export function advanceTurn(game) {
  if (game.finished) return { roundAdvanced: false, gameOver: true };

  game.currentPlayerIndex++;
  if (game.currentPlayerIndex < game.players.length) {
    return { roundAdvanced: false, gameOver: false };
  }

  game.currentPlayerIndex = 0;
  game.roundSnapshots.push({
    round: game.round,
    time: currentTime(game),
    points: game.players.map(p => p.points),
  });
  game.round++;
  if (game.round > game.totalRounds) {
    game.round = game.totalRounds;
    game.finished = true;
    return { roundAdvanced: true, gameOver: true };
  }
  return { roundAdvanced: true, gameOver: false };
}

/**
 * One-shot round events that are due now and were not shown yet.
 * Pure: does not mark them as shown — call markEventsShown() once they are displayed.
 * @returns {Array<'lunch_open'|'lunch_close'|'three_rounds'>}
 */
export function dueRoundEvents(game) {
  if (game.finished) return [];
  const h = gameTimeHour(game.startHour, game.round);
  const shown = game.eventsShown;
  const due = [];
  if (!shown.includes('lunch_open') && h >= LUNCH_START_H && h <= LUNCH_END_H) due.push('lunch_open');
  if (!shown.includes('lunch_close') && h > LUNCH_END_H) due.push('lunch_close');
  const remaining = roundsRemaining(game);
  if (!shown.includes('three_rounds') && game.totalRounds > 3 && remaining > 0 && remaining <= 3) due.push('three_rounds');
  return due;
}

export function markEventsShown(game, ids) {
  ids.forEach(id => { if (!game.eventsShown.includes(id)) game.eventsShown.push(id); });
}

/** Rounds left including the current one. */
export function roundsRemaining(game) {
  return game.totalRounds - game.round + 1;
}

/**
 * Whether the current player may take the lunch break now.
 * @returns {'open'|'before'|'after'|'done'}
 */
export function pauseStatus(game, player = currentPlayer(game)) {
  if (player.pauseDone) return 'done';
  const h = gameTimeHour(game.startHour, game.round);
  if (h < LUNCH_START_H) return 'before';
  if (h > LUNCH_END_H) return 'after';
  return 'open';
}

/** Adds a history entry tagged with round and player (FEAT-23 compatible). Mutates `game`. */
export function addHistory(game, text) {
  game.history.push({ time: currentTime(game), round: game.round, playerIdx: game.currentPlayerIndex, text });
}

/**
 * Validates a parsed saved game. Returns the game or null when the shape is unusable.
 * Keeps the app from crashing on stale or hand-edited localStorage.
 */
export function restoreGame(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.players) || raw.players.length < 1) return null;
  if (!Number.isInteger(raw.round) || !Number.isInteger(raw.totalRounds) || !Number.isInteger(raw.currentPlayerIndex)) return null;
  if (raw.currentPlayerIndex < 0 || raw.currentPlayerIndex >= raw.players.length) return null;
  const counters = ['points', 'joker', 'gratis', 'sightings', 'colorIndex'];
  const playersOk = raw.players.every(p => p && typeof p.name === 'string'
    && counters.every(k => Number.isFinite(p[k])));
  if (!playersOk) return null;
  raw.eventsShown ??= [];
  raw.roundSnapshots ??= [];
  raw.history ??= [];
  raw.startHour = START_HOUR;
  return raw;
}
