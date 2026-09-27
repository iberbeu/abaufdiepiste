// PUNKTEBLOCK MODE — flow_spec.md §7, FEAT-24. A virtual copy of the printed score pad for
// groups who roll the physical dice: columns = players, rows = 08:00–17:30, lunch rows teal,
// the last rounds orange, totals pinned at the top, Schlusswertung + Endstand at the bottom.
// Tap a cell → sheet with quick chips, a number field and ±. Independent of the app game.

import {
  SLOPE_PTS, SLOPE_PISTE_LABELS, PULVERSCHNEE_BONUS, PAUSE_POINTS, EXTRA_ACTIVITY_POINTS, SCHLUSS, levelStars, levelLabel,
} from '../../game_logic.js';
import {
  padRows, runningTotal, finalTotal, padLevel, padSightings, nextSightingPoints, cellSightings, setCell, setFinal,
} from '../punkteblock_logic.js';
import { store, savePad } from '../v2_store.js';
import { registerScreen, go } from '../v2_router.js';
import { openSheet } from '../v2_sheet.js';
import { initial, formatPoints, formatDelta } from '../v2_chrome.js';

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
    const labelledRow = (label, cls) => {
      const tr = clone('tpl-pad-row');
      tr.querySelector('[data-ref="label"]').textContent = label;
      if (cls) tr.classList.add(cls);
      return tr;
    };

    const totalCells = valueCells(ref('totals'));
    const starsRow = labelledRow('Niveau', 'pad__meta');
    const starCells = valueCells(starsRow, 'pad__stars');
    // Derived from the time cells (each remembers its Sehenswürdigkeiten) — nothing to edit here.
    const sightRow = labelledRow('Sehensw.', 'pad__meta');
    const sightCells = valueCells(sightRow);

    const timeRows = padRows().map(row => {
      const tr = labelledRow(row.time);
      tr.classList.toggle('is-lunch', row.lunch);
      tr.classList.toggle('is-valley', row.valley);
      const buttons = pad.players.map((p, i) => {
        const td = clone('tpl-pad-cell');
        const btn = td.querySelector('[data-ref="btn"]');
        btn.addEventListener('click', () => openEntry({ kind: 'round', round: row.round, time: row.time }, i));
        tr.append(td);
        return btn;
      });
      return { row, buttons, tr };
    });
    ref('body').replaceChildren(starsRow, sightRow, ...timeRows.map(t => t.tr));

    const finalButtons = pad.players.map((p, i) => {
      const td = clone('tpl-pad-cell');
      const btn = td.querySelector('[data-ref="btn"]');
      btn.addEventListener('click', () => openEntry({ kind: 'final' }, i));
      ref('finalRow').append(td);
      return btn;
    });
    const endCells = valueCells(ref('endRow'));

    function render() {
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
          buttons[i].textContent = v === null ? '' : formatPoints(v);
          buttons[i].setAttribute('aria-label', `${p.name}, ${row.time}: ${v === null ? 'leer' : `${formatPoints(v)} Punkte`}`);
        });
        const f = pad.final[i];
        finalButtons[i].textContent = f === null ? '' : formatDelta(f);
        finalButtons[i].setAttribute('aria-label', `${p.name}, Schlusswertung: ${f === null ? 'leer' : formatDelta(f)}`);
        endCells[i].textContent = formatPoints(finalTotal(pad, i));
      });
    }

    function commit() {
      savePad();
      render();
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
      input.value = current ?? '';

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
          ...Object.values(SLOPE_PTS).map(pts => ({ label: `+${pts}`, onClick: () => add(pts) })),
          { sighting: true, onClick: chip => {
            add(nextSightingPoints(pad, i, target.round, sightingsInCell));
            sightingsInCell++;
            chip.textContent = sightingLabel();
          } },
          { label: `Restaurant +${PAUSE_POINTS.restaurant}`, onClick: () => add(PAUSE_POINTS.restaurant) },
          { label: `Bar +${PAUSE_POINTS.bar}`, onClick: () => add(PAUSE_POINTS.bar) },
          { label: `Extra +${EXTRA_ACTIVITY_POINTS}`, onClick: () => add(EXTRA_ACTIVITY_POINTS) },
          { label: `Pulverschnee +${PULVERSCHNEE_BONUS}`, onClick: () => add(PULVERSCHNEE_BONUS) },
        ];
      r('chips').append(...chips.map(({ label, sighting, onClick }) => {
        const chip = clone('tpl-chip');
        chip.textContent = sighting ? sightingLabel() : label;
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
            if (isFinal) setFinal(pad, i, value());
            else setCell(pad, target.round, i, value(), sightingsInCell);
            commit();
          } },
          { label: 'Abbrechen', kind: 'text' },
        ],
      });
    }

    render();
  },
});
