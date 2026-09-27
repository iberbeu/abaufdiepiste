import { describe, it, expect } from 'vitest';
import {
  createPad, padRows, runningTotal, finalTotal, padLevel, padSightings, nextSightingPoints, cellSightings,
  setCell, setFinal, restorePad, VALLEY_ROUNDS,
} from '../v2/punkteblock_logic.js';

const pad2 = () => createPad([{ name: 'Anna', talstation: 'Dorf', colorIndex: 3 }, { name: '', colorIndex: 1 }]);

describe('createPad', () => {
  it('20 empty rows, one column per player, names default to "Spieler N"', () => {
    const pad = pad2();
    expect(pad.players.map(p => [p.name, p.colorIndex])).toEqual([['Anna', 3], ['Spieler 2', 1]]);
    expect(pad.cells).toHaveLength(20);
    expect(pad.cells[0]).toEqual([null, null]);
    expect(pad.cellSightings[0]).toEqual([0, 0]);
    expect(pad.final).toEqual([null, null]);
  });

  it('needs 2–6 players', () => {
    expect(() => createPad([{ name: 'Solo' }])).toThrow();
    expect(() => createPad(Array(7).fill({ name: 'X' }))).toThrow();
  });
});

describe('padRows', () => {
  it('08:00–17:30, lunch 11:00–12:30 and the last 3 rounds marked like the printed pad', () => {
    const rows = padRows();
    expect(rows).toHaveLength(20);
    expect([rows[0].time, rows[19].time]).toEqual(['08:00', '17:30']);
    expect(rows.filter(r => r.lunch).map(r => r.time)).toEqual(['11:00', '11:30', '12:00', '12:30']);
    expect(rows.filter(r => r.valley).map(r => r.time)).toEqual(['16:30', '17:00', '17:30']);
    expect(VALLEY_ROUNDS).toBe(3);
  });
});

describe('cells, totals, level', () => {
  it('sums the cells; the Schlusswertung counts for the final total only', () => {
    const pad = pad2();
    setCell(pad, 1, 0, 10);
    setCell(pad, 2, 0, 15);
    setCell(pad, 3, 0, -4);
    setFinal(pad, 0, -15);
    expect(runningTotal(pad, 0)).toBe(21);
    expect(finalTotal(pad, 0)).toBe(6);
    expect(padLevel(pad, 0)).toBe('fortgeschritten');   // 21 points, before the Schlusswertung
    expect(runningTotal(pad, 1)).toBe(0);
  });

  it('null clears a cell; 0 is kept as a real entry (also for the Schlusswertung)', () => {
    const pad = pad2();
    setCell(pad, 5, 1, 8);
    setCell(pad, 5, 1, null);
    expect(pad.cells[4][1]).toBeNull();
    setCell(pad, 5, 1, 0);
    expect(pad.cells[4][1]).toBe(0);
    setFinal(pad, 1, 0);
    expect(pad.final[1]).toBe(0);
    setFinal(pad, 1, null);
    expect(pad.final[1]).toBeNull();
  });
});

describe('Sehenswürdigkeiten (stored per cell, count derived)', () => {
  it('the chip value grows progressively across cells', () => {
    const pad = pad2();
    expect(nextSightingPoints(pad, 0, 3)).toBe(5);
    expect(nextSightingPoints(pad, 0, 3, 1)).toBe(10);   // second one in the same sheet
    setCell(pad, 3, 0, 15, 2);
    expect(padSightings(pad, 0)).toBe(2);
    expect(padSightings(pad, 1)).toBe(0);
    expect(nextSightingPoints(pad, 0, 7)).toBe(15);        // next one in another cell
  });

  it('clearing or re-entering a cell corrects the count (no drift, no double counting)', () => {
    const pad = pad2();
    setCell(pad, 3, 0, 13, 1);                  // 4 + 4 + Sehenswürdigkeit 5
    setCell(pad, 6, 0, 10, 1);                  // later: second Sehenswürdigkeit (+10)
    expect(padSightings(pad, 0)).toBe(2);

    // Re-opening round 3: the sheet starts from the cell's own sighting, the next one there is still +5 … +10
    expect(cellSightings(pad, 3, 0)).toBe(1);
    expect(nextSightingPoints(pad, 0, 3, 0)).toBe(10);    // the other cell (round 6) already holds one
    setCell(pad, 3, 0, null);                   // cleared
    expect(padSightings(pad, 0)).toBe(1);
    expect(cellSightings(pad, 3, 0)).toBe(0);

    setCell(pad, 6, 0, 10, 1);                  // re-entered unchanged: still one, not two
    expect(padSightings(pad, 0)).toBe(1);
  });
});

describe('restorePad', () => {
  it('accepts a saved pad and rejects broken ones', () => {
    const pad = pad2();
    setCell(pad, 1, 0, 6, 1);
    expect(restorePad(JSON.parse(JSON.stringify(pad)))).not.toBeNull();
    expect(restorePad(null)).toBeNull();
    expect(restorePad({ ...pad, version: 2 })).toBeNull();
    expect(restorePad({ ...pad, cells: pad.cells.slice(1) })).toBeNull();
    expect(restorePad({ ...pad, final: [null] })).toBeNull();
    expect(restorePad({ ...pad, cells: pad.cells.map(r => r.map(() => 'x')) })).toBeNull();
    expect(restorePad({ ...pad, cellSightings: undefined })).toBeNull();
  });
});
