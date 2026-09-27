// ═══════════════════════════════════════════════════════════════
// App v2 — bottom sheet for small decisions (flow_spec.md §2).
// One sheet at a time; tap on the scrim or Escape = cancel.
//
//   openSheet({ title, text?, body?, variant?, onClose?, actions: [{ label, kind?, onClick? }] })
//   - body: optional element shown between text and actions (e.g. colour swatches);
//     its own buttons call closeSheet() themselves
//   - kind: 'primary' (default) | 'text' (small underlined link)
//   - the sheet closes, then onClick runs. An action without onClick just closes.
//   - variant: 'celebrate' → a centred card instead of a bottom sheet (level-up)
//   - onClose: runs once whenever the sheet closes, however (action, scrim, Escape, screen change)
// ═══════════════════════════════════════════════════════════════

let openLayer = null;
let returnFocus = null;   // the element that opened the sheet — focused again on close
let onCloseHandler = null;

export function openSheet({ title, text = '', body = null, variant = null, onClose = null, actions = [] }) {
  const opener = openLayer ? returnFocus : document.activeElement;   // a sheet replacing a sheet keeps the first opener
  closeSheet();
  returnFocus = opener;
  onCloseHandler = onClose;
  const layer = document.getElementById('tpl-sheet').content.firstElementChild.cloneNode(true);
  if (variant) layer.classList.add(`sheet-layer--${variant}`);
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
  document.querySelector('.app').inert = false;   // first: an inert element cannot take focus
  // Back to where the user was — unless that element is gone (e.g. the screen changed).
  if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus();
  returnFocus = null;
  document.removeEventListener('keydown', onKey);
  const handler = onCloseHandler;
  onCloseHandler = null;   // first: the handler may open the next sheet
  handler?.();
}

export function isSheetOpen() {
  return openLayer !== null;
}

function onKey(e) {
  if (e.key === 'Escape') closeSheet();
}
