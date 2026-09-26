import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  getLevel,
  levelLabel,
  levelStars,
  gameTime,
  gameTimeHour,
  analyzeTransportSymbols,
  calcDescentPoints,
  effectiveCrossings,
  sightseeingBonus,
  calcAbschlusswertungResult,
  TRANSPORT_SYMBOLS,
  SLOPE_PTS,
  DESCENT_DICE,
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

describe('levelStars', () => {
  it('shows one filled star for anfaenger', () => {
    expect(levelStars('anfaenger')).toBe('★☆☆');
  });
  it('shows two filled stars for fortgeschritten', () => {
    expect(levelStars('fortgeschritten')).toBe('★★☆');
  });
  it('shows three filled stars for profi', () => {
    expect(levelStars('profi')).toBe('★★★');
  });
});

describe('descent die face images (img/descent_*.svg)', () => {
  Object.entries(DESCENT_DICE).forEach(([level, { faces }]) => {
    [...new Set(faces)].forEach(face => {
      it(`${level} face ${face}: image exists, shows the number and the level's star count`, () => {
        const svg = readFileSync(new URL(`../img/descent_${level}_${face}.svg`, import.meta.url), 'utf8');
        const filledStars = levelStars(level).split('★').length - 1;
        expect(svg).toContain(`>${face}</text>`);
        expect(svg.match(/<polygon /g) ?? []).toHaveLength(filledStars);
      });
    });
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

describe('analyzeTransportSymbols — Joker (wildcard)', () => {
  it('one triplet with only singles → wildcard1 listing all valid targets', () => {
    // 3× fussweg + 1× gondel + 1× zug + 1× skilift — joker can pair with any of the singles
    const syms = ['fussweg', 'fussweg', 'fussweg', 'gondel', 'zug', 'skilift'];
    const results = analyzeTransportSymbols(syms);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('wildcard1');
    expect(results[0].message).toContain('Gondel');
    expect(results[0].message).toContain('Zug/Bus');
    expect(results[0].message).toContain('Skilift');
  });

  it('two triplets → two independent wildcard1s, each needing the other as target', () => {
    // 3× gondel + 3× skilift — each triplet is a joker combinable only with the other symbol;
    // no wildcard2 and no spurious valid entries from double-counting the triplet dice.
    const syms = ['gondel', 'gondel', 'gondel', 'skilift', 'skilift', 'skilift'];
    const results = analyzeTransportSymbols(syms);
    expect(results).toHaveLength(2);
    expect(results.some(r => r.type === 'wildcard2')).toBe(false);
    const wc = results.filter(r => r.type === 'wildcard1');
    expect(wc).toHaveLength(2);
    const gondelWc = wc.find(r => r.message.includes('Gondel'));
    expect(gondelWc.message).toContain('Skilift');
    const skiliftWc = wc.find(r => r.message.includes('Skilift'));
    expect(skiliftWc.message).toContain('Gondel');
  });

  it('triplet + pair → wildcard1 AND valid pair both reported', () => {
    // 3× gondel + 2× skilift + 1× fussweg — joker (can target skilift or fussweg) + skilift pair
    const syms = ['gondel', 'gondel', 'gondel', 'skilift', 'skilift', 'fussweg'];
    const results = analyzeTransportSymbols(syms);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('wildcard1');
    expect(results[0].message).toContain('Skilift');
    expect(results[0].message).toContain('Fußweg');
    expect(results[1].type).toBe('valid');
    expect(results[1].message).toContain('Skilift');
  });

  it('4-of-a-kind: wildcard does NOT list its own symbol as a target', () => {
    // 4× gondel + 2× skilift — triplet from gondel, remaining: gondel×1, skilift×2
    // joker must not list "Gondel" as a combinable target (same symbol as the wildcard)
    const syms = ['gondel', 'gondel', 'gondel', 'gondel', 'skilift', 'skilift'];
    const results = analyzeTransportSymbols(syms);
    expect(results[0].type).toBe('wildcard1');
    // "Gondel" appears in "3× Gondel – Joker!" but must NOT appear after "Kombinierbar mit:"
    const targets = results[0].message.split('Kombinierbar mit:')[1] ?? '';
    expect(targets).not.toContain('Gondel');
    expect(targets).toContain('Skilift');
    // regular pair of skilift is also valid
    expect(results[1].type).toBe('valid');
    expect(results[1].message).toContain('Skilift');
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
});

describe('analyzeTransportSymbols — invalid', () => {
  it('returns invalid when no valid combination', () => {
    // all different
    const syms = TRANSPORT_SYMBOLS.slice(); // 6 unique symbols
    const [result] = analyzeTransportSymbols(syms);
    expect(result.type).toBe('invalid');
  });
});

// ─── Descent dice faces ───────────────────────────────────────────────────────

describe('DESCENT_DICE — face values per rulebook', () => {
  it('every die has exactly 6 faces', () => {
    Object.values(DESCENT_DICE).forEach(d => expect(d.faces).toHaveLength(6));
  });

  it('Anfänger (1-star die) shows only 2 and 4', () => {
    expect(new Set(DESCENT_DICE.anfaenger.faces)).toEqual(new Set([2, 4]));
  });

  it('Fortgeschritten (2-star die) shows 2, 4 and 6', () => {
    expect(new Set(DESCENT_DICE.fortgeschritten.faces)).toEqual(new Set([2, 4, 6]));
  });

  it('Profi (3-star die) shows only 4 and 6', () => {
    expect(new Set(DESCENT_DICE.profi.faces)).toEqual(new Set([4, 6]));
  });

  it('all faces are even, so Schneesturm halving is always a whole number', () => {
    Object.values(DESCENT_DICE).forEach(d => {
      d.faces.forEach(f => expect(f % 2).toBe(0));
    });
  });
});

// ─── Descent movement (Schneesturm) ───────────────────────────────────────────

describe('effectiveCrossings', () => {
  it('returns the rolled value when there is no event', () => {
    expect(effectiveCrossings(4, null, false)).toBe(4);
  });

  it('returns the rolled value for unrelated events', () => {
    expect(effectiveCrossings(6, 'pulverschnee', false)).toBe(6);
    expect(effectiveCrossings(6, 'sonne', false)).toBe(6);
  });

  it('halves the rolled value on Schneesturm', () => {
    expect(effectiveCrossings(2, 'schneesturm', false)).toBe(1);
    expect(effectiveCrossings(4, 'schneesturm', false)).toBe(2);
    expect(effectiveCrossings(6, 'schneesturm', false)).toBe(3);
  });

  it('a Joker on the event restores full movement', () => {
    expect(effectiveCrossings(6, 'schneesturm', true)).toBe(6);
  });

  it('never immobilises the player — every real face keeps at least 1 crossing', () => {
    Object.values(DESCENT_DICE).forEach(d => {
      d.faces.forEach(f => {
        expect(effectiveCrossings(f, 'schneesturm', false)).toBeGreaterThanOrEqual(1);
      });
    });
  });
});

// ─── Descent point calculation ────────────────────────────────────────────────

const noEvent = null;

describe('calcDescentPoints — basic slope points', () => {
  it('calculates blue piste correctly (2 pts per crossing)', () => {
    const sel = { blue: 3, red: 0, black: 0, yellow: 0 };
    const { total, basePoints } = calcDescentPoints(sel, noEvent, null);
    expect(basePoints).toBe(6);
    expect(total).toBe(6);
  });

  it('calculates mixed slopes', () => {
    // 2×blue=4 + 1×red=4 + 1×black=6 = 14
    const sel = { blue: 2, red: 1, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, noEvent, null);
    expect(total).toBe(14);
  });

  it('returns 0 for empty selection', () => {
    const sel = { blue: 0, red: 0, black: 0, yellow: 0 };
    const { total, parts } = calcDescentPoints(sel, noEvent, null);
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

describe('calcDescentPoints — Schneesturm does NOT touch points', () => {
  it('pays full points for the slopes actually skied', () => {
    // 1×red = 4 → still 4; Schneesturm only limits how far you get (effectiveCrossings)
    const sel = { blue: 0, red: 1, black: 0, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'schneesturm', null);
    expect(total).toBe(4);
  });

  it('gives the same total as no event at all', () => {
    const sel = { blue: 3, red: 0, black: 0, yellow: 0 };
    const { total: storm } = calcDescentPoints(sel, 'schneesturm', null);
    const { total: calm }  = calcDescentPoints(sel, noEvent, null);
    expect(storm).toBe(calm);
  });

  it('adds no Schneesturm note to bonusText', () => {
    const sel = { blue: 0, red: 1, black: 0, yellow: 0 };
    const { bonusText } = calcDescentPoints(sel, 'schneesturm', null);
    expect(bonusText).not.toContain('Schneesturm');
  });
});

describe('calcDescentPoints — Pulverschnee (+5 bonus)', () => {
  it('adds +5 to total', () => {
    const sel = { blue: 1, red: 0, black: 0, yellow: 0 }; // base=2
    const { total } = calcDescentPoints(sel, 'pulverschnee', null);
    expect(total).toBe(7);
  });

  it('no bonus on empty slope selection (BUG-11 fix: bonus requires actual skiing)', () => {
    const sel = { blue: 0, red: 0, black: 0, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'pulverschnee', null);
    expect(total).toBe(0);
  });
});

const anfaengerSlopes = ['blue', 'red'];

describe('calcDescentPoints — Ohne Befugnis (sad smiley negates)', () => {
  it('negates only forbidden slope on sad smiley (only forbidden slope selected)', () => {
    // Anfänger selects 1×black (forbidden, 6pts) — sad smiley → -6
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, noEvent, false, anfaengerSlopes);
    expect(total).toBe(-6);
  });

  it('keeps allowed points, negates forbidden on sad smiley (mixed selection)', () => {
    // Anfänger selects 1×red (allowed, 4pts) + 1×black (forbidden, 6pts) — sad smiley → 4-6=-2
    const sel = { blue: 0, red: 1, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, noEvent, false, anfaengerSlopes);
    expect(total).toBe(-2);
  });

  it('does not negate on happy smiley (ohneBefugnisResult=true)', () => {
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, noEvent, true, anfaengerSlopes);
    expect(total).toBe(6);
  });

  it('does not negate when ohneBefugnisResult is null (not yet rolled)', () => {
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, noEvent, null, anfaengerSlopes);
    expect(total).toBe(6);
  });
});

describe('calcDescentPoints — Ohne Befugnis joker rescue (FEAT-19)', () => {
  it('joker rescue (flips result to true) gives same total as natural happy-smiley roll', () => {
    // 1×black=6 (forbidden for Anfänger)
    // sad smiley (no rescue) → -6; happy smiley (natural or joker-rescued) → +6
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total: sad }     = calcDescentPoints(sel, noEvent, false, anfaengerSlopes);
    const { total: rescued } = calcDescentPoints(sel, noEvent, true,  anfaengerSlopes);
    expect(sad).toBe(-6);
    expect(rescued).toBe(6);
  });

  it('schneesturm + joker rescue: full points, not negated', () => {
    // 1×black=6 → Schneesturm leaves points alone → ohneBefugnisResult=true → +6
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'schneesturm', true, anfaengerSlopes);
    expect(total).toBe(6);
  });

  it('without rescue (sad smiley): forbidden penalty is full, Schneesturm changes nothing', () => {
    // 1×black=6 (forbidden), no allowed slopes → total = 0-6 = -6
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'schneesturm', false, anfaengerSlopes);
    expect(total).toBe(-6);
  });
});

describe('calcDescentPoints — combined modifiers', () => {
  it('schneesturm leaves points untouched, pulverschnee still adds +5', () => {
    const sel = { blue: 0, red: 2, black: 0, yellow: 0 }; // base=8
    const { total: t1 } = calcDescentPoints(sel, 'schneesturm', null);
    expect(t1).toBe(8);
    const { total: t2 } = calcDescentPoints(sel, 'pulverschnee', null);
    expect(t2).toBe(13);
  });

  it('schneesturm + ohneBefugnis sad smiley + mixed slopes: only the forbidden penalty applies', () => {
    // 1×red=4 (allowed) + 1×black=6 (forbidden) — sad smiley → 4-6 = -2
    const sel = { blue: 0, red: 1, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'schneesturm', false, anfaengerSlopes);
    expect(total).toBe(-2);
  });

  it('pulverschnee + ohneBefugnis sad smiley + mixed slopes: bonus applies to allowed portion only', () => {
    // 1×red=4 (allowed) + 1×black=6 (forbidden) — pulverschnee — sad smiley
    // allowed: 4+5=9; forbidden: 6 → total = 9-6 = 3
    const sel = { blue: 0, red: 1, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'pulverschnee', false, anfaengerSlopes);
    expect(total).toBe(3);
  });

  it('pulverschnee + ohneBefugnis sad smiley + only forbidden: no bonus (nothing to ski legitimately)', () => {
    // 1×black=6 (all forbidden) — pulverschnee — sad smiley
    // allowedBase=0 → bonus guard blocks; total = 0-6 = -6
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const { total } = calcDescentPoints(sel, 'pulverschnee', false, anfaengerSlopes);
    expect(total).toBe(-6);
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

// ─── Abschlusswertung (FEAT-22) ───────────────────────────────────────────────

const noSel = { blue: 0, red: 0, black: 0, yellow: 0 };

describe('calcAbschlusswertungResult — talstation reached', () => {
  it('no penalties when talstation reached', () => {
    const r = calcAbschlusswertungResult(true, noSel, 0, 0, 0);
    expect(r.penaltyItems).toHaveLength(0);
    expect(r.penaltyTotal).toBe(0);
  });

  it('coin bonus applies even when no penalties', () => {
    const r = calcAbschlusswertungResult(true, noSel, 0, 0, 2);
    expect(r.coinBonus).toBe(10);
    expect(r.netDelta).toBe(10);
  });

  it('zero coins → zero bonus', () => {
    const r = calcAbschlusswertungResult(true, noSel, 0, 0, 0);
    expect(r.coinBonus).toBe(0);
    expect(r.netDelta).toBe(0);
  });
});

describe('calcAbschlusswertungResult — talstation not reached (penalties)', () => {
  it('always includes −15 base penalty', () => {
    const r = calcAbschlusswertungResult(false, noSel, 0, 0, 0);
    expect(r.penaltyItems[0].label).toBe('Talstation nicht erreicht');
    expect(r.penaltyItems[0].amount).toBe(-15);
    expect(r.penaltyTotal).toBe(-15);
  });

  it('blue slope penalty: floor(crossings × 2 / 2) per crossing', () => {
    const sel = { blue: 3, red: 0, black: 0, yellow: 0 };
    const r = calcAbschlusswertungResult(false, sel, 0, 0, 0);
    const slopeItem = r.penaltyItems.find(it => it.label.startsWith('Blaue'));
    expect(slopeItem.amount).toBe(-3); // floor(3×2/2) = 3
  });

  it('red slope penalty: floor(crossings × 4 / 2)', () => {
    const sel = { blue: 0, red: 2, black: 0, yellow: 0 };
    const r = calcAbschlusswertungResult(false, sel, 0, 0, 0);
    const slopeItem = r.penaltyItems.find(it => it.label.startsWith('Rote'));
    expect(slopeItem.amount).toBe(-4); // floor(2×4/2) = 4
  });

  it('black slope penalty: floor(crossings × 6 / 2)', () => {
    const sel = { blue: 0, red: 0, black: 1, yellow: 0 };
    const r = calcAbschlusswertungResult(false, sel, 0, 0, 0);
    const slopeItem = r.penaltyItems.find(it => it.label.startsWith('Schwarze'));
    expect(slopeItem.amount).toBe(-3); // floor(1×6/2) = 3
  });

  it('yellow slope penalty: floor(crossings × 8 / 2)', () => {
    const sel = { blue: 0, red: 0, black: 0, yellow: 2 };
    const r = calcAbschlusswertungResult(false, sel, 0, 0, 0);
    const slopeItem = r.penaltyItems.find(it => it.label.startsWith('Gelbe'));
    expect(slopeItem.amount).toBe(-8); // floor(2×8/2) = 8
  });

  it('each transport back adds one −5 item', () => {
    const r = calcAbschlusswertungResult(false, noSel, 3, 0, 0);
    const transports = r.penaltyItems.filter(it => it.label === 'Beförderung zurück');
    expect(transports).toHaveLength(3);
    transports.forEach(it => expect(it.amount).toBe(-5));
  });

  it('each extra talstation adds one −5 item', () => {
    const r = calcAbschlusswertungResult(false, noSel, 0, 2, 0);
    const extraTs = r.penaltyItems.filter(it => it.label === 'Zusätzliche Talstation');
    expect(extraTs).toHaveLength(2);
    extraTs.forEach(it => expect(it.amount).toBe(-5));
  });

  it('penaltyTotal sums all items', () => {
    const sel = { blue: 0, red: 1, black: 0, yellow: 0 };
    // -15 (base) + -2 (red×1, floor(4/2)) + -5 (1 transport) = -22
    const r = calcAbschlusswertungResult(false, sel, 1, 0, 0);
    expect(r.penaltyTotal).toBe(-22);
  });

  it('netDelta = penaltyTotal + coinBonus', () => {
    const sel = { blue: 0, red: 1, black: 0, yellow: 0 };
    // penaltyTotal = -22, coinBonus = 2×5 = 10 → netDelta = -12
    const r = calcAbschlusswertungResult(false, sel, 1, 0, 2);
    expect(r.netDelta).toBe(-12);
  });

  it('coins can make netDelta positive (many coins, few penalties)', () => {
    // -15 only, 4 coins (+20) → netDelta = +5
    const r = calcAbschlusswertungResult(false, noSel, 0, 0, 4);
    expect(r.netDelta).toBe(5);
  });

  it('zero transport and zero extra talstationen → only base −15', () => {
    const r = calcAbschlusswertungResult(false, noSel, 0, 0, 0);
    expect(r.penaltyItems).toHaveLength(1);
    expect(r.netDelta).toBe(-15);
  });

  it('skips slope colours with 0 crossings', () => {
    const r = calcAbschlusswertungResult(false, noSel, 0, 0, 0);
    const slopeItems = r.penaltyItems.filter(it => it.label.includes('Piste'));
    expect(slopeItems).toHaveLength(0);
  });
});
