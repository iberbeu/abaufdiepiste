// ═══════════════════════════════════════════════════════════════
// App v2 — shared dice roll animation: the dice tumble and flicker through
// random faces, then land with a small bounce (.is-landed) and the caller shows
// the real result. Skipped with reduced motion.
// ═══════════════════════════════════════════════════════════════

export const ROLL_MS = 480;
const FLICKER_MS = 80;

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * @param {HTMLElement[]} dice — the die elements that roll
 * @param {(die: HTMLElement) => void} flicker — shows a random face on one die
 * @param {() => void} onDone — called once when the roll is over
 * @returns {() => void} cancel — stops timers without calling onDone (call it in the screen cleanup)
 */
export function playRoll(dice, flicker, onDone) {
  if (reducedMotion() || dice.length === 0) {
    onDone();
    return () => {};
  }
  dice.forEach(die => {
    die.classList.remove('is-landed');
    die.classList.add('is-rolling');
  });
  const interval = setInterval(() => dice.forEach(flicker), FLICKER_MS);
  const timeout = setTimeout(() => {
    clearInterval(interval);
    dice.forEach(die => die.classList.replace('is-rolling', 'is-landed'));
    onDone();
  }, ROLL_MS);
  return () => {
    clearInterval(interval);
    clearTimeout(timeout);
  };
}
