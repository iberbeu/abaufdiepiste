// ═══════════════════════════════════════════════════════════════
// App v2 — screen router. Exactly one screen is visible at a time.
//
// A screen is registered with:
//   registerScreen(id, { chrome, template?, mount(el, params) })
//   - chrome:   true → top bar + score strip are shown
//   - template: id of the <template> to clone (default: `tpl-<id>` in index.html)
//   - mount:    fills the cloned element; may return a cleanup function
//               (called when the screen is left — clear timers there).
// ═══════════════════════════════════════════════════════════════

const screens = new Map();
let outlet = null;
let onScreenChange = null;
let current = null;    // { id, params, cleanup }
let previous = null;   // { id, params } — one level, used by back()

export function initRouter(outletEl, onChange) {
  outlet = outletEl;
  onScreenChange = onChange;
}

export function registerScreen(id, def) {
  // A real screen and a leftover placeholder with the same id would silently shadow each other.
  if (screens.has(id)) throw new Error(`Screen registered twice: ${id} — remove it from placeholder_screens.js`);
  screens.set(id, def);
}

/**
 * Shows a screen.
 * @param {string} id
 * @param {object} [params]
 * @param {{ back?: boolean }} [opts] — back: slide in from the left
 */
export function go(id, params = {}, opts = {}) {
  const def = screens.get(id);
  if (!def) throw new Error(`Unknown screen: ${id}`);

  const tpl = document.getElementById(`tpl-${def.template ?? id}`);
  if (!tpl) throw new Error(`Missing template for screen: ${id}`);
  const el = tpl.content.firstElementChild.cloneNode(true);
  if (opts.back) el.classList.add('screen--back');   // default .screen animation = forward

  if (current) {
    current.cleanup?.();
    previous = { id: current.id, params: current.params };
  }
  outlet.replaceChildren(el);
  // Keep our own reference: mount() may redirect with go(), which replaces `current`.
  const entry = { id, params, cleanup: null };
  current = entry;
  onScreenChange?.(id, def);
  window.scrollTo(0, 0);
  entry.cleanup = def.mount(el, params) ?? null;
  if (current !== entry) entry.cleanup?.();   // redirected during mount → clean up right away
}

/** Returns to the previous screen (one level). */
export function back() {
  if (previous) go(previous.id, previous.params, { back: true });
}

export function currentScreenId() {
  return current?.id ?? null;
}
