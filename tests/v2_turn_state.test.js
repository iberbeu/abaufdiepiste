import { describe, it, expect } from 'vitest';
import { recordJoker, jokerUsed, takeBackJoker, clearTurn } from '../v2/turn_state.js';
import { createGame } from '../v2/flow_logic.js';

const two = () => createGame([{ name: 'Anna' }, { name: 'Ben' }]);

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

  it('belong to one turn: another player, another round or clearTurn() start empty', () => {
    const g = two();
    recordJoker(g, 'board', () => {});
    g.currentPlayerIndex = 1;
    expect(jokerUsed(g, 'board')).toBe(false);
    g.currentPlayerIndex = 0;
    recordJoker(g, 'board', () => {});
    clearTurn();
    expect(jokerUsed(g, 'board')).toBe(false);
  });
});
