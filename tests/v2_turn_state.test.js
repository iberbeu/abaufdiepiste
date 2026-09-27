import { describe, it, expect, beforeEach } from 'vitest';
import {
  beginAction, activeTurn, markRolled, clearTurn, recordJoker, jokerUsed, takeBackJoker, setTurnView, turnView,
} from '../turn_state.js';
import { createGame } from '../flow_logic.js';

const two = () => createGame([{ name: 'Anna' }, { name: 'Ben' }]);

// turn_state.js is module state shared by all tests — start every test from a clean turn.
beforeEach(() => {
  clearTurn();
  setTurnView(null);
});

describe('action lock of a turn', () => {
  it('no action begun → no active turn', () => {
    expect(activeTurn(two())).toBeNull();
  });

  it('an action begun is active for the current player, unlocked until rolled', () => {
    const g = two();
    beginAction(g, 'bergauf', { held: [] });
    expect(activeTurn(g)).toMatchObject({ action: 'bergauf', rolled: false, resume: null, data: { held: [] } });
  });

  it('markRolled locks the action and names the screen the turn start resumes', () => {
    const g = two();
    beginAction(g, 'bergab');
    markRolled('bergab_d2');
    expect(activeTurn(g)).toMatchObject({ action: 'bergab', rolled: true, resume: 'bergab_d2' });
  });

  it('belongs to one turn: another player, another round or another game see none', () => {
    const g = two();
    beginAction(g, 'bergauf');
    markRolled('bergauf_b2');
    g.currentPlayerIndex = 1;
    expect(activeTurn(g)).toBeNull();
    g.currentPlayerIndex = 0;
    g.round = 2;
    expect(activeTurn(g)).toBeNull();
    g.round = 1;
    expect(activeTurn(two())).toBeNull();
    expect(activeTurn(g)).not.toBeNull();
  });

  it('a new action discards the previous one, including its lock and data', () => {
    const g = two();
    beginAction(g, 'bergauf', { dice: [1, 2] });
    markRolled('bergauf_b2');
    beginAction(g, 'pause');
    expect(activeTurn(g)).toMatchObject({ action: 'pause', rolled: false, resume: null, data: {} });
  });

  it('clearTurn ends the turn', () => {
    const g = two();
    beginAction(g, 'bergab');
    clearTurn();
    expect(activeTurn(g)).toBeNull();
  });
});

describe('Joker uses of a turn (take back)', () => {
  it('are kept per place; taking one back runs only its undo', () => {
    const g = two();
    const undone = [];
    recordJoker(g, 'die-0', () => undone.push('die-0'));
    recordJoker(g, 'die-2', () => undone.push('die-2'));
    expect(jokerUsed(g, 'die-0')).toBe(true);
    expect(takeBackJoker(g, 'die-0')).toBe(true);
    expect(undone).toEqual(['die-0']);
    expect(jokerUsed(g, 'die-0')).toBe(false);
    expect(jokerUsed(g, 'die-2')).toBe(true);
    expect(takeBackJoker(g, 'event')).toBe(false);
  });

  it('two Jokers on the same place are taken back newest first', () => {
    const g = two();
    const undone = [];
    recordJoker(g, 'board', () => undone.push(1));
    recordJoker(g, 'board', () => undone.push(2));
    takeBackJoker(g, 'board');
    expect(undone).toEqual([2]);
    expect(jokerUsed(g, 'board')).toBe(true);
    takeBackJoker(g, 'board');
    expect(undone).toEqual([2, 1]);
    expect(jokerUsed(g, 'board')).toBe(false);
  });

  it('belong to one turn: another player, another round or clearTurn() start empty', () => {
    const g = two();
    recordJoker(g, 'board', () => {});
    g.currentPlayerIndex = 1;
    expect(jokerUsed(g, 'board')).toBe(false);
    g.currentPlayerIndex = 0;
    recordJoker(g, 'board', () => {});
    expect(jokerUsed(two(), 'board')).toBe(false);
    recordJoker(g, 'board', () => {});
    g.round = 2;
    expect(jokerUsed(g, 'board')).toBe(false);
    recordJoker(g, 'board', () => {});
    clearTurn();
    expect(jokerUsed(g, 'board')).toBe(false);
  });

  it('can be spent on the board before any action began', () => {
    const g = two();
    recordJoker(g, 'board', () => {});
    expect(activeTurn(g)).toBeNull();
    expect(jokerUsed(g, 'board')).toBe(true);
  });
});

describe('turn view', () => {
  it('holds the screen that shows the turn until it is replaced or cleared', () => {
    expect(turnView()).toBeNull();
    const v = { render: () => {} };
    setTurnView(v);
    expect(turnView()).toBe(v);
    setTurnView(null);
    expect(turnView()).toBeNull();
  });
});
