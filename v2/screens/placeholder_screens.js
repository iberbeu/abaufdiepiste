// ═══════════════════════════════════════════════════════════════
// PLACEHOLDERS — every screen of flow_spec.md that is not built yet.
// Each one shows its id, the backlog task that will build it, and buttons
// that follow the real flow, so the whole app can be clicked through.
// Remove an entry here when its real screen module is added.
// ═══════════════════════════════════════════════════════════════

import { store } from '../v2_store.js';
import { registerScreen, go, back } from '../v2_router.js';

const PLACEHOLDERS = {

  game_end:         { chrome: false, title: 'Skitag vorbei!',    task: 'UI-12.13', links: [['Schlusswertung starten', 'schlusswertung']] },
  schlusswertung:   { chrome: false, title: 'Schlusswertung',    task: 'UI-12.13', links: [['Weiter', 'ranking']] },
  ranking:          { chrome: false, title: 'Rangliste',         task: 'UI-12.13', links: [['Neues Spiel', () => go('setup_players', { fresh: true })], ['Zum Start', 'home']] },

  punkteblock:      { chrome: false, title: 'Punkteblock',       task: 'UI-12.14', links: [['Zum Start', 'home']] },
  menu:             { chrome: false, title: 'Menü',              task: 'UI-12.12', links: [['Zurück', back], ['Zum Start', 'home']] },
  menu_scores:      { chrome: false, title: 'Punkte',            task: 'UI-12.12', links: [['Zurück', back]] },
};

Object.entries(PLACEHOLDERS).forEach(([id, def]) => {
  registerScreen(id, {
    chrome: def.chrome,
    template: 'placeholder',
    mount(el) {
      if (def.chrome && !store.game) return go('home');
      el.querySelector('[data-ref="id"]').textContent = id;
      el.querySelector('[data-ref="title"]').textContent = def.title;
      el.querySelector('[data-ref="task"]').textContent = `Wird gebaut in ${def.task}`;
      const tpl = document.getElementById('tpl-placeholder-link');
      el.querySelector('[data-ref="links"]').replaceChildren(...def.links.map(([label, target]) => {
        const btn = tpl.content.firstElementChild.cloneNode(true);
        btn.textContent = label;
        btn.addEventListener('click', typeof target === 'function' ? () => target() : () => go(target));
        return btn;
      }));
    },
  });
});
