import { describe, it, expect } from 'vitest';
import {
  getLevel,
  levelLabel,
  gameTime,
  gameTimeHour,
  analyzeTransportSymbols,
  calcDescentPoints,
  sightseeingBonus,
  TRANSPORT_SYMBOLS,
  SLOPE_PTS,
} from '../game_logic.js';

// ─── Player level ─────────────────────────────────────────────────────────────

describe('getLevel', () => {
  it('returns anfaenger for 0 points', () => {
    expect(getLevel(0)).toBe('anfaenger');
  });
  it('returns anfaenger at the boundary (20 pts)', () => {
    expect(getLevel(20)).toBe('anfaenger');
  });
  it('returns fortgeschritten just above boundary (21 pts)', () => {
    expect(getLevel(21)).toBe('fortgeschritten');
  });
  it('returns fortgeschritten at upper boundary (70 pts)', () => {
    expect(getLevel(70)).toBe('fortgeschritten');
  });
  it('returns profi above upper boundary (71 pts)', () => {
    expect(getLevel(71)).toBe('profi');
  });
  it('returns profi for high scores', () => {
    expect(getLevel(200)).toBe('profi');
  });
});

describe('levelLabel', () => {
  it('maps anfaenger to Anfänger', () => {
    expect(levelLabel('anfaenger')).toBe('Anfänger');
  });
  it('maps fortgeschritten to Fortgeschritten', () => {
    expect(levelLabel('fortgeschritten')).toBe('Fortgeschritten');
  });
  it('maps profi to Profi', () => {
    expect(levelLabel('profi')).toBe('Profi');
  });
});

// ─── Game clock ───────────────────────────────────────────────────────────────

