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

// Names as in spielregeln.md (decision 27.09.2026). The keys in TRANSPORT_SYMBOLS are internal ids / image names.
export const TRANSPORT_NAMES = [
  'Fussweg', 'Kleingondel', 'Schlepplift', 'Sessellift', 'Kabinengondel', 'Zug/Bus'
];

export const SLOPE_PTS = { blue: 2, red: 4, black: 6, yellow: 8 };
export const SLOPE_PISTE_LABELS = { blue: 'Blaue Piste', red: 'Rote Piste', black: 'Schwarze Piste', yellow: 'Gelbe Piste' };
export const PULVERSCHNEE_BONUS = 5;   // event Pulverschnee, only with at least one crossing skied

// Event die faces (v1 keeps its own presentation list in dice_app.js, same order).
export const EVENT_SYMBOLS = ['fahrt', 'helikopter', 'schneesturm', 'pulverschnee', 'unfall', 'sonne'];
// Events a Joker can avert (spielregeln.md: "Joker … negative Ereignisse abzuwenden").
export const JOKER_EVENTS = ['schneesturm', 'unfall', 'helikopter'];
// Events that stop the descent this turn unless a Joker averts them.
export const BLOCKING_EVENTS = ['unfall', 'helikopter'];

// Coins: as soon as a player holds this many unused coins (Joker + Gratis Fahrt), all are returned.
export const COIN_LIMIT = 3;
export const EXTRA_ACTIVITY_POINTS = 12;   // Extraaktivität, happy smiley
export const PAUSE_POINTS = { restaurant: 15, bar: 7 };   // Mittagspause (11:00–12:30, once per game)
// Transport dice (decision 27.09.2026): 5 identical = free ride, any distance; 6 identical = free ride
// + JACKPOT_POINTS. Both only by dice luck — a die turned with a Joker never counts towards them.
export const FREE_RIDE_COUNT = 5;
export const JACKPOT_COUNT = 6;
export const JACKPOT_POINTS = 30;

// Schlusswertung (spielregeln.md, "Schlusswertung"): penalties when the Talstation is not reached,
// bonus per remaining coin. Pistes on the way back cost half their normal points (SLOPE_PTS / 2).
export const SCHLUSS = {
  talstationMissed: -15,
  returnRide: -5,          // per transport used to get back
  extraTalstation: -5,     // per additional Talstation (valley change)
  coinBonus: 5,            // per remaining coin (Joker or Gratis Fahrt)
};

// Face values per the rulebook (specifications/spielregeln.md, "Fahrniveaus"):
// Anfänger = 1-star die (2, 4), Fortgeschritten = 2-star die (2, 4, 6), Profi = 3-star die (4, 6).
// The three dice look identical; every face shows the crossing count plus the level's stars.
export const DESCENT_DICE = {
  anfaenger:       { faces: [2, 2, 2, 4, 4, 4] },
  fortgeschritten: { faces: [2, 2, 4, 4, 6, 6] },
  profi:           { faces: [4, 4, 4, 6, 6, 6] },
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
// Highest point total of each level (spielregeln.md, "Fahrniveaus"); above 70 = Profi.
export const LEVEL_MAX_POINTS = { anfaenger: 20, fortgeschritten: 70 };

export function getLevel(pts) {
  if (pts <= LEVEL_MAX_POINTS.anfaenger) return 'anfaenger';
  if (pts <= LEVEL_MAX_POINTS.fortgeschritten) return 'fortgeschritten';
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

/**
 * Returns the level as a star rating, e.g. '★☆☆' for Anfänger.
 * The filled stars match the ones printed on the physical descent die.
 * @param {'anfaenger'|'fortgeschritten'|'profi'} level
 * @returns {string}
 */
export function levelStars(level) {
  const n = { anfaenger: 1, fortgeschritten: 2, profi: 3 }[level];
  return '★'.repeat(n) + '☆'.repeat(3 - n);
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
 *   Each entry: type 'freeRide' | 'wildcard1' | 'valid' | 'invalid'
 *   freeRide (5+ identical) also carries `points` (JACKPOT_POINTS for 6 identical, else 0).
 *   Triplet + non-triplet pair → two entries (wildcard1 first, then valid).
 */
export function analyzeTransportSymbols(syms) {
  const counts = {};
  syms.forEach(s => { counts[s] = (counts[s] || 0) + 1; });

  // 5× same → free ride, 6× same → free ride + jackpot (v1 has no Joker on transport dice)
  const most = Math.max(...Object.values(counts));
  if (most >= FREE_RIDE_COUNT) {
    const jackpot = most >= JACKPOT_COUNT;
    return [{
      type: 'freeRide',
      points: jackpot ? JACKPOT_POINTS : 0,
      message: jackpot
        ? `${JACKPOT_COUNT} gleiche – freie Fahrt, beliebig weit, und +${JACKPOT_POINTS} Punkte!`
        : `${FREE_RIDE_COUNT} gleiche – freie Fahrt, beliebig weit!`,
    }];
  }

  const results = [];

  // Each triplet (count ≥ 3) is a wildcard: substitutes for 1× of any other symbol already present.
  const triplets = Object.entries(counts).filter(([, c]) => c >= 3);

  if (triplets.length > 0) {
    const tripletKeys = new Set(triplets.map(([k]) => k));

    for (const [tripletKey] of triplets) {
      const tripletName = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(tripletKey)];

      // Remaining counts after consuming the 3 dice used as wildcard
      const remaining = { ...counts };
      remaining[tripletKey] -= 3;
      if (remaining[tripletKey] <= 0) delete remaining[tripletKey];

      // Valid targets: any OTHER symbol with ≥1 remaining die (wildcard + 1× = pair)
      const targets = Object.entries(remaining)
        .filter(([key, c]) => key !== tripletKey && c >= 1)
        .map(([key]) => TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(key)]);

      results.push({
        type: 'wildcard1',
        message: targets.length > 0
          ? `3× ${tripletName} – Joker! Kombinierbar mit: ${targets.join(', ')}`
          : `3× ${tripletName} – Joker, aber keine weiteren Symbole zum Kombinieren.`,
      });

      // Report standalone pairs from remaining dice, but skip symbols that are themselves jokers
      // (those dice are already represented by their own wildcard1 entry).
      const pairs = Object.entries(remaining).filter(([key, c]) => c >= 2 && !tripletKeys.has(key));
      if (pairs.length > 0) {
        const lines = pairs.map(([key]) => TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(key)] + ' (2×)');
        results.push({
          type: 'valid',
          message: 'Gültige Beförderung: ' + lines.join('  +  '),
        });
      }
    }
  } else {
    // No triplets — check for regular pairs only
    const pairs = Object.entries(counts).filter(([, c]) => c >= 2);
    if (pairs.length > 0) {
      const lines = pairs.map(([key]) => TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(key)] + ' (2×)');
      results.push({
        type: 'valid',
        message: 'Gültige Beförderung: ' + lines.join('  +  '),
      });
    }
  }

  if (results.length === 0) {
    return [{
      type: 'invalid',
      message: 'Keine gültige Kombination – in der Warteschlange bleiben oder Joker einsetzen.',
    }];
  }

  return results;
}

