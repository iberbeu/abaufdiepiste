// TURN START — flow_spec.md §5. Whose turn (avatar, name, level stars) and the three actions.
// Pause is always visible; outside the lunch window or once taken it is locked, shows why,
// and a tap only wiggles it.

import { getLevel, levelLabel, levelStars } from '../../game_logic.js';
import { currentPlayer, pauseStatus } from '../flow_logic.js';
import { store } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { initial } from '../v2_chrome.js';

const PAUSE_LOCK_REASON = { before: 'ab 11:00', after: 'vorbei', done: 'schon gemacht' };

registerScreen('turn_start', {
  chrome: true,
  mount(el) {
    const game = store.game;
    if (!game) return go('home');
    if (game.finished) return go('game_end');

    const p = currentPlayer(game);
    const level = getLevel(p.points);
    const ref = name => el.querySelector(`[data-ref="${name}"]`);

    ref('hero').classList.add(`player-${p.colorIndex}`);
    ref('avatar').textContent = initial(p.name);
    ref('name').textContent = p.name;
    ref('stars').textContent = levelStars(level);
    ref('stars').setAttribute('aria-label', `Fahrniveau: ${levelLabel(level)}`);

    ref('bergauf').addEventListener('click', () => go('bergauf_roll'));
    ref('bergab').addEventListener('click', () => go('bergab_roll'));

    const pause = ref('pause');
    const status = pauseStatus(game, p);
    const locked = status !== 'open';
    pause.classList.toggle('is-locked', locked);
    if (locked) {
      pause.setAttribute('aria-disabled', 'true');
      ref('pauseSub').hidden = false;
      ref('pauseReason').textContent = PAUSE_LOCK_REASON[status];
    }
    pause.addEventListener('click', () => {
      if (!locked) return go('pause');
      // Replay the wiggle: a CSS animation only restarts when its class is newly added.
      pause.classList.remove('is-wiggling');
      void pause.offsetWidth;
      pause.classList.add('is-wiggling');
    });
  },
});
