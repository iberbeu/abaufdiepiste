// ROUND EVENT — flow_spec.md §5. One full-screen card per due event, OK → next card or turn start.
// params: { queue: string[] } — event ids from dueRoundEvents()

import { markEventsShown, roundsRemaining } from '../flow_logic.js';
import { store, saveGame } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';

const EVENTS = {
  lunch_open:   { icon: 'restaurant', title: 'Mittagspause offen!',  text: 'Bis 12:30 – Restaurant +15, Bar +7.' },
  lunch_close:  { icon: 'lock',       title: 'Mittagspause vorbei',  text: 'Ab jetzt sind keine Pausen mehr möglich.' },
  three_rounds: { icon: 'skier',      title: '',                     text: 'Zeit, zur Talstation zurückzufahren.' },
};

registerScreen('round_event', {
  chrome: true,
  mount(el, { queue = [] } = {}) {
    const [id, ...rest] = queue;
    const game = store.game;
    const ev = EVENTS[id];
    if (!ev) return go('turn_start');

    el.querySelector('[data-ref="icon"]').classList.add(`icon--${ev.icon}`);
    const remaining = roundsRemaining(game);
    el.querySelector('[data-ref="title"]').textContent = id === 'three_rounds'
      ? `Noch ${remaining} ${remaining === 1 ? 'Runde' : 'Runden'} – ab ins Tal!`
      : ev.title;
    el.querySelector('[data-ref="text"]').textContent = ev.text;

    if (id === 'three_rounds') {
      const list = el.querySelector('[data-ref="talstationen"]');
      const tpl = document.getElementById('tpl-talstation-row');
      list.hidden = false;
      list.replaceChildren(...game.players.map(p => {
        const row = tpl.content.firstElementChild.cloneNode(true);
        row.classList.add(`player-${p.colorIndex}`);
        row.querySelector('[data-ref="name"]').textContent = p.name;
        row.querySelector('[data-ref="talstation"]').textContent = p.talstation || '–';
        return row;
      }));
    }

    el.querySelector('[data-ref="ok"]').addEventListener('click', () => {
      markEventsShown(game, [id]);
      saveGame();
      if (rest.length) go('round_event', { queue: rest });
      else go('turn_start');
    }, { once: true });
  },
});
