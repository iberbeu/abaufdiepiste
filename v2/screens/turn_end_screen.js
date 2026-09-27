// TURN END — flow_spec.md §5. Short "✓ +X" moment: the points fly into the player's score chip,
// a level-up is celebrated (tap to continue), then the next step of the game:
// game end, pending round-event cards, or the next player's turn start.
// params: { points?: number } — points the player just earned (already booked)

import { advanceTurn, dueRoundEvents, currentPlayer, levelUp } from '../flow_logic.js';
import { store, saveGame } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { clearTurn } from '../turn_state.js';
import { renderChrome, currentChip } from '../v2_chrome.js';
import { celebrateLevelUp } from '../v2_fx.js';
import { reducedMotion } from '../v2_dice.js';

const FLY_AT_MS = 400;   // the burst has popped in
const FLY_MS = 300;      // …and flies into the score chip
const PAUSE_MS = 800;

registerScreen('turn_end', {
  chrome: true,
  quickActions: false,   // the current player changes here
  mount(el, { points = 0 } = {}) {
    clearTurn();
    const game = store.game;
    const player = currentPlayer(game);
    const newLevel = levelUp(player.points - points, player.points);
    const burst = el.querySelector('[data-ref="burst"]');
    const timers = [];
    let left = false;

    if (points === 0) {
      burst.hidden = true;
      el.querySelector('[data-ref="check"]').hidden = false;
    } else {
      burst.textContent = points > 0 ? `+${points}` : `−${Math.abs(points)}`;
      burst.classList.toggle('points-burst--negative', points < 0);
      renderChrome({ pending: points });   // the chip shows the new total when the points land
      timers.push(setTimeout(() => flyInto(burst, currentChip()), FLY_AT_MS));
      timers.push(setTimeout(() => renderChrome({ bump: true }), FLY_AT_MS + FLY_MS));
    }

    timers.push(setTimeout(() => {
      if (newLevel) celebrateLevelUp(player, newLevel, next);
      else next();
    }, PAUSE_MS));

    function next() {
      if (left) return;   // the card also closes when the screen is left
      const { gameOver } = advanceTurn(game);
      saveGame();
      // Unlike v1, round events are skipped on game over: with ≥ MIN_ROUNDS (11) rounds all of them
      // have already fired earlier. Revisit if MIN_ROUNDS drops or a late event is added.
      if (gameOver) return go('game_end');
      const events = dueRoundEvents(game);
      if (events.length) return go('round_event', { queue: events });
      go('turn_start');
    }

    return () => {
      left = true;
      timers.forEach(clearTimeout);
    };
  },
});

/** Moves the burst onto the chip, shrinking and fading (Web Animations — no inline style attribute). */
function flyInto(burst, chip) {
  if (!chip || reducedMotion() || typeof burst.animate !== 'function') return;
  const from = burst.getBoundingClientRect();
  const to = chip.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  burst.animate(
    [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.3 }],
    { duration: FLY_MS, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'forwards' },
  );
}
