// SETUP WIZARD — flow_spec.md §4: W1 count → W2 names (colour, turn order) → W3 Talstation → W4 length.
// The wizard edits a module-level draft (not persisted). The running game is replaced only
// when "Los geht's!" is tapped, so leaving the wizard never loses it.
// Enter with go('setup_players', { fresh: true }) to start from the last group (FEAT-21).

import {
  setupDraft, assignColor, moveItem, defaultName, endTime, createGame,
  MIN_PLAYERS, MAX_PLAYERS, MAX_ROUNDS, MIN_ROUNDS,
} from '../flow_logic.js';
import { setGame, loadLastGroup, saveLastGroup } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { openSheet, closeSheet } from '../v2_sheet.js';
import { initial } from '../v2_chrome.js';

const DEFAULT_SHORT_ROUNDS = 16;   // 15:30 — preset of the "Kurz" stepper
// Screen-reader names of --player-1 … --player-6 (v2_tokens.css).
const COLOR_NAMES = ['Orange', 'Türkis', 'Violett', 'Mint', 'Pink', 'Sand'];

/** @type {ReturnType<typeof setupDraft> & { short: boolean, shortRounds: number } | null} */
let draft = null;

function ensureDraft(fresh) {
  if (draft && !fresh) return;
  draft = setupDraft(loadLastGroup());
  draft.short = draft.totalRounds < MAX_ROUNDS;
  draft.shortRounds = draft.short ? draft.totalRounds : DEFAULT_SHORT_ROUNDS;
}

const activePlayers = () => draft.players.slice(0, draft.count);
const clone = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
const ref = (el, name) => el.querySelector(`[data-ref="${name}"]`);
const goBack = id => go(id, {}, { back: true });

// ── W1: how many players ──

registerScreen('setup_players', {
  chrome: false,
  mount(el, { fresh = false } = {}) {
    ensureDraft(fresh);
    ref(el, 'back').addEventListener('click', () => goBack('home'));
    ref(el, 'numbers').replaceChildren(...Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => {
      const n = MIN_PLAYERS + i;
      const tile = clone('tpl-number-tile');
      tile.textContent = n;
      tile.setAttribute('aria-label', `${n} Personen`);
      tile.classList.toggle('is-selected', n === draft.count);
      tile.addEventListener('click', () => {
        draft.count = n;
        go('setup_names');
      });
      return tile;
    }));
  },
});

// ── W2: names, colours, turn order ──

registerScreen('setup_names', {
  chrome: false,
  mount(el) {
    ensureDraft(false);
    const list = ref(el, 'rows');
    ref(el, 'back').addEventListener('click', () => goBack('setup_players'));
    ref(el, 'next').addEventListener('click', () => go('setup_talstation'));

    function render(focusHandle = -1) {
      list.replaceChildren(...activePlayers().map((p, i) => {
        const row = clone('tpl-name-row');
        const avatar = ref(row, 'color');
        const input = ref(row, 'input');
        row.classList.add(`player-${p.colorIndex}`);
        avatar.textContent = initial(defaultName(p.name, i));
        input.value = p.name;
        input.placeholder = defaultName('', i);
        input.setAttribute('aria-label', `Name ${i + 1}. Person`);
        input.addEventListener('input', () => {
          draft.players[i].name = input.value;
          avatar.textContent = initial(defaultName(input.value, i));
        });
        input.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const next = list.children[i + 1];
          if (next) ref(next, 'input').focus(); else input.blur();
        });
        avatar.addEventListener('click', () => openColorSheet(i));
        ref(row, 'handle').addEventListener('keydown', e => {
          const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
          if (to === null || to < 0 || to >= draft.count) return;
          e.preventDefault();
          reorder(i, to);
          render(to);
        });
        return row;
      }));
      if (focusHandle >= 0) ref(list.children[focusHandle], 'handle').focus();
    }

    function openColorSheet(i) {
      const body = clone('tpl-swatches');
      const owners = activePlayers();
      body.append(...Array.from({ length: MAX_PLAYERS }, (_, c) => {
        const colorIndex = c + 1;
        const swatch = clone('tpl-swatch');
        const owner = owners.findIndex(p => p.colorIndex === colorIndex);
        swatch.classList.add(`player-${colorIndex}`);
        swatch.classList.toggle('is-selected', owner === i);
        swatch.setAttribute('aria-label', `Farbe ${COLOR_NAMES[c]}`);
        if (owner !== -1 && owner !== i) swatch.firstElementChild.textContent = initial(defaultName(owners[owner].name, owner));
        swatch.addEventListener('click', () => {
          draft.players = assignColor(draft.players, i, colorIndex);
          closeSheet();
          render();
        });
        return swatch;
      }));
      openSheet({ title: 'Farbe wählen', body, actions: [{ label: 'Abbrechen', kind: 'text' }] });
    }

    enableDragReorder(list, (from, to) => { reorder(from, to); render(); });
    render();
  },
});

