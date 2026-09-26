// @vitest-environment jsdom
// Smoke test for the v2 shell: loads the real v2/index.html markup, boots v2_main.js
// and clicks through the flow (home → test game → turns → round events → game end).

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vitest runs from app/ (see vitest.config.js); jsdom replaces the global URL, so no import.meta.url here.
const html = readFileSync(resolve(process.cwd(), 'v2/index.html'), 'utf8');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');

const screen = () => document.querySelector('#outlet > .screen');
const title = () => screen().querySelector('h1')?.textContent;
const clickLabel = label => {
  const btn = [...screen().querySelectorAll('button')].find(b => b.textContent.includes(label));
  if (!btn) throw new Error(`No button "${label}" on ${title()}`);
  btn.click();
};

describe('v2 app shell', () => {
  let store;

  beforeAll(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    window.scrollTo = () => {};
    document.body.innerHTML = body;
    await import('../v2/v2_main.js');
    ({ store } = await import('../v2/v2_store.js'));
  });

  it('boots on the home screen without chrome and without "Weiterspielen"', () => {
    expect(screen().classList.contains('home')).toBe(true);
    expect(document.getElementById('topbar').hidden).toBe(true);
    expect(screen().querySelector('[data-ref="continue"]').hidden).toBe(true);
  });

  it('walks the setup placeholders into a test game with chrome', () => {
    clickLabel('Neues Spiel');
    clickLabel('Weiter');
    clickLabel('Weiter');
    clickLabel('Weiter');
    clickLabel('Testspiel starten');
    expect(title()).toBe('Zugbeginn');
    expect(document.getElementById('topbar').hidden).toBe(false);
    expect(document.getElementById('topbarTime').textContent).toBe('08:00');
    const chips = document.querySelectorAll('#scoreStrip .score-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0].classList.contains('is-current')).toBe(true);
    expect(chips[0].querySelector('.avatar').textContent).toBe('A');
    expect(JSON.parse(localStorage.getItem('abaufdiepiste_v2_game')).players).toHaveLength(2);
  });

  it('a turn ends with the burst and moves to the next player', () => {
    clickLabel('Bergab');
    clickLabel('Würfeln');
    clickLabel('+10');
    expect(screen().querySelector('.points-burst').textContent).toBe('+10');
    vi.advanceTimersByTime(800);
    expect(title()).toBe('Zugbeginn');
    expect(store.game.currentPlayerIndex).toBe(1);
    expect(document.querySelectorAll('#scoreStrip .score-chip')[1].classList.contains('is-current')).toBe(true);
  });

  it('Pause is not reachable before 11:00', () => {
    clickLabel('Pause');
    expect(title()).toBe('Zugbeginn');
  });

  it('menu goes back to the previous screen', () => {
    document.getElementById('btnMenu').click();
    expect(title()).toBe('Menü');
    expect(document.getElementById('topbar').hidden).toBe(true);
    clickLabel('Zurück');
    expect(title()).toBe('Zugbeginn');
    expect(screen().classList.contains('screen--back')).toBe(true);
  });

  it('shows the lunch card when a round starts at 11:00, once', () => {
    store.game.round = 6;               // 10:30
    store.game.currentPlayerIndex = 1;  // last player
    clickLabel('Bergauf');
    clickLabel('Würfeln');
    clickLabel('Fertig');
    vi.advanceTimersByTime(800);
    expect(title()).toBe('Mittagspause offen!');
    clickLabel('OK');
    expect(title()).toBe('Zugbeginn');
    expect(store.game.eventsShown).toEqual(['lunch_open']);
  });

  it('three-rounds card lists every Talstation', () => {
    store.game.round = 17;
    store.game.currentPlayerIndex = 1;
    store.game.eventsShown.push('lunch_close');
    clickLabel('Bergauf');
    clickLabel('Würfeln');
    clickLabel('Fertig');
    vi.advanceTimersByTime(800);
    expect(title()).toBe('Noch 3 Runden – ab ins Tal!');
    const rows = screen().querySelectorAll('.talstation-list__row');
    expect([...rows].map(r => r.textContent)).toEqual(['AnnaDorf', 'BenBahnhof']);
    clickLabel('OK');
  });

  it('the last turn of the last round leads to game end; home then offers the Schlusswertung', () => {
    store.game.round = 20;
    store.game.currentPlayerIndex = 1;
    clickLabel('Bergauf');
    clickLabel('Würfeln');
    clickLabel('Fertig');
    vi.advanceTimersByTime(800);
    expect(title()).toBe('Skitag vorbei!');
    expect(store.game.finished).toBe(true);
    clickLabel('Schlusswertung starten');
    clickLabel('Weiter');
    clickLabel('Zum Start');
    const cont = screen().querySelector('[data-ref="continue"]');
    expect(cont.hidden).toBe(false);
    expect(cont.textContent).toContain('Schlusswertung');
  });

  it('leaving turn_end early cancels its timer (no double advance)', () => {
    store.game.finished = false;
    store.game.round = 5;
    store.game.currentPlayerIndex = 0;
    screen().querySelector('[data-ref="continue"]').click();   // finished=false now → turn_start
    clickLabel('Bergauf');
    clickLabel('Würfeln');
    clickLabel('Fertig');
    document.getElementById('btnMenu').click();   // leave turn_end before the 800 ms
    vi.advanceTimersByTime(2000);
    expect(store.game.currentPlayerIndex).toBe(0);
  });

  it('a turn without points shows the check icon instead of a number', async () => {
    clickLabel('Zurück');   // menu → back to turn_end, which restarts its timer
    expect(screen().querySelector('[data-ref="check"]').hidden).toBe(false);
    expect(screen().querySelector('.points-burst').hidden).toBe(true);
    vi.advanceTimersByTime(800);
    expect(title()).toBe('Zugbeginn');
  });

  it('home has no chrome rows; in-game screens do', () => {
    const app = document.querySelector('.app');
    expect(app.classList.contains('app--no-chrome')).toBe(false);
    clickLabel('Pause');   // locked → stays
    document.getElementById('btnMenu').click();
    expect(app.classList.contains('app--no-chrome')).toBe(true);
  });

  it('an in-game screen without a game redirects to home (redirect inside mount)', async () => {
    const { go } = await import('../v2/v2_router.js');
    const { setGame } = await import('../v2/v2_store.js');
    setGame(null);
    go('turn_start');
    expect(screen().classList.contains('home')).toBe(true);
    expect(document.getElementById('topbar').hidden).toBe(true);
    expect(localStorage.getItem('abaufdiepiste_v2_game')).toBeNull();
  });

  it('registering a screen id twice throws', async () => {
    const { registerScreen } = await import('../v2/v2_router.js');
    expect(() => registerScreen('home', { chrome: false, mount() {} })).toThrow(/twice/);
  });
});
