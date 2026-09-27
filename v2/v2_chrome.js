// ═══════════════════════════════════════════════════════════════
// App v2 — top bar + score strip ("chrome"), shared by all in-game screens.
// Quick actions (flow_spec.md §2): 📷 Sehenswürdigkeit, 🎟 Gratis Fahrt, 🃏 Joker —
// each opens a sheet and acts on the current player. Tapping the score strip opens the scores.
// ═══════════════════════════════════════════════════════════════

import { sightseeingBonus } from '../game_logic.js';
import { currentTime, currentPlayer, addSighting, removeLastSighting, spendCoin } from './flow_logic.js';
import { store, saveGame } from './v2_store.js';
import { go } from './v2_router.js';
import { openSheet } from './v2_sheet.js';

const $ = id => document.getElementById(id);

let quickActionsOn = true;

export function initChrome() {
  $('btnMenu').addEventListener('click', () => go('menu'));
  $('scoreStrip').addEventListener('click', () => go('menu_scores'));
  $('btnSight').addEventListener('click', () => quickAction(openSightSheet));
  $('btnGratis').addEventListener('click', () => quickAction(openGratisSheet));
  $('btnJoker').addEventListener('click', () => quickAction(openJokerSheet));
}

/**
 * @param {boolean} visible
 * @param {boolean} [quickActions] — false on screens between turns (turn end, round events):
 *   the current player is about to change there, so 📷 🎟 🃏 stay visible but do nothing.
 */
export function showChrome(visible, quickActions = true) {
  $('topbar').hidden = !visible;
  $('scoreStrip').hidden = !visible;
  $('topbar').parentElement.classList.toggle('app--no-chrome', !visible);
  quickActionsOn = quickActions;
  $('quickActions').inert = !quickActions;
}

/**
 * Re-renders time, coin badges and the score strip from store.game.
 * @param {{ bump?: boolean }} [opts] — bump: the current player's chip pops (points changed)
 */
export function renderChrome({ bump = false } = {}) {
  const game = store.game;
  if (!game) return;
  const p = currentPlayer(game);

  $('topbarTime').textContent = currentTime(game);
  setBadge('btnGratis', 'gratisCount', p.gratis);
  setBadge('btnJoker', 'jokerCount', p.joker);

  const tpl = $('tpl-score-chip');
  const chips = game.players.map((player, i) => {
    const chip = tpl.content.firstElementChild.cloneNode(true);
    const isCurrent = i === game.currentPlayerIndex;
    chip.classList.add(`player-${player.colorIndex}`);
    chip.classList.toggle('is-current', isCurrent);
    chip.classList.toggle('is-bumped', isCurrent && bump);
    chip.querySelector('.avatar').textContent = initial(player.name);
    chip.querySelector('.score-chip__points').textContent = formatPoints(player.points);
    chip.setAttribute('aria-label', `${player.name}: ${formatPoints(player.points)} Punkte`);
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

/** A point total for display: a real minus sign (−) like everywhere else in the app, not a hyphen. */
export function formatPoints(n) {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

/** A change in points: +5, −3, ±0 (real minus sign). */
export function formatDelta(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0';
}

/** First letter of a name, upper case; handles emoji/surrogate pairs. */
export function initial(name) {
  return (Array.from(name.trim())[0] ?? '?').toUpperCase();
}

// ── Quick actions ──

function quickAction(open) {
  if (quickActionsOn && store.game && !store.game.finished) open(currentPlayer(store.game));
}

/** Saves the game and refreshes the chrome after a quick action changed it. */
function commit(bump) {
  saveGame();
  renderChrome({ bump });
}

function openSightSheet(p) {
  const next = p.sightings + 1;
  const actions = [
    { label: 'Eintragen', onClick: () => { addSighting(store.game); commit(true); } },
  ];
  if (p.sightings > 0) {
    actions.push({
      label: `Letzte entfernen (−${sightseeingBonus(p.sightings - 1)})`,
      kind: 'text',
      onClick: () => { removeLastSighting(store.game); commit(true); },
    });
  }
  actions.push({ label: 'Abbrechen', kind: 'text' });
  openSheet({ title: `${next}. Sehenswürdigkeit · +${sightseeingBonus(p.sightings)}`, actions });
}

function openGratisSheet(p) {
  if (p.gratis === 0) return;
  openSheet({
    title: 'Gratis Fahrt einsetzen?',
    text: `Noch ${p.gratis} übrig.`,
    actions: [
      { label: 'Einsetzen', onClick: () => { spendCoin(store.game, 'gratis'); commit(false); } },
      { label: 'Abbrechen', kind: 'text' },
    ],
  });
}

function openJokerSheet(p) {
  if (p.joker === 0) return;
  openSheet({
    title: 'Joker einsetzen?',
    // In-app dice uses get their own Joker badge on the die (flow_spec §5) — this sheet is
    // for everything else, so point that out to avoid spending a Joker twice.
    text: `Noch ${p.joker} übrig. Beim Würfeln erscheint der Joker direkt am Würfel.`,
    actions: [
      { label: 'Einsetzen', onClick: () => { spendCoin(store.game, 'joker'); commit(false); } },
      { label: 'Abbrechen', kind: 'text' },
    ],
  });
}
