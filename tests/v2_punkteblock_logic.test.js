import { describe, it, expect } from 'vitest';
import {
  createPad, padRows, runningTotal, finalTotal, padLevel, padSightings, nextSightingPoints, cellSightings,
  setCell, setFinal, restorePad, VALLEY_ROUNDS, cellEditable, cellPause, pauseAllowed, nextCell, allFinalsDone, padRanking, padDueEvents, markPadEvents,
} from '../punkteblock_logic.js';

/** Fills every time cell up to `lastRound` with 0 (except one cell, if given). */
const fillUpTo = (pad, lastRound, except = null) => {
  for (let r = 1; r <= lastRound; r++) pad.players.forEach((_, i) => {
    if (!(except && except.round === r && except.i === i)) setCell(pad, r, i, 0);
  });
};

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

  it('needs 2–4 players', () => {
    expect(() => createPad([{ name: 'Solo' }])).toThrow();
    expect(() => createPad(Array(5).fill({ name: 'X' }))).toThrow();
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

  it('each player has their own count and progression (review 27.09.2026: no shared counter)', () => {
    const pad = pad2();
    setCell(pad, 2, 0, 5, 1);
    setCell(pad, 4, 0, 10, 1);
    setCell(pad, 5, 1, 5, 1);
    expect([padSightings(pad, 0), padSightings(pad, 1)]).toEqual([2, 1]);
    expect(nextSightingPoints(pad, 0, 9)).toBe(15);
    expect(nextSightingPoints(pad, 1, 9)).toBe(10);
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

describe('nextCell', () => {
  it('goes row by row in turn order, skipping filled cells', () => {
    const pad = pad2();
    expect(nextCell(pad)).toEqual({ kind: 'round', round: 1, playerIdx: 0 });
    setCell(pad, 1, 0, 0);
    expect(nextCell(pad)).toEqual({ kind: 'round', round: 1, playerIdx: 1 });
    setCell(pad, 1, 1, 4);
    setCell(pad, 2, 1, 4);   // filled ahead: player 0 of round 2 is still next
    expect(nextCell(pad)).toEqual({ kind: 'round', round: 2, playerIdx: 0 });
  });

  it('moves to the Schlusswertung after the last row, or as soon as one is entered (short game)', () => {
    const pad = pad2();
    fillUpTo(pad, 20);
    expect(nextCell(pad)).toEqual({ kind: 'final', playerIdx: 0 });
    const short = pad2();
    fillUpTo(short, 12);
    setFinal(short, 1, -15);
    expect(nextCell(short)).toEqual({ kind: 'final', playerIdx: 0 });
    setFinal(short, 0, 0);
    expect(nextCell(short)).toBeNull();
    expect(allFinalsDone(short)).toBe(true);
    expect(allFinalsDone(pad)).toBe(false);
  });
});

describe('cellEditable', () => {
  it('filled cells, the next cell and the Schlusswertung row; later empty cells are locked', () => {
    const pad = pad2();
    const cell = (round, playerIdx) => ({ kind: 'round', round, playerIdx });
    expect(cellEditable(pad, cell(1, 0))).toBe(true);
    expect(cellEditable(pad, cell(1, 1))).toBe(false);
    expect(cellEditable(pad, cell(5, 0))).toBe(false);
    expect(cellEditable(pad, { kind: 'final', playerIdx: 1 })).toBe(true);
    setCell(pad, 1, 0, 4);
    expect(cellEditable(pad, cell(1, 0))).toBe(true);   // filled: can be corrected
    expect(cellEditable(pad, cell(1, 1))).toBe(true);   // now next
    setFinal(pad, 0, -15);                                // short game ended: the time rows are done
    expect(cellEditable(pad, cell(1, 1))).toBe(false);
  });
});

describe('lunch break (Restaurant / Bar)', () => {
  it('only in the lunch rows, once per player; the cell holding it may change it', () => {
    const pad = pad2();
    expect(pauseAllowed(pad, 6, 0)).toBe(false);    // 10:30
    expect(pauseAllowed(pad, 7, 0)).toBe(true);     // 11:00
    expect(pauseAllowed(pad, 10, 0)).toBe(true);    // 12:30
    expect(pauseAllowed(pad, 11, 0)).toBe(false);   // 13:00
    setCell(pad, 8, 0, 15, 0, 'restaurant');
    expect(cellPause(pad, 8, 0)).toBe('restaurant');
    expect(pauseAllowed(pad, 9, 0)).toBe(false);    // already taken
    expect(pauseAllowed(pad, 8, 0)).toBe(true);     // its own cell (re-opened)
    expect(pauseAllowed(pad, 9, 1)).toBe(true);     // other player
    setCell(pad, 8, 0, null);                       // cleared → free again
    expect(pauseAllowed(pad, 9, 0)).toBe(true);
  });
});

describe('padRanking', () => {
  it('ranks by the final total including the Schlusswertung; ties share a rank', () => {
    const pad = createPad([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    setCell(pad, 1, 0, 20);
    setCell(pad, 1, 1, 30);
    setCell(pad, 1, 2, 20);
    setFinal(pad, 1, -15);
    expect(padRanking(pad)).toEqual([
      { playerIdx: 0, rank: 1, points: 20 },
      { playerIdx: 2, rank: 1, points: 20 },
      { playerIdx: 1, rank: 3, points: 15 },
    ]);
  });
});

describe('padDueEvents (Meldungen)', () => {
  it('follow the round of the next cell, each once', () => {
    const pad = pad2();
    expect(padDueEvents(pad)).toEqual([]);
    fillUpTo(pad, 5);                 // next: 10:30
    expect(padDueEvents(pad)).toEqual([]);
    fillUpTo(pad, 6);                 // next: 11:00
    expect(padDueEvents(pad)).toEqual(['lunch_open']);
    markPadEvents(pad, ['lunch_open']);
    expect(padDueEvents(pad)).toEqual([]);
    fillUpTo(pad, 10);                // next: 13:00
    expect(padDueEvents(pad)).toEqual(['lunch_close']);
    markPadEvents(pad, ['lunch_close']);
    fillUpTo(pad, 20 - VALLEY_ROUNDS);   // next: first orange row
    expect(padDueEvents(pad)).toEqual(['three_rounds']);
    markPadEvents(pad, ['three_rounds']);
    fillUpTo(pad, 19);                // next: 17:30
    expect(padDueEvents(pad)).toEqual(['last_round']);
    markPadEvents(pad, ['last_round']);
    fillUpTo(pad, 20);                // Schlusswertung: no more Meldungen
    expect(padDueEvents(pad)).toEqual([]);
  });

  it("only once the next cell is in the new round (the round's last entry triggers it)", () => {
    const pad = pad2();
    fillUpTo(pad, 6, { round: 6, i: 1 });
    expect(padDueEvents(pad)).toEqual([]);
    setCell(pad, 6, 1, 0);
    expect(padDueEvents(pad)).toEqual(['lunch_open']);
  });
});

describe('restorePad', () => {
  it('a pad saved before the Meldungen gets eventsShown, and what is due right then counts as shown', () => {
    const pad = pad2();
    fillUpTo(pad, 6);
    const old = JSON.parse(JSON.stringify(pad));
    delete old.eventsShown;
    const r = restorePad(old);
    expect(r.eventsShown).toEqual(['lunch_open']);
    expect(padDueEvents(r)).toEqual([]);
  });

  it('a pad saved before pauses were tracked gets empty cellPauses; broken ones are rejected', () => {
    const old = JSON.parse(JSON.stringify(pad2()));
    delete old.cellPauses;
    expect(restorePad(old).cellPauses[7]).toEqual([null, null]);
    const bad = JSON.parse(JSON.stringify(pad2()));
    bad.cellPauses[7][0] = 'picknick';
    expect(restorePad(bad)).toBeNull();
  });

  it('rejects more than 4 players and colours outside the 4 game pieces', () => {
    const pad = pad2();
    expect(restorePad({ ...JSON.parse(JSON.stringify(pad)), players: [{ ...pad.players[0], colorIndex: 5 }, pad.players[1]] })).toBeNull();
  });

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
