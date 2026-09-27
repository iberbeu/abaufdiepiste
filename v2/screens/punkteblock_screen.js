// PUNKTEBLOCK MODE — flow_spec.md §7, FEAT-24. A virtual copy of the printed score pad for
// groups who roll the physical dice: columns = players, rows = 08:00–17:30, lunch rows teal,
// the last rounds orange, totals, level stars and Sehenswürdigkeiten pinned at the top,
// Schlusswertung + Endstand at the bottom. The next cell to fill in is framed orange.
// Tap a cell → sheet with quick chips, a number field (starts at 0) and ±. Independent of the app game.
// Meldungen (lunch, ab ins Tal, last round) and level-ups show as in the app; once every
// Schlusswertung is in, the end screen shows the podium.

import {
  SLOPE_PTS, SLOPE_PISTE_LABELS, PULVERSCHNEE_BONUS, PAUSE_POINTS, EXTRA_ACTIVITY_POINTS, SCHLUSS, levelStars, levelLabel,
} from '../../game_logic.js';
import { levelUp, MAX_ROUNDS } from '../flow_logic.js';
import {
  padRows, runningTotal, finalTotal, padLevel, padSightings, nextSightingPoints, cellSightings, setCell, setFinal,
  nextCell, allFinalsDone, padRanking, padDueEvents, markPadEvents,
} from '../punkteblock_logic.js';
import { store, savePad } from '../v2_store.js';
import { registerScreen, go, previousScreen } from '../v2_router.js';
import { openSheet } from '../v2_sheet.js';
import { initial, formatPoints, formatDelta } from '../v2_chrome.js';
import { celebrateLevelUp, confetti } from '../v2_fx.js';
import { EVENTS, eventTitle } from './round_event_screen.js';
import { fillRanking } from './game_end_screens.js';

// Same wording as the app's Schlusswertung (calcAbschlusswertungResult); values from game_logic.js.
const SCHLUSS_CHIPS = [
  ['Talstation nicht erreicht', SCHLUSS.talstationMissed],
  ['Beförderung zurück', SCHLUSS.returnRide],
  ['Zusätzliche Talstation', SCHLUSS.extraTalstation],
  ...Object.entries(SLOPE_PTS).map(([c, pts]) => [SLOPE_PISTE_LABELS[c], -pts / 2]),
  ['Münze übrig', SCHLUSS.coinBonus],
];

const clone = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
const refIn = el => name => el.querySelector(`[data-ref="${name}"]`);
const startPadSetup = () => go('setup_players', { fresh: true, mode: 'punkteblock' });

