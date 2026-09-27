// ═══════════════════════════════════════════════════════════════
// App v2 — celebrations (UI-12.11): confetti and the level-up card (FEAT-17).
// Confetti goes into #fxHost, above the sheets, and never takes a tap.
// With reduced motion there is no confetti; the level-up card still shows.
// ═══════════════════════════════════════════════════════════════

import { levelLabel, levelStars } from '../game_logic.js';
import { openSheet } from './v2_sheet.js';
import { reducedMotion } from './v2_dice.js';

/**
 * Lets confetti rain over the whole screen once.
 * @returns {() => void} remove — takes the confetti away (call it in the screen cleanup)
 */
export function confetti() {
  if (reducedMotion()) return () => {};
  const el = document.getElementById('tpl-confetti').content.firstElementChild.cloneNode(true);
  document.getElementById('fxHost').append(el);
  return () => el.remove();
}

/**
 * Shows the level-up card: the level's stars (the new one pops in), the player's name
 * and new level, with confetti. Tap "Weiter", the scrim or Escape to close.
 * @param {{ name: string }} player
 * @param {'fortgeschritten'|'profi'} level — from levelUp() in flow_logic.js
 * @param {() => void} [onDone] — runs once the card is closed
 */
export function celebrateLevelUp(player, level, onDone) {
  const body = document.getElementById('tpl-level-up').content.firstElementChild.cloneNode(true);
  const chars = Array.from(levelStars(level));
  const earned = chars.filter(c => c === '★').length;
  body.setAttribute('aria-label', `Fahrniveau: ${levelLabel(level)}`);   // like the stars on turn start
  body.append(...chars.map((c, i) => {
    const star = document.createElement('span');
    star.className = 'level-up__star';
    star.textContent = c;
    star.classList.toggle('is-new', i === earned - 1);
    return star;
  }));

  const removeConfetti = confetti();
  openSheet({
    variant: 'celebrate',
    title: `${player.name} steigt auf!`,
    text: `Neues Fahrniveau: ${levelLabel(level)}`,
    body,
    actions: [{ label: 'Weiter' }],
    onClose: () => {
      removeConfetti();
      onDone?.();
    },
  });
}
