// ═══════════════════════════════════════════════════════════════
// App v2 — Punkteblock mode (FEAT-24, flow_spec §7): pure logic, no DOM.
// A virtual copy of the printed score pad for groups who roll the physical dice.
// Completely separate from the app game (own storage key, see v2_store.js).
// Tested in tests/v2_punkteblock_logic.test.js.
// ═══════════════════════════════════════════════════════════════

import { gameTime, gameTimeHour, getLevel, sightseeingBonus } from '../game_logic.js';
import { START_HOUR, MAX_ROUNDS, MIN_PLAYERS, MAX_PLAYERS, LUNCH_START_H, LUNCH_END_H, defaultName } from './flow_logic.js';

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
    final: players.map(() => null),   // Schlusswertung (penalties and coin bonus), null = not entered
  };
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
 */
export function setCell(pad, round, playerIdx, value, sightings = 0) {
  const empty = value === null;
  pad.cells[round - 1][playerIdx] = empty ? null : Math.round(value);
  pad.cellSightings[round - 1][playerIdx] = empty ? 0 : Math.max(0, Math.round(sightings));
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
  const ok = raw.players.every(p => p && typeof p.name === 'string' && Number.isInteger(p.colorIndex))
    && Array.isArray(raw.cells) && raw.cells.length === MAX_ROUNDS
    && raw.cells.every(row => Array.isArray(row) && row.length === n && row.every(numOrNull))
    && Array.isArray(raw.cellSightings) && raw.cellSightings.length === MAX_ROUNDS
    && raw.cellSightings.every(row => Array.isArray(row) && row.length === n && row.every(Number.isInteger))
    && Array.isArray(raw.final) && raw.final.length === n && raw.final.every(numOrNull);
  return ok ? raw : null;
}