function reorder(from, to) {
  const moved = moveItem(activePlayers(), from, to);
  draft.players = [...moved, ...draft.players.slice(draft.count)];
}

/**
 * Drag by the handle: the row is moved in the DOM while the finger passes a neighbour's middle,
 * so it needs no inline positioning. The pointer is captured by the list, which stays in the DOM.
 * onDrop(from, to) is called once on release if the position changed.
 */
function enableDragReorder(list, onDrop) {
  let drag = null;   // { row, from, pointerId }

  list.addEventListener('pointerdown', e => {
    const handle = e.target.closest('[data-ref="handle"]');
    if (!handle || drag) return;
    const row = handle.closest('.player-row');
    drag = { row, from: [...list.children].indexOf(row), pointerId: e.pointerId };
    list.setPointerCapture(e.pointerId);
    row.classList.add('is-dragging');
    e.preventDefault();
  });

  list.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const prev = drag.row.previousElementSibling;
    const next = drag.row.nextElementSibling;
    if (prev && e.clientY < middle(prev)) list.insertBefore(drag.row, prev);
    else if (next && e.clientY > middle(next)) list.insertBefore(drag.row, next.nextElementSibling);
  });

  const end = e => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { row, from } = drag;
    drag = null;
    row.classList.remove('is-dragging');
    const to = [...list.children].indexOf(row);
    if (to !== from) onDrop(from, to);
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}

function middle(el) {
  const r = el.getBoundingClientRect();
  return r.top + r.height / 2;
}

// ── W3: Talstation ──

registerScreen('setup_talstation', {
  chrome: false,
  mount(el) {
    ensureDraft(false);
    const list = ref(el, 'rows');
    const skip = ref(el, 'skip');
    ref(el, 'back').addEventListener('click', () => goBack('setup_names'));
    ref(el, 'next').addEventListener('click', () => go('setup_length'));
    skip.addEventListener('click', () => go('setup_length'));

    // "Überspringen" only makes sense while nothing is filled in.
    const updateSkip = () => { skip.hidden = activePlayers().some(p => p.talstation.trim()); };

    list.replaceChildren(...activePlayers().map((p, i) => {
      const row = clone('tpl-talstation-field');
      const input = ref(row, 'input');
      const name = defaultName(p.name, i);
      row.classList.add(`player-${p.colorIndex}`);
      ref(row, 'avatar').textContent = initial(name);
      ref(row, 'name').textContent = name;
      input.value = p.talstation;
      input.addEventListener('input', () => {
        draft.players[i].talstation = input.value;
        updateSkip();
      });
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const next = list.children[i + 1];
        if (next) ref(next, 'input').focus(); else input.blur();
      });
      return row;
    }));
    updateSkip();
  },
});

// ── W4: game length ──

registerScreen('setup_length', {
  chrome: false,
  mount(el) {
    ensureDraft(false);
    const full = ref(el, 'full');
    const short = ref(el, 'short');
    const shortSelect = ref(el, 'shortSelect');
    ref(el, 'back').addEventListener('click', () => goBack('setup_talstation'));
    ref(el, 'fullSub').textContent = `${MAX_ROUNDS} Runden · 08:00–${endTime(MAX_ROUNDS)}`;

    function render() {
      full.classList.toggle('is-selected', !draft.short);
      short.classList.toggle('is-selected', draft.short);
      full.setAttribute('aria-pressed', String(!draft.short));
      shortSelect.setAttribute('aria-pressed', String(draft.short));
      ref(el, 'value').textContent = draft.shortRounds;
      ref(el, 'shortSub').textContent = `${draft.shortRounds} Runden · bis ${endTime(draft.shortRounds)}`;
      ref(el, 'minus').disabled = draft.shortRounds <= MIN_ROUNDS;
      ref(el, 'plus').disabled = draft.shortRounds >= MAX_ROUNDS - 1;
    }

    const step = delta => {
      draft.short = true;
      draft.shortRounds = Math.min(MAX_ROUNDS - 1, Math.max(MIN_ROUNDS, draft.shortRounds + delta));
      render();
    };
    full.addEventListener('click', () => { draft.short = false; render(); });
    shortSelect.addEventListener('click', () => { draft.short = true; render(); });
    ref(el, 'minus').addEventListener('click', () => step(-1));
    ref(el, 'plus').addEventListener('click', () => step(1));

    ref(el, 'start').addEventListener('click', () => {
      const players = activePlayers();
      const rounds = draft.short ? draft.shortRounds : MAX_ROUNDS;
      saveLastGroup(players, rounds);
      setGame(createGame(players, rounds));
      draft = null;
      go('turn_start');
    }, { once: true });

    render();
  },
});
