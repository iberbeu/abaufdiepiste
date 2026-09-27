// ═══════════════════════════════════════════════════════════════
// App v2 — Punkteblock mode (FEAT-24, flow_spec §7): pure logic, no DOM.
// A virtual copy of the printed score pad for groups who roll the physical dice.
// Completely separate from the app game (own storage key, see v2_store.js).
// Tested in tests/v2_punkteblock_logic.test.js.
// ═══════════════════════════════════════════════════════════════

import { gameTime, gameTimeHour, getLevel, sightseeingBonus } from '../game_logic.js';
import {
  START_HOUR, MAX_ROUNDS, MIN_PLAYERS, MAX_PLAYERS, LUNCH_START_H, LUNCH_END_H, defaultName, ranking,
} from './flow_logic.js';

/** Rows marked orange on the pad: the last rounds, time to head for the valley. */
export const VALLEY_ROUNDS = 3;

/**
 * @param {Array<{name: string, talstation?: string, colorIndex: number}>} players — in turn order
 */
export function createPad(players) {
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`createPad: ${MIN_PLAYERS}–${MAX_PLAYERS} players required`);
  }
  return {
    version: 1,
    players: players.map((p, i) => ({
      name: defaultName(p.name, i),
      talstation: String(p.talstation ?? '').trim(),
      colorIndex: p.colorIndex ?? i + 1,
    })),
    cells: Array.from({ length: MAX_ROUNDS }, () => players.map(() => null)),   // [round-1][player] = points or null
    // How many Sehenswürdigkeiten each cell's value contains. The count per player is derived from this,
    // so clearing or re-entering a cell also corrects the progressive bonus of later ones.
    cellSightings: Array.from({ length: MAX_ROUNDS }, () => players.map(() => 0)),
    // Lunch break booked in a cell: 'restaurant' | 'bar' | null — once per player, only in the lunch rows.
    cellPauses: Array.from({ length: MAX_ROUNDS }, () => players.map(() => null)),
    final: players.map(() => null),   // Schlusswertung (penalties and coin bonus), null = not entered
    eventsShown: [],                  // Meldungen already shown (ids as in padDueEvents)
  };
}

/**
 * The cell to fill in next: the first empty time cell in turn order (row by row, player by player).
 * Once any Schlusswertung is entered, the time rows are done (a short game ends early): then it is
 * the first empty Schlusswertung cell. null when everything is filled.
 * @returns {{ kind: 'round', round: number, playerIdx: number } | { kind: 'final', playerIdx: number } | null}
 */
export function nextCell(pad) {
  const finalStarted = pad.final.some(v => v !== null);
  if (!finalStarted) {
    for (let r = 0; r < MAX_ROUNDS; r++) {
      const playerIdx = pad.cells[r].indexOf(null);
      if (playerIdx !== -1) return { kind: 'round', round: r + 1, playerIdx };
    }
  }
  const playerIdx = pad.final.indexOf(null);
  return playerIdx === -1 ? null : { kind: 'final', playerIdx };
}

/** Every player's Schlusswertung is entered → the pad is complete (podium). */
export function allFinalsDone(pad) {
  return pad.final.every(v => v !== null);
}

/** Players by final total, highest first; equal totals share a rank (like ranking() in the app). */
export function padRanking(pad) {
  return ranking({ players: pad.players.map((_, i) => ({ points: finalTotal(pad, i) })) });
}

/**
 * Meldungen that are due now and were not shown yet — the same ones as in the app
 * (see dueRoundEvents in flow_logic.js). The pad has no turns, so "now" is the round of the
 * next cell to fill in (nextCell). The pad is always the full day, so the last rounds are 17:30.
 * Pure: mark them with markPadEvents() once shown.
 * @returns {Array<'lunch_open'|'lunch_close'|'three_rounds'|'last_round'>}
 */
export function padDueEvents(pad) {
  const next = nextCell(pad);
  if (next?.kind !== 'round' || next.round === 1) return [];
  const h = gameTimeHour(START_HOUR, next.round);
  const remaining = MAX_ROUNDS - next.round + 1;
  const shown = pad.eventsShown;
  const due = [];
  if (!shown.includes('lunch_open') && h >= LUNCH_START_H && h <= LUNCH_END_H) due.push('lunch_open');
  if (!shown.includes('lunch_close') && h > LUNCH_END_H) due.push('lunch_close');
  if (!shown.includes('three_rounds') && remaining > 1 && remaining <= VALLEY_ROUNDS) due.push('three_rounds');
  if (!shown.includes('last_round') && remaining === 1) due.push('last_round');
  return due;
}

export function markPadEvents(pad, ids) {
  ids.forEach(id => { if (!pad.eventsShown.includes(id)) pad.eventsShown.push(id); });
}

/** The pad's time rows (always the full day 08:00–17:30), with the colouring of the printed pad. */
export function padRows() {
  return Array.from({ length: MAX_ROUNDS }, (_, i) => {
    const round = i + 1;
    const h = gameTimeHour(START_HOUR, round);
    return {
      round,
      time: gameTime(START_HOUR, round),
      lunch: h >= LUNCH_START_H && h <= LUNCH_END_H,
      valley: round > MAX_ROUNDS - VALLEY_ROUNDS,
    };
  });
}

