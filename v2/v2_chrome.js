// ═══════════════════════════════════════════════════════════════
// App v2 — top bar + score strip ("chrome"), shared by all in-game screens.
// The quick-action sheets (📷 🎟 🃏) follow in UI-12.5.
// ═══════════════════════════════════════════════════════════════

import { currentTime } from './flow_logic.js';
import { store } from './v2_store.js';
import { go } from './v2_router.js';

const $ = id => document.getElementById(id);

export function initChrome() {
  $('btnMenu').addEventListener('click', () => go('menu'));
}

export function showChrome(visible) {
  $('topbar').hidden = !visible;
  $('scoreStrip').hidden = !visible;
  $('topbar').parentElement.classList.toggle('app--no-chrome', !visible);
}

/** Re-renders time, coin badges and the score strip from store.game. */
export function renderChrome() {
  const game = store.game;
  if (!game) return;
  const p = game.players[game.currentPlayerIndex];

  $('topbarTime').textContent = currentTime(game);
  setBadge('btnGratis', 'gratisCount', p.gratis);
  setBadge('btnJoker', 'jokerCount', p.joker);

  const tpl = $('tpl-score-chip');
  const chips = game.players.map((player, i) => {
    const chip = tpl.content.firstElementChild.cloneNode(true);
    chip.classList.add(`player-${player.colorIndex}`);
    chip.classList.toggle('is-current', i === game.currentPlayerIndex);
    chip.querySelector('.avatar').textContent = initial(player.name);
    chip.querySelector('.score-chip__points').textContent = player.points;
    chip.setAttribute('aria-label', `${player.name}: ${player.points} Punkte`);
    return chip;
  });
  $('scoreStrip').replaceChildren(...chips);
}

function setBadge(btnId, badgeId, count) {
  $(btnId).classList.toggle('is-empty', count === 0);
  const badge = $(badgeId);
  badge.textContent = count;
  badge.hidden = count === 0;
}

/** First letter of a name, upper case; handles emoji/surrogate pairs. */
export function initial(name) {
  return (Array.from(name.trim())[0] ?? '?').toUpperCase();
}
