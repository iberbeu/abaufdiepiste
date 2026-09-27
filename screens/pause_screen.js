// PAUSE — flow_spec.md §5. Restaurant (+15) or Bar (+7): tap selects (the other dims),
// the primary button confirms → points, pauseDone, turn end. Back is possible until confirmed.
// The pause is the player's whole turn (spielregeln.md: "setzt einen Spielzug aus").

import { PAUSE_POINTS } from '../game_logic.js';
import { pauseStatus, takePause } from '../flow_logic.js';
import { store, saveGame } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { activeTurn } from '../turn_state.js';

const KINDS = ['restaurant', 'bar'];

registerScreen('pause', {
  chrome: true,
  mount(el) {
    const game = store.game;
    if (!game) return go('home');
    const t = activeTurn(game);
    if (t?.rolled) return go(t.resume);
    if (pauseStatus(game) !== 'open') return go('turn_start');

    const ref = name => el.querySelector(`[data-ref="${name}"]`);
    const primary = ref('primary');
    let choice = null;

    function render() {
      KINDS.forEach(kind => {
        const tile = ref(kind);
        tile.classList.toggle('is-selected', choice === kind);
        tile.classList.toggle('is-dimmed', choice !== null && choice !== kind);
        tile.setAttribute('aria-pressed', String(choice === kind));
      });
      primary.disabled = choice === null;
      primary.textContent = choice ? `+${PAUSE_POINTS[choice]} →` : 'Restaurant oder Bar?';
    }

    KINDS.forEach(kind => {
      ref(`${kind}Pts`).textContent = `+${PAUSE_POINTS[kind]}`;
      ref(kind).addEventListener('click', () => { choice = kind; render(); });
    });
    ref('back').addEventListener('click', () => go('turn_start', {}, { back: true }));
    primary.addEventListener('click', () => {
      if (!choice) return;
      const points = takePause(game, choice);
      saveGame();
      go('turn_end', { points });
    }, { once: true });   // disabled until a choice is made, so the one click is the confirm

    render();
  },
});