/**
 * Structured counterpart of analyzeTransportSymbols() for app v2: which rides a roll allows.
 * Rules (specifications/spielregeln.md, "Lift- und Wandermechanik"):
 *  - two identical symbols = a ride with that transport (three or more identical include a pair);
 *  - three identical symbols can be swapped for ONE missing symbol that was rolled once,
 *    making a pair of it (listed only for symbols that do not already have a pair);
 *  - five identical symbols = free ride, any distance; six identical = free ride + JACKPOT_POINTS.
 *    Only rolled dice count here: a die turned with a Joker never completes five or six of a kind
 *    (it still counts for pairs and swaps).
 * Several pairs may be combined in one turn ("Lifte kombinieren").
 *
 * @param {string[]} syms — the 6 rolled symbols (from TRANSPORT_SYMBOLS)
 * @param {boolean[]} [jokered] — per die: turned with a Joker
 * @returns {{ freeRide: string|null, jackpot: boolean, pairs: string[], exchanges: Array<{ from: string, targets: string[] }> }}
 *   Symbols are keys of TRANSPORT_SYMBOLS, in TRANSPORT_SYMBOLS order. Nothing valid = all empty.
 */
export function transportOptions(syms, jokered = []) {
  const counts = {};
  const rolled = {};
  syms.forEach((s, i) => {
    counts[s] = (counts[s] || 0) + 1;
    if (!jokered[i]) rolled[s] = (rolled[s] || 0) + 1;
  });
  const present = TRANSPORT_SYMBOLS.filter(s => counts[s]);

  const freeRide = present.find(s => rolled[s] >= FREE_RIDE_COUNT) ?? null;
  if (freeRide) return { freeRide, jackpot: rolled[freeRide] >= JACKPOT_COUNT, pairs: [], exchanges: [] };

  const singles = present.filter(s => counts[s] === 1);
  return {
    freeRide: null,
    jackpot: false,
    pairs: present.filter(s => counts[s] >= 2),
    exchanges: singles.length === 0 ? [] : present
      .filter(s => counts[s] >= 3)
      .map(from => ({ from, targets: singles })),
  };
}

// ─── Descent movement ────────────────────────────────────────────────────────

/**
 * Returns how many crossings the player may actually pass this turn.
 * Schneesturm halves the rolled movement ("wegen eingeschränkter Sicht"), it does
 * NOT reduce points. A Joker averts the event and restores full movement.
 * Every descent die face is even, so the halved value is always a whole number.
 *
 * @param {number} descentValue  — rolled face of the descent die
 * @param {string|null} eventSym — EVENT_FACES[n].sym, or null
 * @param {boolean} jokerUsedOnEvent
 * @returns {number}
 */
