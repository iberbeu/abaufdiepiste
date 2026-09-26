// TURN END — flow_spec.md §5. Short "✓ +X" moment, then the next step of the game:
// game end, pending round-event cards, or the next player's turn start.
// params: { points?: number } — points the player just earned (for the burst).

import { advanceTurn, dueRoundEvents } from '../flow_logic.js';
import { store, saveGame } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { clearTurn } from '../turn_state.js';

const PAUSE_MS = 800;

registerScreen('turn_end', {
  chrome: true,
  quickActions: false,   // the current player changes here
  mount(el, { points = 0 } = {}) {
    clearTurn();
    const burst = el.querySelector('[data-ref="burst"]');
    if (points === 0) {
      burst.hidden = true;
      el.querySelector('[data-ref="check"]').hidden = false;
    } else {
      burst.textContent = points > 0 ? `+${points}` : `−${Math.abs(points)}`;
      burst.classList.toggle('points-burst--negative', points < 0);
    }

    const timer = setTimeout(() => {
      const game = store.game;
      const { gameOver } = advanceTurn(game);
      saveGame();
      // Unlike v1, round events are skipped on game over: with ≥ MIN_ROUNDS (11) rounds all of them
      // have already fired earlier. Revisit if MIN_ROUNDS drops or a late event is added.
      if (gameOver) return go('game_end');
      const events = dueRoundEvents(game);
      if (events.length) return go('round_event', { queue: events });
      go('turn_start');
    }, PAUSE_MS);

    return () => clearTimeout(timer);
  },
});
