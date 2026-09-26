import { describe, it, expect } from 'vitest';
import {
  createGame, advanceTurn, dueRoundEvents, markEventsShown, pauseStatus,
  currentTime, roundsRemaining, restoreGame, addHistory, addSighting, removeLastSighting, spendCoin,
  setupDraft, assignColor, moveItem, defaultName, endTime, MAX_ROUNDS, MIN_ROUNDS,
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

  it('the shortest game ends after the lunch window (decision 26.09.2026)', () => {
    expect(MIN_ROUNDS).toBe(11);
    expect(endTime(MIN_ROUNDS)).toBe('13:00');
    expect(endTime(MIN_ROUNDS - 1)).toBe('12:30');   // one less would end inside lunch
  });

  it('clamps the round count to 11–20', () => {
    expect(createGame([{ name: 'A' }, { name: 'B' }], 3).totalRounds).toBe(MIN_ROUNDS);
    expect(createGame([{ name: 'A' }, { name: 'B' }], 99).totalRounds).toBe(MAX_ROUNDS);
  });

  it('rejects fewer than 2 or more than 6 players (no solo game)', () => {
    expect(() => createGame([])).toThrow();
    expect(() => createGame([{ name: 'Solo' }])).toThrow();
    expect(() => createGame(Array(7).fill({ name: 'X' }))).toThrow();
  });
});

describe('createGame colours', () => {
  it('uses the chosen colours when valid and unique', () => {
    const g = createGame([{ name: 'A', colorIndex: 4 }, { name: 'B', colorIndex: 1 }]);
    expect(g.players.map(p => p.colorIndex)).toEqual([4, 1]);
  });

  it('falls back to 1, 2 … when a colour repeats or is invalid', () => {
    expect(createGame([{ colorIndex: 3 }, { colorIndex: 3 }]).players.map(p => p.colorIndex)).toEqual([1, 2]);
    expect(createGame([{ colorIndex: 7 }, { colorIndex: 2 }]).players.map(p => p.colorIndex)).toEqual([1, 2]);
  });
});