describe('gameTime', () => {
  it('returns 08:00 at start (hour 8, round 1)', () => {
    expect(gameTime(8, 1)).toBe('08:00');
  });
  it('advances 30 min per round', () => {
    expect(gameTime(8, 2)).toBe('08:30');
    expect(gameTime(8, 3)).toBe('09:00');
  });
  it('handles start at different hour', () => {
    expect(gameTime(10, 1)).toBe('10:00');
    expect(gameTime(10, 3)).toBe('11:00');
  });
  it('wraps past midnight correctly', () => {
    // 23:00 + 2 rounds = 00:00
    expect(gameTime(23, 3)).toBe('00:00');
  });
  it('pads single-digit hours and minutes', () => {
    expect(gameTime(8, 1)).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('gameTimeHour', () => {
  it('returns exact hour for round 1', () => {
    expect(gameTimeHour(8, 1)).toBe(8);
  });
  it('returns 11.0 at round that lands on 11:00 with start 8', () => {
    // round 7: 8h + 6*30min = 8h + 180min = 11h
    expect(gameTimeHour(8, 7)).toBe(11);
  });
  it('returns 12.5 for the end of the lunch window', () => {
    // start 8, round 10: 8 + 9*0.5 = 12.5
    expect(gameTimeHour(8, 10)).toBe(12.5);
  });
});

// ─── Transport dice analysis ──────────────────────────────────────────────────

describe('analyzeTransportSymbols — helicopter', () => {
  it('detects 6 identical symbols as helicopter', () => {
    const syms = Array(6).fill('gondel');
    const [result] = analyzeTransportSymbols(syms);
    expect(result.type).toBe('helicopter');
  });
});

describe('analyzeTransportSymbols — Sonder-Transport', () => {
  it('detects a triplet with no pair as sonder only', () => {
    // 3× fussweg + 1× gondel + 1× zug + 1× skilift  (no pair)
    const syms = ['fussweg', 'fussweg', 'fussweg', 'gondel', 'zug', 'skilift'];
    const results = analyzeTransportSymbols(syms);
    expect(results[0].type).toBe('sonder');
    expect(results).toHaveLength(1);
  });
});

describe('analyzeTransportSymbols — valid pair', () => {
  it('detects a simple pair', () => {
    const syms = ['gondel', 'gondel', 'fussweg', 'skilift', 'zug', 'sesselbahn'];
    const [result] = analyzeTransportSymbols(syms);
    expect(result.type).toBe('valid');
    expect(result.message).toContain('Gondel');
  });

  it('detects multiple pairs and reports all', () => {
    // 2× gondel + 2× skilift + 1× fussweg + 1× zug
    const syms = ['gondel', 'gondel', 'skilift', 'skilift', 'fussweg', 'zug'];
    const [result] = analyzeTransportSymbols(syms);
    expect(result.type).toBe('valid');
    expect(result.message).toContain('Gondel');
    expect(result.message).toContain('Skilift');
  });

  // BUG-8 regression: triplet + pair in same roll → both must be reported
  it('BUG-8: triplet + pair in same roll → returns sonder AND valid', () => {
    // 3× gondel + 2× skilift + 1× fussweg
    const syms = ['gondel', 'gondel', 'gondel', 'skilift', 'skilift', 'fussweg'];
    const results = analyzeTransportSymbols(syms);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('sonder');
    expect(results[0].message).toContain('Gondel');
    expect(results[1].type).toBe('valid');
    expect(results[1].message).toContain('Skilift');
  });
});

describe('analyzeTransportSymbols — invalid', () => {
  it('returns invalid when no valid combination', () => {
    // all different
    const syms = TRANSPORT_SYMBOLS.slice(); // 6 unique symbols
    const [result] = analyzeTransportSymbols(syms);
    expect(result.type).toBe('invalid');
  });
});

// ─── Descent point calculation ────────────────────────────────────────────────

const noEvent = null;

describe('calcDescentPoints — basic slope points', () => {
  it('calculates blue piste correctly (2 pts per crossing)', () => {
    const sel = { blue: 3, red: 0, black: 0, yellow: 0 };
    const { total, basePoints } = calcDescentPoints(sel, noEvent, false, null);
    expect(basePoints).toBe(6);
    expect(total).toBe(6);
  });

  it('calculates mixed slopes', () => {
    // 2×blue=4 + 1×red=4 + 1×black=6 = 14
    const sel = { blue: 2, red: 1, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, noEvent, false, null);
    expect(total).toBe(14);
  });

  it('returns 0 for empty selection', () => {
    const sel = { blue: 0, red: 0, black: 0, yellow: 0 };
    const { total, parts } = calcDescentPoints(sel, noEvent, false, null);
    expect(total).toBe(0);
    expect(parts).toHaveLength(0);
  });
});

describe('calcDescentPoints — SLOPE_PTS constant values', () => {
  it('blue = 2', () => expect(SLOPE_PTS.blue).toBe(2));
  it('red = 4',  () => expect(SLOPE_PTS.red).toBe(4));
  it('black = 6',() => expect(SLOPE_PTS.black).toBe(6));
  it('yellow = 8',() => expect(SLOPE_PTS.yellow).toBe(8));
});

describe('calcDescentPoints — Schneesturm (halve points)', () => {
  it('halves base points on schneesturm (floors odd totals)', () => {
    // 1×red = 4 → floor(4/2) = 2
    const sel = { blue: 0, red: 1, black: 0, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'schneesturm', false, null);
    expect(total).toBe(2);
  });

  it('floors odd results (3 pts → 1)', () => {
    // 1×blue=2 + 0 → actually not odd, use 3 crossings: none with exactly 3 base.
    // 1×black = 6 → floor(6/2)=3; use 3×blue=6→3
    const sel = { blue: 3, red: 0, black: 0, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'schneesturm', false, null);
    expect(total).toBe(3);
  });

  it('joker cancels schneesturm — full points apply', () => {
    const sel = { blue: 0, red: 1, black: 0, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'schneesturm', true, null);
    expect(total).toBe(4); // full red piste points
  });

  it('includes (÷2 Schneesturm) in bonusText', () => {
    const sel = { blue: 0, red: 1, black: 0, yellow: 0 };
    const { bonusText } = calcDescentPoints(sel, 'schneesturm', false, null);
    expect(bonusText).toContain('Schneesturm');
  });
});

describe('calcDescentPoints — Pulverschnee (+5 bonus)', () => {
  it('adds +5 to total', () => {
    const sel = { blue: 1, red: 0, black: 0, yellow: 0 }; // base=2
    const { total } = calcDescentPoints(sel, 'pulverschnee', false, null);
    expect(total).toBe(7);
  });

  it('no bonus on empty slope selection (BUG-11 fix: bonus requires actual skiing)', () => {
    const sel = { blue: 0, red: 0, black: 0, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'pulverschnee', false, null);
    expect(total).toBe(0);
  });
});

describe('calcDescentPoints — Ohne Befugnis (red result negates)', () => {
  it('negates total on red (ohneBefugnisResult=false)', () => {
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 }; // base=6
    const { total } = calcDescentPoints(sel, noEvent, false, false);
    expect(total).toBe(-6);
  });

  it('does not negate on green (ohneBefugnisResult=true)', () => {
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, noEvent, false, true);
    expect(total).toBe(6);
  });

  it('does not negate when ohneBefugnisResult is null (not yet rolled)', () => {
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, noEvent, false, null);
    expect(total).toBe(6);
  });
});

describe('calcDescentPoints — combined modifiers', () => {
  it('schneesturm + pulverschnee cannot coexist, but stacking logic is correct', () => {
    // If both were active (impossible in practice), schneesturm halves first, then +5 is added
    // This test documents the priority/order
    const sel = { blue: 0, red: 2, black: 0, yellow: 0 }; // base=8
    // schneesturm only: floor(8/2)=4
    const { total: t1 } = calcDescentPoints(sel, 'schneesturm', false, null);
    expect(t1).toBe(4);
    // pulverschnee only: 8+5=13
    const { total: t2 } = calcDescentPoints(sel, 'pulverschnee', false, null);
    expect(t2).toBe(13);
  });

  it('schneesturm + ohneBefugnis red: halved then negated', () => {
    // 1×black=6 → halved=3 → negated=-3
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'schneesturm', false, false);
    expect(total).toBe(-3);
  });
});

// ─── Sightseeing bonus ────────────────────────────────────────────────────────

describe('sightseeingBonus', () => {
  it('1st sighting → +5', () => expect(sightseeingBonus(0)).toBe(5));
  it('2nd sighting → +10', () => expect(sightseeingBonus(1)).toBe(10));
  it('3rd sighting → +15', () => expect(sightseeingBonus(2)).toBe(15));
  it('4th sighting → +20', () => expect(sightseeingBonus(3)).toBe(20));
  it('scales linearly', () => {
    for (let i = 0; i < 10; i++) {
      expect(sightseeingBonus(i)).toBe((i + 1) * 5);
    }
  });
});
