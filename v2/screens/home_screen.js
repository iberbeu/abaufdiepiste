// HOME — flow_spec.md §4. Continue / new game / Punkteblock.

import { currentTime } from '../flow_logic.js';
import { store } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { openSheet } from '../v2_sheet.js';

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

    el.querySelector('[data-ref="newGame"]').addEventListener('click', () => {
      const startSetup = () => go('setup_players', { fresh: true });
      if (!store.game) return startSetup();
      // The running game is only replaced when the new one starts (setup W4), so backing out keeps it.
      openSheet({
        title: 'Laufendes Spiel verwerfen?',
        text: 'Es wird ersetzt, sobald das neue Spiel startet.',
        actions: [
          { label: 'Neues Spiel', onClick: startSetup },
          { label: 'Abbrechen', kind: 'text' },
        ],
      });
    });
    el.querySelector('[data-ref="punkteblock"]').addEventListener('click', () => go('punkteblock'));
  },
});
