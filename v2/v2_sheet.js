// ═══════════════════════════════════════════════════════════════
// App v2 — bottom sheet for small decisions (flow_spec.md §2).
// One sheet at a time; tap on the scrim or Escape = cancel.
//
//   openSheet({ title, text?, body?, actions: [{ label, kind?, onClick? }] })
//   - body: optional element shown between text and actions (e.g. colour swatches);
//     its own buttons call closeSheet() themselves
//   - kind: 'primary' (default) | 'text' (small underlined link)
//   - the sheet closes, then onClick runs. An action without onClick just closes.
// ═══════════════════════════════════════════════════════════════

let openLayer = null;

export function openSheet({ title, text = '', body = null, actions = [] }) {
  closeSheet();
  const layer = document.getElementById('tpl-sheet').content.firstElementChild.cloneNode(true);
  layer.querySelector('[data-ref="title"]').textContent = title;
  const textEl = layer.querySelector('[data-ref="text"]');
  textEl.textContent = text;
  textEl.hidden = !text;
  if (body) layer.querySelector('[data-ref="body"]').replaceChildren(body);

  layer.querySelector('[data-ref="actions"]').replaceChildren(...actions.map(({ label, kind = 'primary', onClick }) => {
    const btn = document.getElementById(`tpl-sheet-${kind}`).content.firstElementChild.cloneNode(true);
    btn.textContent = label;
    btn.addEventListener('click', () => {
      closeSheet();
      onClick?.();
    }, { once: true });
    return btn;
  }));
  layer.querySelector('.scrim').addEventListener('click', closeSheet);

  document.getElementById('sheetHost').append(layer);
  document.querySelector('.app').inert = true;   // keyboard / screen readers stay inside the sheet
  document.addEventListener('keydown', onKey);
  openLayer = layer;
  layer.querySelector('button')?.focus();
}

export function closeSheet() {
  if (!openLayer) return;
  openLayer.remove();
  openLayer = null;
  document.querySelector('.app').inert = false;
  document.removeEventListener('keydown', onKey);
}

export function isSheetOpen() {
  return openLayer !== null;
}

function onKey(e) {
  if (e.key === 'Escape') closeSheet();
}
