// ═══════════════════════════════════════════════════════════════
// App v2 — the one place that holds and persists the running game.
// Only the game itself is persisted. Turn-in-progress state (rolled dice,
// chosen slopes …) lives in the screen modules and is deliberately lost on
// reload, like v1's diceRolled — a reload returns to the turn start.
// ═══════════════════════════════════════════════════════════════

import { restoreGame, MIN_PLAYERS } from './flow_logic.js';

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

// ── Last group (FEAT-21): prefills the setup wizard ──
// Kept apart from the game, so it survives discarding or deleting a game.
// Names are stored as typed (empty = "Spieler N" placeholder), not as the game shows them.

const GROUP_KEY = 'abaufdiepiste_v2_last_group';

/** @returns {{ players: Array<{name, talstation, colorIndex}>, totalRounds: number } | null} */
export function loadLastGroup() {
  try {
    const g = JSON.parse(localStorage.getItem(GROUP_KEY));
    const ok = g && Array.isArray(g.players) && g.players.length >= MIN_PLAYERS && Number.isInteger(g.totalRounds)
      && g.players.every(p => p && typeof p.name === 'string' && typeof p.talstation === 'string' && Number.isInteger(p.colorIndex));
    return ok ? g : null;
  } catch {
    return null;
  }
}

export function saveLastGroup(players, totalRounds) {
  try {
    const clean = players.map(({ name, talstation, colorIndex }) => ({ name, talstation, colorIndex }));
    localStorage.setItem(GROUP_KEY, JSON.stringify({ players: clean, totalRounds }));
  } catch {
    // Storage blocked: the next setup simply starts empty.
  }
}
