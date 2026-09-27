import { describe, it, expect } from 'vitest';
import {
  createGame, advanceTurn, dueRoundEvents, markEventsShown, pauseStatus,
  currentTime, roundsRemaining, restoreGame, addHistory, addSighting, removeLastSighting, spendCoin,
  rollDice, gainCoin, descentTurn, refundCoin, passTurn, takePause, ranking, scoreRows, roundEntries, adjustPlayer, levelUp,
  nextSchlusswertungPlayer, previewSchlusswertung, applySchlusswertung, setupDraft, assignColor, moveItem, defaultName, endTime, MAX_ROUNDS, MIN_ROUNDS,
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

  it('rejects fewer than 2 or more than 4 players (no solo game, one per game piece)', () => {
    expect(() => createGame([])).toThrow();
    expect(() => createGame([{ name: 'Solo' }])).toThrow();
    expect(() => createGame(Array(5).fill({ name: 'X' }))).toThrow();
    expect(createGame(Array(4).fill({ name: 'X' })).players).toHaveLength(4);
  });
});

describe('rollDice', () => {
  it('rolls only the dice that are not held, using the given random source', () => {
    const faces = ['a', 'b', 'c'];
    const values = [0, 0.5, 0.99];
    let i = 0;
    const rng = () => values[i++];
    expect(rollDice(['x', 'y', 'z', 'w'], [false, true, false, false], faces, rng)).toEqual(['a', 'y', 'b', 'c']);
  });

  it('defaults to the six transport symbols', () => {
    const dice = rollDice(Array(6).fill(null), Array(6).fill(false));
    expect(dice).toHaveLength(6);
    dice.forEach(d => expect(['fussweg', 'kleingondel', 'skilift', 'sesselbahn', 'gondel', 'zug']).toContain(d));
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
  it('without a last group: 2 players, 20 rounds, 4 empty slots with colours 1–4', () => {
    const d = setupDraft(null);
    expect(d.count).toBe(2);
    expect(d.totalRounds).toBe(MAX_ROUNDS);
    expect(d.players).toHaveLength(4);
    expect(d.players.map(p => p.colorIndex)).toEqual([1, 2, 3, 4]);
    expect(d.players[0]).toEqual({ name: '', talstation: '', colorIndex: 1 });
  });

  it('prefills the last group and gives the free colours to the empty slots', () => {
    const d = setupDraft({
      players: [{ name: 'Anna', talstation: 'Dorf', colorIndex: 4 }, { name: '', talstation: '', colorIndex: 2 }, { name: 'Clara', talstation: '', colorIndex: 1 }],
      totalRounds: 12,
    });
    expect(d.count).toBe(3);
    expect(d.totalRounds).toBe(12);
    expect(d.players.slice(0, 3).map(p => p.name)).toEqual(['Anna', '', 'Clara']);
    expect(d.players.map(p => p.colorIndex)).toEqual([4, 2, 1, 3]);
  });

  it('a saved group of 5–6 (before the 2–4 decision) is cut to 4 with valid colours', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, talstation: '', colorIndex: 6 - i }));
    const d = setupDraft({ players: six, totalRounds: 20 });
    expect(d.count).toBe(4);
    expect([...d.players.map(p => p.colorIndex)].sort()).toEqual([1, 2, 3, 4]);
  });

  it('a saved one-player group still starts the wizard with 2 players', () => {
    expect(setupDraft({ players: [{ name: 'Solo', talstation: '', colorIndex: 1 }], totalRounds: 20 }).count).toBe(2);
  });

  it('repairs repeated or invalid colours and clamps the rounds', () => {
    const d = setupDraft({ players: [{ name: 'A', talstation: '', colorIndex: 2 }, { name: 'B', talstation: '', colorIndex: 2 }, { name: 'C', talstation: '', colorIndex: 9 }], totalRounds: 99 });
    expect(new Set(d.players.map(p => p.colorIndex)).size).toBe(4);
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

  it('last_round in the last round (instead of three_rounds), once', () => {
    const g = two();
    markEventsShown(g, ['lunch_open', 'lunch_close', 'three_rounds']);
    g.round = 19;
    expect(dueRoundEvents(g)).toEqual([]);
    g.round = 20;
    expect(dueRoundEvents(g)).toEqual(['last_round']);
    markEventsShown(g, ['last_round']);
    expect(dueRoundEvents(g)).toEqual([]);
    const late = two();   // a game restored in its last round never gets "3 rounds left"
    markEventsShown(late, ['lunch_open', 'lunch_close']);
    late.round = 20;
    expect(dueRoundEvents(late)).toEqual(['last_round']);
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

describe('refundCoin', () => {
  it('gives the coin back and removes the matching "eingesetzt" entry of this turn', () => {
    const g = two();
    g.players[0].joker = 1;
    addHistory(g, 'Bergab: keine Kreuzung → 0 Punkte');
    spendCoin(g, 'joker');
    refundCoin(g, 'joker');
    expect(g.players[0].joker).toBe(1);
    expect(g.history.map(h => h.text)).toEqual(['Bergab: keine Kreuzung → 0 Punkte']);
    expect(() => refundCoin(g, 'points')).toThrow();
  });

  it("never removes another player's entry", () => {
    const g = two();
    g.players[1].joker = 1;
    g.currentPlayerIndex = 1;
    spendCoin(g, 'joker');
    g.currentPlayerIndex = 0;
    refundCoin(g, 'joker');
    expect(g.history).toHaveLength(1);
    expect(g.players[0].joker).toBe(1);
  });
});

describe('passTurn', () => {
  it('logs the pass for the current player, nothing else changes', () => {
    const g = two();
    passTurn(g);
    expect(g.history).toEqual([{ time: '08:00', round: 1, playerIdx: 0, text: 'Gepasst' }]);
    expect(g.players[0].points).toBe(0);
    expect(g.currentPlayerIndex).toBe(0);
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
    // Saved before the 2–4 decision: 5 players or a 5th/6th colour cannot be shown any more
    const five = createGame(Array(4).fill({ name: 'X' }));
    five.players.push({ ...five.players[0], colorIndex: 5 });
    expect(restoreGame(JSON.parse(JSON.stringify(five)))).toBeNull();
    const oldColour = two();
    oldColour.players[1].colorIndex = 6;
    expect(restoreGame(oldColour)).toBeNull();
  });
});

describe('gainCoin', () => {
  it('adds a coin to the current player and logs it', () => {
    const g = two();
    expect(gainCoin(g, 'joker')).toEqual({ limitHit: false });
    expect(g.players[0].joker).toBe(1);
    expect(g.history.at(-1).text).toBe('+1 Joker');
  });

  it('the third coin returns all coins (coin rule)', () => {
    const g = two();
    g.players[0].joker = 1;
    g.players[0].gratis = 1;
    expect(gainCoin(g, 'gratis')).toEqual({ limitHit: true });
    expect(g.players[0]).toMatchObject({ joker: 0, gratis: 0 });
    expect(g.history.map(h => h.text)).toEqual(['+1 Gratis Fahrt', '3 Münzen – alle zurückgegeben']);
  });
});

describe('descentTurn', () => {
  const ALL = ['blue', 'red', 'black', 'yellow'];
  const base = { descent: 4, event: 'sonne', jokerOnEvent: false, slopes: { blue: 0, red: 0, black: 0, yellow: 0 }, ohneBefugnis: null, extra: null };
  const turn = (over, allowed = ALL) => descentTurn({ ...base, ...over, slopes: { ...base.slopes, ...over.slopes } }, allowed);

  it('sums the slopes and counts the used crossings', () => {
    expect(turn({ slopes: { red: 1, black: 1 } })).toMatchObject({ blocked: false, maxCrossings: 4, used: 2, total: 10, parts: ['Rot ×1 = 4', 'Schwarz ×1 = 6'] });
  });

  it('Pulverschnee adds 5 once a crossing is chosen', () => {
    expect(turn({ event: 'pulverschnee' }).total).toBe(0);
    expect(turn({ event: 'pulverschnee', slopes: { blue: 1 } }).total).toBe(7);
  });

  it('Schneesturm halves the crossings, a Joker restores them; points stay full', () => {
    expect(turn({ event: 'schneesturm', slopes: { red: 1 } })).toMatchObject({ maxCrossings: 2, total: 4 });
    expect(turn({ event: 'schneesturm', jokerOnEvent: true }).maxCrossings).toBe(4);
  });

  it('Unfall / Helikopter block the descent and all points unless a Joker averts them', () => {
    expect(turn({ event: 'unfall', slopes: { red: 1 }, extra: 12 })).toMatchObject({ blocked: true, maxCrossings: 0, used: 0, total: 0, parts: [] });
    expect(turn({ event: 'helikopter', jokerOnEvent: true, slopes: { red: 1 } })).toMatchObject({ blocked: false, total: 4 });
  });

  it('Ohne Befugnis with a sad smiley makes forbidden slopes negative', () => {
    expect(turn({ slopes: { red: 1, black: 1 }, ohneBefugnis: false }, ['blue', 'red'])).toMatchObject({ total: 4 - 6 });
    expect(turn({ slopes: { red: 1, black: 1 }, ohneBefugnis: true }, ['blue', 'red'])).toMatchObject({ total: 10 });
  });

  it('adds the Extraaktivität result', () => {
    expect(turn({ slopes: { blue: 1 }, extra: 12 }).total).toBe(14);
    expect(turn({ extra: 0 }).total).toBe(0);
  });
});

describe('takePause', () => {
  it('awards Restaurant +15 / Bar +7 once, inside the lunch window', () => {
    const g = two();
    g.round = 7;   // 11:00
    expect(takePause(g, 'restaurant')).toBe(15);
    expect(g.players[0]).toMatchObject({ points: 15, pauseDone: true });
    expect(g.history.at(-1).text).toBe('Mittagspause Restaurant: +15 Punkte');
    expect(takePause(g, 'bar')).toBe(0);   // already done
    advanceTurn(g);
    expect(takePause(g, 'bar')).toBe(7);
  });

  it('refuses outside 11:00–12:30 and rejects unknown kinds', () => {
    const g = two();
    expect(takePause(g, 'bar')).toBe(0);   // 08:00
    g.round = 11;                          // 13:00
    expect(takePause(g, 'bar')).toBe(0);
    expect(g.players[0]).toMatchObject({ points: 0, pauseDone: false });
    expect(() => takePause(g, 'picknick')).toThrow();
  });
});

describe('ranking', () => {
  it('sorts by points; equal points share a rank; ties keep turn order', () => {
    const g = createGame([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]);
    [10, 30, 10, 5].forEach((pts, i) => { g.players[i].points = pts; });
    expect(ranking(g)).toEqual([
      { playerIdx: 1, points: 30, rank: 1 },
      { playerIdx: 0, points: 10, rank: 2 },
      { playerIdx: 2, points: 10, rank: 2 },
      { playerIdx: 3, points: 5, rank: 4 },
    ]);
  });
});

describe('scoreRows', () => {
  it('one row per finished round with totals and deltas, plus a live row', () => {
    const g = two();
    g.players[0].points = 10;
    advanceTurn(g);
    g.players[1].points = 4;
    advanceTurn(g);            // round 1 done: [10, 4]
    g.players[0].points = 15;  // Anna played in round 2, Ben not yet
    advanceTurn(g);
    expect(scoreRows(g)).toEqual([
      { round: 1, time: '08:00', live: false, cells: [{ points: 10, delta: 10 }, { points: 4, delta: 4 }] },
      { round: 2, time: '08:30', live: true, cells: [{ points: 15, delta: 5 }, null] },
    ]);
  });

  it('no live row once the game is finished', () => {
    const g = two();
    g.finished = true;
    expect(scoreRows(g)).toEqual([]);
  });
});

describe('roundEntries', () => {
  it('filters the history by round and player', () => {
    const g = two();
    addHistory(g, 'A1');
    advanceTurn(g);
    addHistory(g, 'B1');
    expect(roundEntries(g, 1, 0).map(h => h.text)).toEqual(['A1']);
    expect(roundEntries(g, 1, 1).map(h => h.text)).toEqual(['B1']);
    expect(roundEntries(g, 2, 0)).toEqual([]);
  });
});

describe('adjustPlayer', () => {
  it('sets points and coins and logs each change for that player', () => {
    const g = two();
    expect(adjustPlayer(g, 1, { points: 12, joker: 1, gratis: 0 })).toBe(true);
    expect(g.players[1]).toMatchObject({ points: 12, joker: 1, gratis: 0 });
    expect(g.history.map(h => [h.playerIdx, h.text])).toEqual([[1, 'Anpassung: +12 Punkte'], [1, 'Anpassung: Joker 0 → 1']]);
    expect(adjustPlayer(g, 1, { points: 12, joker: 1, gratis: 0 })).toBe(false);
  });

  it('keeps the coins below the coin limit and never negative', () => {
    const g = two();
    adjustPlayer(g, 0, { points: 0, joker: 2, gratis: 2 });
    expect(g.players[0]).toMatchObject({ joker: 2, gratis: 0 });
    adjustPlayer(g, 0, { points: -3, joker: -1, gratis: 1 });
    expect(g.players[0]).toMatchObject({ points: -3, joker: 0, gratis: 1 });
    expect(g.history.at(-3).text).toBe('Anpassung: −3 Punkte');
  });
});

describe('Schlusswertung', () => {
  const none = { blue: 0, red: 0, black: 0, yellow: 0 };
  const finishedGame = () => { const g = two(); g.finished = true; return g; };

  it('Talstation reached: only the coin bonus (+5 per coin), coins returned', () => {
    const g = finishedGame();
    Object.assign(g.players[0], { points: 40, joker: 1, gratis: 1 });
    const r = applySchlusswertung(g, 0, { reached: true, slopes: none, transports: 0, extraTalstationen: 0 });
    expect(r.netDelta).toBe(10);
    expect(g.players[0]).toMatchObject({ points: 50, joker: 0, gratis: 0, schlusswertungDone: true });
    expect(g.history.at(-1)).toMatchObject({ playerIdx: 0, text: 'Schlusswertung: +10 Punkte' });
  });

  it('not reached: −15, half slope points, −5 per ride and per extra Talstation', () => {
    const g = finishedGame();
    g.players[1].points = 30;
    const answers = { reached: false, slopes: { ...none, red: 1, blue: 1 }, transports: 2, extraTalstationen: 1 };
    expect(previewSchlusswertung(g, 1, answers).netDelta).toBe(-15 - 2 - 1 - 10 - 5);
    expect(g.players[1].points).toBe(30);   // preview changes nothing
    applySchlusswertung(g, 1, answers);
    expect(g.players[1].points).toBe(30 - 33);
    expect(g.history.at(-1).text).toBe('Schlusswertung: −33 Punkte');
  });

  it('only once per player, only for a finished game; tells who is next', () => {
    const g = two();
    const answers = { reached: true, slopes: none, transports: 0, extraTalstationen: 0 };
    expect(applySchlusswertung(g, 0, answers)).toBeNull();   // game still running
    g.finished = true;
    expect(nextSchlusswertungPlayer(g)).toBe(0);
    applySchlusswertung(g, 0, answers);
    expect(applySchlusswertung(g, 0, answers)).toBeNull();
    expect(nextSchlusswertungPlayer(g)).toBe(1);
    applySchlusswertung(g, 1, answers);
    expect(nextSchlusswertungPlayer(g)).toBe(-1);
  });
});

describe('levelUp', () => {
  it('names the new level only when the points cross a level boundary upwards', () => {
    expect(levelUp(20, 21)).toBe('fortgeschritten');   // 20 is still Anfänger
    expect(levelUp(15, 80)).toBe('profi');              // skipping a level names the highest
    expect(levelUp(70, 71)).toBe('profi');
    expect(levelUp(21, 70)).toBeNull();                 // same level
    expect(levelUp(30, 10)).toBeNull();                 // going down is never celebrated
    expect(levelUp(5, 5)).toBeNull();
  });
});
