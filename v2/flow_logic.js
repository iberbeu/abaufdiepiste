// ═══════════════════════════════════════════════════════════════
// App v2 — pure game-flow logic (no DOM). Tested in tests/v2_flow_logic.test.js.
// Rules live in game_logic.js; this file only covers the flow of a game:
// creating it, advancing turns and rounds, and which one-shot round events are due.
// ═══════════════════════════════════════════════════════════════

import {
  gameTime, gameTimeHour, sightseeingBonus, TRANSPORT_SYMBOLS,
  COIN_LIMIT, BLOCKING_EVENTS, PAUSE_POINTS, effectiveCrossings, calcDescentPoints,
} from '../game_logic.js';

export const START_HOUR = 8;          // fixed since BUG-13
export const MAX_ROUNDS = 20;         // 08:00–17:30
export const MIN_PLAYERS = 2;         // decision 26.09.2026: no solo game
export const MAX_PLAYERS = 6;
export const LUNCH_START_H = 11;      // 11:00
export const LUNCH_END_H = 12.5;      // 12:30
// Short game (decision 26.09.2026): start stays 08:00 and the lunch window stays 11:00–12:30,
// the day just ends earlier — but never before lunch is over, so the last round is after 12:30.
// Rounds are 30 min: round n starts at START_HOUR + (n-1)/2 → 12:30 is round 10, so the minimum is 11 (13:00).
export const MIN_ROUNDS = (LUNCH_END_H - START_HOUR) * 2 + 2;

/**
 * Creates a fresh game.
 * @param {Array<{name: string, talstation?: string, colorIndex?: number}>} players — in turn order.
 *   colorIndex (1–6) is used only if every player has a valid one and none repeats;
 *   otherwise all players get the default colours 1, 2, 3 …
 * @param {number} totalRounds — MIN_ROUNDS…MAX_ROUNDS
 */
