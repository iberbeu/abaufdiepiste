// HOME — flow_spec.md §4. Continue / new game / Punkteblock.

import { currentTime } from '../flow_logic.js';
import { store } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';

registerScreen('home', {
  chrome: false,
  mount(el) {
    const game = store.game;
    const btnContinue = el.querySelector('[data-ref="continue"]');

    if (game) {
      btnContinue.hidden = false;
      el.querySelector('[data-ref="continueSub"]').textContent = game.finished
        ? 'Schlusswertung'
        : `Runde ${game.round} · ${currentTime(game)}`;
      btnContinue.addEventListener('click', () => go(game.finished ? 'game_end' : 'turn_start'));
    }

    // Discarding a running game gets a confirm sheet in UI-12.6.
    el.querySelector('[data-ref="newGame"]').addEventListener('click', () => go('setup_players'));
    el.querySelector('[data-ref="punkteblock"]').addEventListener('click', () => go('punkteblock'));
  },
});
