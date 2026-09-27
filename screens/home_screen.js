// HOME — flow_spec.md §4. Continue / new game / Punkteblock.

import { currentTime } from '../flow_logic.js';
import { store } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { startNewGame } from './setup_screens.js';
import { finishedGameScreen } from './game_end_screens.js';

registerScreen('home', {
  chrome: false,
  mount(el) {
    const game = store.game;
    const btnContinue = el.querySelector('[data-ref="continue"]');

    if (game) {
      btnContinue.hidden = false;
      const target = game.finished ? finishedGameScreen(game) : 'turn_start';
      el.querySelector('[data-ref="continueSub"]').textContent = {
        turn_start: `Runde ${game.round} · ${currentTime(game)}`,
        game_end: 'Schlusswertung',
        ranking: 'Rangliste',
      }[target];
      btnContinue.addEventListener('click', () => go(target));
    }

    el.querySelector('[data-ref="newGame"]').addEventListener('click', startNewGame);
    el.querySelector('[data-ref="punkteblock"]').addEventListener('click', () => go('punkteblock'));
  },
});