describe('setupDraft', () => {
  it('without a last group: 2 players, 20 rounds, 6 empty slots with colours 1–6', () => {
    const d = setupDraft(null);
    expect(d.count).toBe(2);
    expect(d.totalRounds).toBe(MAX_ROUNDS);
    expect(d.players).toHaveLength(6);
    expect(d.players.map(p => p.colorIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(d.players[0]).toEqual({ name: '', talstation: '', colorIndex: 1 });
  });

  it('prefills the last group and gives the free colours to the empty slots', () => {
    const d = setupDraft({
      players: [{ name: 'Anna', talstation: 'Dorf', colorIndex: 5 }, { name: '', talstation: '', colorIndex: 2 }, { name: 'Clara', talstation: '', colorIndex: 1 }],
      totalRounds: 12,
    });
    expect(d.count).toBe(3);
    expect(d.totalRounds).toBe(12);
    expect(d.players.slice(0, 3).map(p => p.name)).toEqual(['Anna', '', 'Clara']);
    expect(d.players.map(p => p.colorIndex)).toEqual([5, 2, 1, 3, 4, 6]);
  });

  it('a saved one-player group still starts the wizard with 2 players', () => {
    expect(setupDraft({ players: [{ name: 'Solo', talstation: '', colorIndex: 1 }], totalRounds: 20 }).count).toBe(2);
  });

  it('repairs repeated or invalid colours and clamps the rounds', () => {
    const d = setupDraft({ players: [{ name: 'A', talstation: '', colorIndex: 2 }, { name: 'B', talstation: '', colorIndex: 2 }, { name: 'C', talstation: '', colorIndex: 9 }], totalRounds: 99 });
    expect(new Set(d.players.map(p => p.colorIndex)).size).toBe(6);
    expect(d.players[0].colorIndex).toBe(2);
    expect(d.totalRounds).toBe(MAX_ROUNDS);
  });
});

describe('assignColor / moveItem / defaultName / endTime', () => {
  it('assignColor swaps with the player who had the colour', () => {
    const players = [{ colorIndex: 1 }, { colorIndex: 2 }, { colorIndex: 3 }];
    const next = assignColor(players, 0, 3);
    expect(next.map(p => p.colorIndex)).toEqual([3, 2, 1]);
    expect(players[0].colorIndex).toBe(1);   // input untouched
    expect(assignColor(players, 1, 5).map(p => p.colorIndex)).toEqual([1, 5, 3]);   // free colour
  });

  it('moveItem moves up and down and clamps the target', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a']);
  });

  it('defaultName and endTime', () => {
    expect(defaultName('  Anna ', 0)).toBe('Anna');
    expect(defaultName('', 2)).toBe('Spieler 3');
    expect(endTime(20)).toBe('17:30');
    expect(endTime(12)).toBe('13:30');
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
    const g = createGame([{ name: 'A' }, { name: 'B' }], MIN_ROUNDS);
    g.currentPlayerIndex = 1;
    g.round = MIN_ROUNDS;
    expect(advanceTurn(g)).toEqual({ roundAdvanced: true, gameOver: true });
    expect(g.finished).toBe(true);
    expect(g.round).toBe(MIN_ROUNDS);
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
    const g = createGame([{ name: 'A' }, { name: 'B' }], MIN_ROUNDS);
    g.round = 10;   // 12:30, second-to-last round of the shortest game
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

describe('addSighting / removeLastSighting', () => {
  it('awards the progressive bonus to the current player and logs it', () => {
    const g = two();
    advanceTurn(g);   // Ben
    expect([addSighting(g), addSighting(g), addSighting(g)]).toEqual([5, 10, 15]);
    expect(g.players[1]).toMatchObject({ sightings: 3, points: 30 });
    expect(g.players[0].points).toBe(0);
    expect(g.history.at(-1)).toMatchObject({ playerIdx: 1, text: '3. Sehenswürdigkeit: +15 Punkte' });
  });

  it('removing takes back exactly the last bonus', () => {
    const g = two();
    addSighting(g);
    addSighting(g);
    expect(removeLastSighting(g)).toBe(10);
    expect(g.players[0]).toMatchObject({ sightings: 1, points: 5 });
    expect(g.history.at(-1).text).toBe('2. Sehenswürdigkeit entfernt: −10 Punkte');
  });

  it('removing with none recorded changes nothing', () => {
    const g = two();
    expect(removeLastSighting(g)).toBe(0);
    expect(g.players[0]).toMatchObject({ sightings: 0, points: 0 });
    expect(g.history).toEqual([]);
  });
});

describe('spendCoin', () => {
  it('deducts one coin of the current player and logs it', () => {
    const g = two();
    g.players[0].joker = 2;
    g.players[0].gratis = 1;
    expect(spendCoin(g, 'joker')).toBe(true);
    expect(spendCoin(g, 'gratis')).toBe(true);
    expect(g.players[0]).toMatchObject({ joker: 1, gratis: 0 });
    expect(g.history.map(h => h.text)).toEqual(['Joker eingesetzt', 'Gratis Fahrt eingesetzt']);
  });

  it('refuses at 0 and rejects unknown coin kinds', () => {
    const g = two();
    expect(spendCoin(g, 'gratis')).toBe(false);
    expect(g.players[0].gratis).toBe(0);
    expect(g.history).toEqual([]);
    expect(() => spendCoin(g, 'points')).toThrow();
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
    expect(restoreGame({ ...two(), totalRounds: MIN_ROUNDS - 1 })).toBeNull();   // shorter than the rules allow
    expect(restoreGame({ ...two(), round: 21 })).toBeNull();
    const broken = two();
    delete broken.players[1].points;
    expect(restoreGame(broken)).toBeNull();
    const badName = two();
    badName.players[0].name = 42;
    expect(restoreGame(badName)).toBeNull();
  });
});
