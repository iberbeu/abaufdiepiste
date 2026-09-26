// ═══════════════════════════════════════════════════════════════
// App v2 — the one place that holds and persists the running game.
// Only the game itself is persisted. Turn-in-progress state (rolled dice,
// chosen slopes …) lives in the screen modules and is deliberately lost on
// reload, like v1's diceRolled — a reload returns to the turn start.
// ═══════════════════════════════════════════════════════════════

import { restoreGame } from './flow_logic.js';

const GAME_KEY = 'abaufdiepiste_v2_game';   // separate from v1's key — no save compatibility

export const store = {
  /** @type {object|null} see createGame() in flow_logic.js */
  game: null,
};

export function loadGame() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    store.game = raw ? restoreGame(JSON.parse(raw)) : null;
  } catch {
    store.game = null;   // corrupt JSON or storage blocked (private mode)
  }
  return store.game;
}

export function saveGame() {
  try {
    if (store.game) localStorage.setItem(GAME_KEY, JSON.stringify(store.game));
    else localStorage.removeItem(GAME_KEY);
  } catch {
    // Storage full or blocked: the game keeps running in memory.
  }
}

export function setGame(game) {
  store.game = game;
  saveGame();
}