export function effectiveCrossings(descentValue, eventSym, jokerUsedOnEvent) {
  if (eventSym === 'schneesturm' && !jokerUsedOnEvent) {
    return Math.floor(descentValue / 2);
  }
  return descentValue;
}

// ─── Descent point calculation ───────────────────────────────────────────────

/**
 * Calculates the total points for a descent turn.
 * Pure function — no DOM or state access.
 *
 * Schneesturm does not appear here — it reduces movement, not points (see effectiveCrossings).
 *
 * @param {Object} slopeSelection   — { blue: number, red: number, black: number, yellow: number }
 * @param {string|null} eventSym    — EVENT_FACES[n].sym, or null
 * @param {boolean|null} ohneBefugnisResult — null=not rolled, true=happy smiley, false=sad smiley
 * @param {string[]} allowedSlopes  — colours the player may use (e.g. ['blue','red'] for Anfänger)
 * @returns {{ total: number, basePoints: number, parts: string[], bonusText: string }}
 */
export function calcDescentPoints(slopeSelection, eventSym, ohneBefugnisResult, allowedSlopes = ['blue', 'red', 'black', 'yellow']) {
  let allowedBase = 0;
  let forbiddenBase = 0;
  const parts = [];

  ['blue', 'red', 'black', 'yellow'].forEach(c => {
    const k = slopeSelection[c] || 0;
    if (k > 0) {
      const pts = k * SLOPE_PTS[c];
      const label = { blue: 'Blau', red: 'Rot', black: 'Schwarz', yellow: 'Gelb' }[c];
      parts.push(`${label} ×${k} = ${pts}`);
      if (!allowedSlopes.includes(c)) {
        forbiddenBase += pts;
      } else {
        allowedBase += pts;
      }
    }
  });

  const basePoints = allowedBase + forbiddenBase;
  let total;
  let bonusText = '';

  if (ohneBefugnisResult === false) {
    let allowedTotal = allowedBase;
    // Pulverschnee bonus only when the player has at least one legitimate slope:
    // skiing only on forbidden pistes with a sad-smiley penalty earns no powder bonus.
    if (eventSym === 'pulverschnee' && allowedBase > 0) {
      allowedTotal += PULVERSCHNEE_BONUS;
      bonusText = ` (+${PULVERSCHNEE_BONUS} Pulverschnee)`;
    }
    total = allowedTotal - forbiddenBase;
    bonusText += ' (Ohne Befugnis: negativ)';
  } else {
    total = basePoints;
    if (eventSym === 'pulverschnee' && basePoints > 0) {
      total += PULVERSCHNEE_BONUS;
      bonusText = ` (+${PULVERSCHNEE_BONUS} Pulverschnee)`;
    }
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

// ─── Abschlusswertung (end-game scoring) ─────────────────────────────────────

/**
 * Calculates the end-game score adjustment for one player.
 * Penalties apply only if the player did not reach their Talstation.
 * Each remaining coin/joker gives +5 points regardless.
 *
 * @param {boolean} talstationReached
 * @param {{blue:number,red:number,black:number,yellow:number}} slopeSelection  crossings per colour
 * @param {number} transportCount   number of additional transports taken to return
 * @param {number} extraTalstationen  number of additional Talstationen used
 * @param {number} totalCoins  p.joker + p.gratis — each gives +5 pts
 * @returns {{
 *   penaltyItems: {label:string, amount:number}[],
 *   penaltyTotal: number,
 *   coinBonus: number,
 *   netDelta: number
 * }}
 */
export function calcAbschlusswertungResult(
  talstationReached,
  slopeSelection,
  transportCount,
  extraTalstationen,
  totalCoins
) {
  const penaltyItems = [];

  if (!talstationReached) {
    penaltyItems.push({ label: 'Talstation nicht erreicht', amount: SCHLUSS.talstationMissed });

    ['blue', 'red', 'black', 'yellow'].forEach(c => {
      const k = (slopeSelection && slopeSelection[c]) || 0;
      if (k > 0) {
        const halfPts = Math.floor(k * SLOPE_PTS[c] / 2);
        penaltyItems.push({ label: `${SLOPE_PISTE_LABELS[c]} ×${k}`, amount: -halfPts });
      }
    });

    for (let i = 0; i < transportCount; i++) {
      penaltyItems.push({ label: 'Beförderung zurück', amount: SCHLUSS.returnRide });
    }

    for (let i = 0; i < extraTalstationen; i++) {
      penaltyItems.push({ label: 'Zusätzliche Talstation', amount: SCHLUSS.extraTalstation });
    }
  }

  const penaltyTotal = penaltyItems.reduce((sum, item) => sum + item.amount, 0);
  const coinBonus    = totalCoins * SCHLUSS.coinBonus;
  const netDelta     = penaltyTotal + coinBonus;

  return { penaltyItems, penaltyTotal, coinBonus, netDelta };
}
