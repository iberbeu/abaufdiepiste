// ═══════════════════════════════════════════════════════════════════════════
// game_logic.js — Pure game logic for "Ab auf die Piste"
//
// This module contains all game rules that have no DOM or state dependencies.
// It is imported by dice_app.js (browser) and by Vitest tests (Node).
//
// All functions are exported as ES module exports so they can be tree-shaken
// in the browser bundle and imported directly by the test runner.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Constants ───────────────────────────────────────────────────────────────

export const TRANSPORT_SYMBOLS = [
  'fussweg', 'kleingondel', 'skilift', 'sesselbahn', 'gondel', 'zug'
];

export const TRANSPORT_NAMES = [
  'Fußweg', 'Kleingondel', 'Skilift', 'Sesselbahn', 'Gondel', 'Zug/Bus'
];

export const SLOPE_PTS = { blue: 2, red: 4, black: 6, yellow: 8 };

export const DESCENT_DICE = {
  anfaenger:       { faces: [1, 1, 2, 2, 3, 3] },
  fortgeschritten: { faces: [2, 2, 3, 3, 4, 4] },
  profi:           { faces: [3, 3, 4, 4, 6, 6] },
};

export const ALLOWED_SLOPES = {
  anfaenger:       ['blue', 'red'],
  fortgeschritten: ['blue', 'red', 'black'],
  profi:           ['blue', 'red', 'black', 'yellow'],
};

// ─── Player level ────────────────────────────────────────────────────────────

/**
 * Returns the level key for a given point total.
 * @param {number} pts
 * @returns {'anfaenger'|'fortgeschritten'|'profi'}
 */
export function getLevel(pts) {
  if (pts <= 20) return 'anfaenger';
  if (pts <= 70) return 'fortgeschritten';
  return 'profi';
}

/**
 * Returns the human-readable level label.
 * @param {'anfaenger'|'fortgeschritten'|'profi'} level
 * @returns {string}
 */
export function levelLabel(level) {
  return { anfaenger: 'Anfänger', fortgeschritten: 'Fortgeschritten', profi: 'Profi' }[level];
}

// ─── Game clock ──────────────────────────────────────────────────────────────

/**
 * Returns the in-game time string for a given start hour and round number.
 * Each round advances the clock by 30 minutes.
 * @param {number} startHour  — hour the game starts (e.g. 8)
 * @param {number} round      — current round (1-based)
 * @returns {string}  e.g. "09:30"
 */
export function gameTime(startHour, round) {
  const totalMin = (startHour * 60) + ((round - 1) * 30);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns the fractional in-game hour (for time-window comparisons).
 * @param {number} startHour
 * @param {number} round
 * @returns {number}
 */
export function gameTimeHour(startHour, round) {
  const totalMin = (startHour * 60) + ((round - 1) * 30);
  return totalMin / 60;
}

// ─── Transport dice analysis ─────────────────────────────────────────────────

/**
 * Analyses an array of 6 transport die symbols and returns all valid results.
 * Pure, DOM-free counterpart of analyzeTransport() in dice_app.js.
 *
 * @param {string[]} syms  — array of 6 symbol strings (from TRANSPORT_SYMBOLS)
 * @returns {Array<{ type: string, message: string }>}
 *   Each entry: type 'helicopter' | 'sonder' | 'valid' | 'invalid'
 *   Triplet + pair in same roll → two entries (sonder first, then valid).
 */
export function analyzeTransportSymbols(syms) {
  const counts = {};
  syms.forEach(s => { counts[s] = (counts[s] || 0) + 1; });

  // 6 same → helicopter
  if (Object.values(counts).some(c => c === 6)) {
    return [{
      type: 'helicopter',
      message: '6 gleiche – Helikopterflug! Du kannst beliebig weit fliegen!',
    }];
  }

  const results = [];

  // Triplets → Sonder-Transport (one report per triplet found)
  const triplets = Object.entries(counts).filter(([, c]) => c >= 3);
  triplets.forEach(([key]) => {
    const name = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(key)];
    results.push({
      type: 'sonder',
      message: `3× ${name} – Sonder-Transport erlaubt (Transportmittel ohne eigenes Symbol)!`,
    });
  });

  // Pairs (exactly 2 — triplets already reported above)
  const pairs = Object.entries(counts).filter(([, c]) => c === 2);
  if (pairs.length > 0) {
    const lines = pairs.map(([key]) => {
      const name = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(key)];
      return `${name} (2×)`;
    });
    results.push({
      type: 'valid',
      message: 'Gültige Beförderung: ' + lines.join('  +  '),
    });
  }

  if (results.length === 0) {
    return [{
      type: 'invalid',
      message: 'Keine gültige Kombination – in der Warteschlange bleiben oder Joker einsetzen.',
    }];
  }

  return results;
}

// ─── Descent point calculation ───────────────────────────────────────────────

/**
 * Calculates the total points for a descent turn.
 * Pure function — no DOM or state access.
 *
 * @param {Object} slopeSelection   — { blue: number, red: number, black: number, yellow: number }
 * @param {string|null} eventSym    — EVENT_FACES[n].sym, or null
 * @param {boolean} jokerUsedOnEvent
 * @param {boolean|null} ohneBefugnisResult — null=not rolled, true=green, false=red
 * @returns {{ total: number, basePoints: number, parts: string[], bonusText: string }}
 */
export function calcDescentPoints(slopeSelection, eventSym, jokerUsedOnEvent, ohneBefugnisResult) {
  let basePoints = 0;
  const parts = [];

  ['blue', 'red', 'black', 'yellow'].forEach(c => {
    const k = slopeSelection[c] || 0;
    if (k > 0) {
      const pts = k * SLOPE_PTS[c];
      const label = { blue: 'Blau', red: 'Rot', black: 'Schwarz', yellow: 'Gelb' }[c];
      parts.push(`${label} ×${k} = ${pts}`);
      basePoints += pts;
    }
  });

  let total = basePoints;
  let bonusText = '';

  if (eventSym === 'schneesturm' && !jokerUsedOnEvent) {
    total = Math.floor(total / 2);
    bonusText = ' (÷2 Schneesturm)';
  }
  if (eventSym === 'pulverschnee' && basePoints > 0) {
    total += 5;
    bonusText = ' (+5 Pulverschnee)';
  }
  if (ohneBefugnisResult === false) {
    total = -total;
    bonusText += ' (Ohne Befugnis: negativ)';
  }

  return { total, basePoints, parts, bonusText };
}

// ─── Sightseeing bonus calculation ───────────────────────────────────────────

/**
 * Returns the bonus points for visiting a new sightseeing spot.
 * First visit: +5, second: +10, third: +15, then +5 each time.
 * @param {number} previousSightings — number of sightseeing spots already visited by this player
 * @returns {number}
 */
export function sightseeingBonus(previousSightings) {
  return (previousSightings + 1) * 5;
}