/** Points before the Schlusswertung (decides the level stars). */
export function runningTotal(pad, playerIdx) {
  return pad.cells.reduce((sum, row) => sum + (row[playerIdx] ?? 0), 0);
}

/** Final total including the Schlusswertung. */
export function finalTotal(pad, playerIdx) {
  return runningTotal(pad, playerIdx) + (pad.final[playerIdx] ?? 0);
}

export function padLevel(pad, playerIdx) {
  return getLevel(runningTotal(pad, playerIdx));
}

/** Sehenswürdigkeiten entered for a player, optionally not counting one cell (the one being edited). */
export function padSightings(pad, playerIdx, exceptRound = null) {
  return pad.cellSightings.reduce((sum, row, i) => sum + (i + 1 === exceptRound ? 0 : row[playerIdx]), 0);
}

/**
 * Points of the next Sehenswürdigkeit while editing `round`: the other cells' count plus the ones
 * already added in the open sheet decide the progressive value.
 */
export function nextSightingPoints(pad, playerIdx, round, inSheet = 0) {
  return sightseeingBonus(padSightings(pad, playerIdx, round) + inSheet);
}

/** Sehenswürdigkeiten currently stored in one cell (a re-opened cell starts from these). */
export function cellSightings(pad, round, playerIdx) {
  return pad.cellSightings[round - 1][playerIdx];
}

/**
 * Writes one cell, replacing what was there. value null clears it; 0 is kept (a round with 0 points).
 * Mutates `pad`.
 * @param {number} sightings — Sehenswürdigkeiten contained in this value
 * @param {'restaurant'|'bar'|null} pause — lunch break contained in this value
 */
export function setCell(pad, round, playerIdx, value, sightings = 0, pause = null) {
  const empty = value === null;
  pad.cells[round - 1][playerIdx] = empty ? null : Math.round(value);
  pad.cellSightings[round - 1][playerIdx] = empty ? 0 : Math.max(0, Math.round(sightings));
  pad.cellPauses[round - 1][playerIdx] = empty ? null : pause;
}

/** The lunch break stored in one cell, or null. */
export function cellPause(pad, round, playerIdx) {
  return pad.cellPauses[round - 1][playerIdx];
}

/**
 * Whether Restaurant / Bar may be booked in this cell: only in the lunch rows (11:00–12:30) and
 * only once per player — a break stored in another cell of the player blocks it.
 */
export function pauseAllowed(pad, round, playerIdx) {
  if (!padRows()[round - 1].lunch) return false;
  return pad.cellPauses.every((row, i) => i + 1 === round || row[playerIdx] === null);
}

/**
 * Whether a cell may be tapped: everything already filled (to correct it), the next cell, and the
 * Schlusswertung row (a short game may end any time). Empty cells after the next one stay locked,
 * so nobody writes into the wrong row by mistake.
 * @param {{ kind: 'round', round: number, playerIdx: number } | { kind: 'final', playerIdx: number }} cell
 */
export function cellEditable(pad, cell) {
  if (cell.kind === 'final') return true;
  if (pad.cells[cell.round - 1][cell.playerIdx] !== null) return true;
  const next = nextCell(pad);
  return next?.kind === 'round' && next.round === cell.round && next.playerIdx === cell.playerIdx;
}

/** Writes the Schlusswertung cell. value null clears it (0 is a real result). Mutates `pad`. */
export function setFinal(pad, playerIdx, value) {
  pad.final[playerIdx] = value === null ? null : Math.round(value);
}

/** Validates a parsed saved pad. Returns it, or null when the shape is unusable. */
export function restorePad(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.players)) return null;
  const n = raw.players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) return null;
  const numOrNull = v => v === null || Number.isFinite(v);
  const ok = raw.players.every(p => p && typeof p.name === 'string' && Number.isInteger(p.colorIndex) && p.colorIndex >= 1 && p.colorIndex <= MAX_PLAYERS)
    && Array.isArray(raw.cells) && raw.cells.length === MAX_ROUNDS
    && raw.cells.every(row => Array.isArray(row) && row.length === n && row.every(numOrNull))
    && Array.isArray(raw.cellSightings) && raw.cellSightings.length === MAX_ROUNDS
    && raw.cellSightings.every(row => Array.isArray(row) && row.length === n && row.every(Number.isInteger))
    && Array.isArray(raw.final) && raw.final.length === n && raw.final.every(numOrNull);
  if (!ok) return null;
  if (!Array.isArray(raw.cellPauses)) {
    // A pad saved before pauses were tracked: nothing known, so no cell holds a break.
    raw.cellPauses = Array.from({ length: MAX_ROUNDS }, () => raw.players.map(() => null));
  }
  const pauseOk = raw.cellPauses.length === MAX_ROUNDS
    && raw.cellPauses.every(row => Array.isArray(row) && row.length === n && row.every(v => v === null || v === 'restaurant' || v === 'bar'));
  if (!pauseOk) return null;
  if (!Array.isArray(raw.eventsShown)) {
    // A pad saved before the Meldungen existed: what is due now already lies behind the group.
    raw.eventsShown = [];
    markPadEvents(raw, padDueEvents(raw));
  }
  return raw;
}