export function createGame(players, totalRounds = MAX_ROUNDS) {
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`createGame: ${MIN_PLAYERS}–${MAX_PLAYERS} players required`);
  }
  const rounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.round(totalRounds)));
  const colors = players.map(p => p.colorIndex);
  const colorsOk = colors.every(isColorIndex) && new Set(colors).size === colors.length;
  return {
    version: 1,
    players: players.map((p, i) => ({
      name: defaultName(p.name, i),
      talstation: String(p.talstation ?? '').trim(),
      colorIndex: colorsOk ? p.colorIndex : i + 1,   // → CSS class .player-<n>
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

/**
 * Starting point of the setup wizard, prefilled from the last group (FEAT-21).
 * Always holds MAX_PLAYERS slots whose colours are a permutation of 1…6, so any first
 * `count` players have unique colours and lowering the count never loses typed names.
 * @param {{ players: Array<{name, talstation, colorIndex}>, totalRounds: number } | null} lastGroup
 * @returns {{ count: number, players: Array<{name: string, talstation: string, colorIndex: number}>, totalRounds: number }}
 */
export function setupDraft(lastGroup) {
  const last = (lastGroup?.players ?? []).slice(0, MAX_PLAYERS);
  const used = new Set();
  const players = Array.from({ length: MAX_PLAYERS }, (_, i) => {
    const p = last[i] ?? {};
    const c = isColorIndex(p.colorIndex) && !used.has(p.colorIndex) ? p.colorIndex : 0;
    if (c) used.add(c);
    return { name: String(p.name ?? ''), talstation: String(p.talstation ?? ''), colorIndex: c };
  });
  const free = [1, 2, 3, 4, 5, 6].filter(c => !used.has(c));
  players.forEach(p => { if (!p.colorIndex) p.colorIndex = free.shift(); });
  const rounds = Number.isInteger(lastGroup?.totalRounds) ? lastGroup.totalRounds : MAX_ROUNDS;
  return {
    count: Math.max(MIN_PLAYERS, last.length),
    players,
    totalRounds: Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, rounds)),
  };
}

/**
 * Rolls every die that is not held. Returns a new array; held dice keep their face.
 * @param {string[]} dice — current faces (any value when not rolled yet)
 * @param {boolean[]} held
 * @param {string[]} faces — possible faces, e.g. TRANSPORT_SYMBOLS
 * @param {() => number} [rng] — Math.random-compatible, injectable for tests
 */
export function rollDice(dice, held, faces = TRANSPORT_SYMBOLS, rng = Math.random) {
  return dice.map((face, i) => (held[i] ? face : faces[Math.floor(rng() * faces.length)]));
}

/** The name a player gets: the trimmed input, or "Spieler N" (N = 1-based position) if empty. */
export function defaultName(name, index) {
  return String(name ?? '').trim() || `Spieler ${index + 1}`;
}

function isColorIndex(c) {
  return Number.isInteger(c) && c >= 1 && c <= MAX_PLAYERS;
}

/**
 * Gives player `index` the colour `colorIndex`; whoever had it gets the old colour (swap).
 * Colours stay unique as long as they were unique before. Returns a new array.
 * @param {Array<{colorIndex: number}>} players
 */
export function assignColor(players, index, colorIndex) {
  const other = players.findIndex(p => p.colorIndex === colorIndex);
  const next = players.map(p => ({ ...p }));
  if (other !== -1) next[other].colorIndex = players[index].colorIndex;
  next[index].colorIndex = colorIndex;
  return next;
}

/** Moves the item at `from` to position `to` (turn-order reordering). Returns a new array. */
export function moveItem(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

/** Clock time of a game's last round, e.g. 20 rounds → "17:30". */
export function endTime(totalRounds) {
  return gameTime(START_HOUR, totalRounds);
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

const PAUSE_LABELS = { restaurant: 'Restaurant', bar: 'Bar' };

/**
 * The current player takes the lunch break. Mutates `game`.
 * @param {'restaurant'|'bar'} kind
 * @returns {number} the points awarded (0 if the pause is not possible now)
 */
export function takePause(game, kind) {
  if (!(kind in PAUSE_POINTS)) throw new Error(`takePause: unknown kind ${kind}`);
  if (pauseStatus(game) !== 'open') return 0;
  const p = currentPlayer(game);
  const pts = PAUSE_POINTS[kind];
  p.points += pts;
  p.pauseDone = true;
  addHistory(game, `Mittagspause ${PAUSE_LABELS[kind]}: +${pts} Punkte`);
  return pts;
}

/** Adds a history entry tagged with round and player (FEAT-23 compatible). Mutates `game`. */
export function addHistory(game, text) {
  game.history.push({ time: currentTime(game), round: game.round, playerIdx: game.currentPlayerIndex, text });
}

/**
 * Records the current player's next Sehenswürdigkeit (progressive bonus). Mutates `game`.
 * @returns {number} the points awarded
 */
export function addSighting(game) {
  const p = currentPlayer(game);
  const pts = sightseeingBonus(p.sightings);
  p.sightings++;
  p.points += pts;
  addHistory(game, `${p.sightings}. Sehenswürdigkeit: +${pts} Punkte`);
  return pts;
}

/**
 * Undoes the current player's last Sehenswürdigkeit. Mutates `game`.
 * The bonus depends only on the count, so removing any one equals removing the last.
 * @returns {number} the points taken back (0 if there was none)
 */
export function removeLastSighting(game) {
  const p = currentPlayer(game);
  if (p.sightings === 0) return 0;
  p.sightings--;
  const pts = sightseeingBonus(p.sightings);
  p.points -= pts;
  addHistory(game, `${p.sightings + 1}. Sehenswürdigkeit entfernt: −${pts} Punkte`);
  return pts;
}

const COIN_LABELS = { joker: 'Joker', gratis: 'Gratis Fahrt' };

/**
 * Gives the current player one coin (Sonne → Joker, +1 Fahrt → Gratis Fahrt). Mutates `game`.
 * Coin rule: as soon as COIN_LIMIT unused coins are held, all of them are returned.
 * @param {'joker'|'gratis'} kind
 * @returns {{ limitHit: boolean }}
 */
export function gainCoin(game, kind) {
  if (!(kind in COIN_LABELS)) throw new Error(`gainCoin: unknown coin ${kind}`);
  const p = currentPlayer(game);
  p[kind]++;
  addHistory(game, `+1 ${COIN_LABELS[kind]}`);
  if (p.joker + p.gratis < COIN_LIMIT) return { limitHit: false };
  p.joker = 0;
  p.gratis = 0;
  addHistory(game, `${COIN_LIMIT} Münzen – alle zurückgegeben`);
  return { limitHit: true };
}

/**
 * Everything the Bergab step shows, derived from the roll and the player's choices.
 * @param {{ descent: number, event: string, jokerOnEvent: boolean,
 *           slopes: {blue:number, red:number, black:number, yellow:number},
 *           ohneBefugnis: boolean|null, extra: number|null }} d
 * @param {string[]} allowedSlopes — ALLOWED_SLOPES[level]
 * @returns {{ blocked: boolean, maxCrossings: number, used: number, total: number, parts: string[], bonusText: string }}
 *   parts / bonusText: from calcDescentPoints(), for the history line.
 *   blocked: Unfall / Helikopter without Joker → no descent, 0 points (Extraaktivität included).
 */
export function descentTurn(d, allowedSlopes) {
  const blocked = BLOCKING_EVENTS.includes(d.event) && !d.jokerOnEvent;
  const used = Object.values(d.slopes).reduce((a, b) => a + b, 0);
  if (blocked) return { blocked, maxCrossings: 0, used: 0, total: 0, parts: [], bonusText: '' };
  // A Joker on the event averts it completely — Pulverschnee is not a Joker event, so it always stays.
  const event = d.jokerOnEvent ? null : d.event;
  const { total, parts, bonusText } = calcDescentPoints(d.slopes, event, d.ohneBefugnis, allowedSlopes);
  return {
    blocked,
    maxCrossings: effectiveCrossings(d.descent, d.event, d.jokerOnEvent),
    used,
    total: total + (d.extra ?? 0),
    parts,
    bonusText,
  };
}

/**
 * Spends one coin of the current player. Mutates `game`.
 * @param {'joker'|'gratis'} kind
 * @returns {boolean} false if the player has none left
 */
export function spendCoin(game, kind) {
  if (!(kind in COIN_LABELS)) throw new Error(`spendCoin: unknown coin ${kind}`);
  const p = currentPlayer(game);
  if (p[kind] < 1) return false;
  p[kind]--;
  addHistory(game, `${COIN_LABELS[kind]} eingesetzt`);
  return true;
}

/**
 * Validates a parsed saved game. Returns the game or null when the shape is unusable.
 * Keeps the app from crashing on stale or hand-edited localStorage.
 */
export function restoreGame(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.players) || raw.players.length < MIN_PLAYERS) return null;
  if (!Number.isInteger(raw.round) || !Number.isInteger(raw.totalRounds) || !Number.isInteger(raw.currentPlayerIndex)) return null;
  if (raw.currentPlayerIndex < 0 || raw.currentPlayerIndex >= raw.players.length) return null;
  if (raw.totalRounds < MIN_ROUNDS || raw.totalRounds > MAX_ROUNDS || raw.round < 1 || raw.round > raw.totalRounds) return null;
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
