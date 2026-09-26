import { describe, it, expect } from 'vitest';
import {
  createGame, advanceTurn, dueRoundEvents, markEventsShown, pauseStatus,
  currentTime, roundsRemaining, restoreGame, addHistory, MAX_ROUNDS, MIN_ROUNDS,
} from '../v2/flow_logic.js';

const two = () => createGame([{ name: 'Anna' }, { name: 'Ben', talstation: 'Dorf' }]);

describe('createGame', () => {
  it('creates players in turn order with colour index and zeroed counters', () => {
    const g = two();
    expect(g.players.map(p => p.name)).toEqual(['Anna', 'Ben']);
    expect(g.players.map(p => p.colorIndex)).toEqual([1, 2]);
    expect(g.players[1].talstation).toBe('Dorf');
    expect(g.players[0]).toMatchObject({ points: 0, joker: 0, gratis: 0, sightings: 0, pauseDone: false });
    expect(g).toMatchObject({ round: 1, currentPlayerIndex: 0, startHour: 8, totalRounds: MAX_ROUNDS, finished: false });
  });

  it('falls back to "Spieler N" for empty names', () => {
    const g = createGame([{ name: '  ' }, {}]);
    expect(g.players.map(p => p.name)).toEqual(['Spieler 1', 'Spieler 2']);
  });

  it('clamps the round count to 10–20', () => {
    expect(createGame([{ name: 'A' }], 3).totalRounds).toBe(MIN_ROUNDS);
    expect(createGame([{ name: 'A' }], 99).totalRounds).toBe(MAX_ROUNDS);
  });

  it('rejects 0 or more than 6 players', () => {
    expect(() => createGame([])).toThrow();
    expect(() => createGame(Array(7).fill({ name: 'X' }))).toThrow();
  });
});

describe('advanceTurn', () => {
  it('moves to the next player within a round', () => {
    const g = two();
    expect(advanceTurn(g)).toEqual({ roundAdvanced: false, gameOver: false });
    expect(g.currentPlayerIndex).toBe(1);
    expect(g.round).toBe(1);
  });

  it('wraps to player 1, advances the round and stores a snapshot', () => {
    const g = two();
    g.players[0].points = 7;
    advanceTurn(g);
    expect(advanceTurn(g)).toEqual({ roundAdvanced: true, gameOver: false });
    expect(g.currentPlayerIndex).toBe(0);
    expect(g.round).toBe(2);
    expect(g.roundSnapshots).toEqual([{ round: 1, time: '08:00', points: [7, 0] }]);
  });

  it('finishes the game after the last round and keeps round at totalRounds', () => {
    const g = createGame([{ name: 'Solo' }], 10);
    g.round = 10;
    expect(advanceTurn(g)).toEqual({ roundAdvanced: true, gameOver: true });
    expect(g.finished).toBe(true);
    expect(g.round).toBe(10);
    expect(advanceTurn(g)).toEqual({ roundAdvanced: false, gameOver: true });
  });
});

describe('dueRoundEvents', () => {
  it('nothing due at the start', () => {
    expect(dueRoundEvents(two())).toEqual([]);
  });

  it('lunch_open at 11:00 (round 7), only once', () => {
    const g = two();
    g.round = 7;
    expect(currentTime(g)).toBe('11:00');
    expect(dueRoundEvents(g)).toEqual(['lunch_open']);
    markEventsShown(g, ['lunch_open']);
    expect(dueRoundEvents(g)).toEqual([]);
  });

  it('lunch_close after 12:30 (round 10 = 12:30 still open, round 11 = 13:00 closed)', () => {
    const g = two();
    markEventsShown(g, ['lunch_open']);
    g.round = 10;
    expect(dueRoundEvents(g)).toEqual([]);
    g.round = 11;
    expect(dueRoundEvents(g)).toEqual(['lunch_close']);
  });

  it('three_rounds when 3 rounds remain', () => {
    const g = two();
    markEventsShown(g, ['lunch_open', 'lunch_close']);
    g.round = 18;
    expect(roundsRemaining(g)).toBe(3);
    expect(dueRoundEvents(g)).toEqual(['three_rounds']);
  });

  it('several events can be due at once after a jump (e.g. a restored game)', () => {
    const g = createGame([{ name: 'A' }], 10);
    g.round = 10;   // 12:30, last round
    expect(dueRoundEvents(g)).toEqual(['lunch_open', 'three_rounds']);
  });

  it('none once the game is finished', () => {
    const g = two();
    g.finished = true;
    g.round = 20;
    expect(dueRoundEvents(g)).toEqual([]);
  });
});

describe('pauseStatus', () => {
  it('before / open / after / done', () => {
    const g = two();
    expect(pauseStatus(g)).toBe('before');
    g.round = 7;  expect(pauseStatus(g)).toBe('open');   // 11:00
    g.round = 10; expect(pauseStatus(g)).toBe('open');   // 12:30
    g.round = 11; expect(pauseStatus(g)).toBe('after');  // 13:00
    g.round = 8;
    g.players[0].pauseDone = true;
    expect(pauseStatus(g)).toBe('done');
  });
});

describe('addHistory', () => {
  it('tags entries with time, round and player', () => {
    const g = two();
    advanceTurn(g);
    addHistory(g, 'Ben: Bergauf');
    expect(g.history).toEqual([{ time: '08:00', round: 1, playerIdx: 1, text: 'Ben: Bergauf' }]);
  });
});

describe('restoreGame', () => {
  it('accepts a saved game and fills missing arrays', () => {
    const g = JSON.parse(JSON.stringify(two()));
    delete g.eventsShown;
    const r = restoreGame(g);
    expect(r).not.toBeNull();
    expect(r.eventsShown).toEqual([]);
  });

  it('rejects unusable data', () => {
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame({ version: 2 })).toBeNull();
    expect(restoreGame({ ...two(), players: [] })).toBeNull();
    expect(restoreGame({ ...two(), currentPlayerIndex: 5 })).toBeNull();
    expect(restoreGame({ ...two(), round: 'x' })).toBeNull();
    const broken = two();
    delete broken.players[1].points;
    expect(restoreGame(broken)).toBeNull();
    const badName = two();
    badName.players[0].name = 42;
    expect(restoreGame(badName)).toBeNull();
  });
});