registerScreen('punkteblock', {
  chrome: false,
  mount(el) {
    const pad = store.pad;
    if (!pad) return startPadSetup();
    const ref = refIn(el);
    const n = pad.players.length;
    let left = false;

    ref('home').addEventListener('click', () => go('home', {}, { back: true }));
    ref('newPad').addEventListener('click', () => openSheet({
      title: 'Neuen Punkteblock anfangen?',
      text: 'Der jetzige wird ersetzt, sobald der neue startet.',
      actions: [
        { label: 'Neuer Block', onClick: startPadSetup },
        { label: 'Abbrechen', kind: 'text' },
      ],
    }));

    // Header: one column per player
    ref('names').append(...pad.players.map(p => {
      const th = clone('tpl-pad-player');
      const r = refIn(th);
      th.classList.add(`player-${p.colorIndex}`);
      r('avatar').textContent = initial(p.name);
      r('name').textContent = p.name;
      r('talstation').textContent = p.talstation;
      return th;
    }));

    const valueCells = (tr, cls) => Array.from({ length: n }, () => {
      const td = clone('tpl-pad-value');
      if (cls) td.classList.add(cls);
      tr.append(td);
      return td;
    });
    const labelledRow = (label, ...cls) => {
      const tr = clone('tpl-pad-row');
      tr.querySelector('[data-ref="label"]').textContent = label;
      tr.classList.add(...cls);
      return tr;
    };
    const cellButton = (tr, onClick) => {
      const td = clone('tpl-pad-cell');
      const btn = td.querySelector('[data-ref="btn"]');
      btn.addEventListener('click', onClick);
      tr.append(td);
      return btn;
    };

    const totalCells = valueCells(ref('totals'));
    // Level and Sehenswürdigkeiten sit in the head, so they stay in view while scrolling.
    const starsRow = labelledRow('Niveau', 'pad__meta', 'pad__meta--stars');
    const starCells = valueCells(starsRow, 'pad__stars');
    // Derived from the time cells (each remembers its Sehenswürdigkeiten) — nothing to edit here.
    const sightRow = labelledRow('Sehensw.', 'pad__meta', 'pad__meta--sights');
    const sightCells = valueCells(sightRow);
    ref('head').append(starsRow, sightRow);

    const timeRows = padRows().map(row => {
      const tr = labelledRow(row.time);
      tr.classList.toggle('is-lunch', row.lunch);
      tr.classList.toggle('is-valley', row.valley);
      const buttons = pad.players.map((p, i) => cellButton(tr, () => openEntry({ kind: 'round', round: row.round, time: row.time }, i)));
      return { row, buttons, tr };
    });
    ref('body').replaceChildren(...timeRows.map(t => t.tr));

    const finalButtons = pad.players.map((p, i) => cellButton(ref('finalRow'), () => openEntry({ kind: 'final' }, i)));
    const endCells = valueCells(ref('endRow'));

    const buttonOf = cell => (cell.kind === 'final' ? finalButtons : timeRows[cell.round - 1].buttons)[cell.playerIdx];

    function render() {
      const next = nextCell(pad);
      const nextBtn = next && buttonOf(next);
      pad.players.forEach((p, i) => {
        totalCells[i].textContent = formatPoints(runningTotal(pad, i));
        const level = padLevel(pad, i);
        starCells[i].textContent = levelStars(level);
        starCells[i].setAttribute('aria-label', levelLabel(level));
        const sights = padSightings(pad, i);
        sightCells[i].textContent = sights;
        sightCells[i].setAttribute('aria-label', `Sehenswürdigkeiten ${p.name}: ${sights}`);
        timeRows.forEach(({ row, buttons }) => {
          const v = pad.cells[row.round - 1][i];
          fillCell(buttons[i], v === null ? '' : formatPoints(v), `${p.name}, ${row.time}: ${v === null ? 'leer' : `${formatPoints(v)} Punkte`}`);
        });
        const f = pad.final[i];
        fillCell(finalButtons[i], f === null ? '' : formatDelta(f), `${p.name}, Schlusswertung: ${f === null ? 'leer' : formatDelta(f)}`);
        endCells[i].textContent = formatPoints(finalTotal(pad, i));
      });
      [...timeRows.flatMap(t => t.buttons), ...finalButtons].forEach(btn => {
        const isNext = btn === nextBtn;
        btn.classList.toggle('is-next', isNext);
        btn.querySelector('[data-ref="next"]').hidden = !isNext;
        if (isNext) btn.setAttribute('aria-label', `${btn.getAttribute('aria-label')} – als Nächstes`);
      });
      return nextBtn;
    }

    function fillCell(btn, text, label) {
      btn.querySelector('[data-ref="value"]').textContent = text;
      btn.setAttribute('aria-label', label);
    }

    /**
     * After an entry: level-up card, then the Meldungen that are now due, then (once every
     * Schlusswertung is in) the end screen with the podium — one after the other.
     */
    function afterEntry({ player, levelBefore, finalEntered }) {
      const steps = [];
      const level = levelBefore && levelUp(levelBefore.points, runningTotal(pad, levelBefore.i));
      if (level) steps.push(done => celebrateLevelUp(player, level, done));
      const events = padDueEvents(pad);
      events.forEach(id => steps.push(done => showEvent(id, done)));
      if (events.length) {
        markPadEvents(pad, events);
        savePad();
      }
      if (finalEntered && allFinalsDone(pad)) steps.push(() => go('punkteblock_end'));
      const run = () => { if (!left && steps.length) steps.shift()(run); };
      run();
    }

    function showEvent(id, done) {
      const next = nextCell(pad);
      const icon = clone('tpl-pad-event');
      icon.classList.add(`icon--${EVENTS[id].icon}`);
      openSheet({
        variant: 'celebrate',
        title: eventTitle(id, MAX_ROUNDS - next.round + 1),
        text: EVENTS[id].text,
        body: icon,
        actions: [{ label: 'OK' }],
        onClose: done,
      });
    }

    /** Entry sheet for a time cell or the Schlusswertung cell. */
    function openEntry(target, i) {
      const p = pad.players[i];
      const isFinal = target.kind === 'final';
      const current = isFinal ? pad.final[i] : pad.cells[target.round - 1][i];
      const body = clone('tpl-pad-entry');
      const r = refIn(body);
      const input = r('input');
      // A re-opened cell starts with the Sehenswürdigkeiten it already holds.
      let sightingsInCell = isFinal ? 0 : cellSightings(pad, target.round, i);
      let sightingChip = null;
      // An empty cell starts at 0: many rounds bring no points, and 0 is a real entry.
      input.value = current ?? 0;
      input.addEventListener('focus', () => input.select());

      /** The typed number, or null for an empty field (empty = no entry; 0 is a real entry). */
      const value = () => {
        const v = parseInt(input.value, 10);
        return Number.isFinite(v) ? v : null;
      };
      const add = pts => { input.value = (value() ?? 0) + pts; };
      const sightingLabel = () => `Sehensw. +${nextSightingPoints(pad, i, target.round, sightingsInCell)}`;

      const chips = isFinal
        ? SCHLUSS_CHIPS.map(([label, pts]) => ({ label: `${label} ${formatDelta(pts)}`, onClick: () => add(pts) }))
        : [
          ...Object.entries(SLOPE_PTS).map(([color, pts]) => ({ label: `+${pts}`, cls: `chip--${color}`, onClick: () => add(pts) })),
          { label: `Extra +${EXTRA_ACTIVITY_POINTS}`, cls: 'chip--extra', onClick: () => add(EXTRA_ACTIVITY_POINTS) },
          { sighting: true, onClick: chip => {
            add(nextSightingPoints(pad, i, target.round, sightingsInCell));
            sightingsInCell++;
            chip.textContent = sightingLabel();
          } },
          { label: `Restaurant +${PAUSE_POINTS.restaurant}`, onClick: () => add(PAUSE_POINTS.restaurant) },
          { label: `Bar +${PAUSE_POINTS.bar}`, onClick: () => add(PAUSE_POINTS.bar) },
          { label: `Pulverschnee +${PULVERSCHNEE_BONUS}`, onClick: () => add(PULVERSCHNEE_BONUS) },
        ];
      r('chips').append(...chips.map(({ label, cls, sighting, onClick }) => {
        const chip = clone('tpl-chip');
        chip.textContent = sighting ? sightingLabel() : label;
        if (cls) chip.classList.add(cls);
        if (sighting) sightingChip = chip;
        chip.addEventListener('click', () => onClick(chip));
        return chip;
      }));
      r('sign').addEventListener('click', () => {
        const v = value();
        if (v) input.value = -v;   // nothing to flip on an empty field or 0
      });
      r('clear').addEventListener('click', () => {
        input.value = '';
        sightingsInCell = 0;
        if (sightingChip) sightingChip.textContent = sightingLabel();
      });

      openSheet({
        title: isFinal ? `${p.name} · Schlusswertung` : `${p.name} · ${target.time}`,
        body,
        actions: [
          { label: 'Eintragen', onClick: () => {
            const levelBefore = isFinal ? null : { i, points: runningTotal(pad, i) };
            if (isFinal) setFinal(pad, i, value());
            else setCell(pad, target.round, i, value(), sightingsInCell);
            savePad();
            render();
            afterEntry({ player: p, levelBefore, finalEntered: isFinal });
          } },
          { label: 'Abbrechen', kind: 'text' },
        ],
      });
    }

    const nextBtn = render();
    // Open at the cell that comes next (a long day scrolls far down).
    nextBtn?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });

    return () => { left = true; };
  },
});

// ── End: every Schlusswertung is in → podium ──

registerScreen('punkteblock_end', {
  chrome: false,
  mount(el) {
    const pad = store.pad;
    if (!pad || !allFinalsDone(pad)) return go('punkteblock');
    const ref = refIn(el);
    fillRanking(ref, padRanking(pad), pad.players);
    ref('done').addEventListener('click', () => go('home', {}, { back: true }));
    ref('edit').addEventListener('click', () => go('punkteblock', {}, { back: true }));
    // Confetti only right after the last entry, not when coming back to this screen some other way.
    if (previousScreen()?.id === 'punkteblock') return confetti();
  },
});
