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
const isTurnStart = () => screen().classList.contains('turn-start');
const ref = name => screen().querySelector(`[data-ref="${name}"]`);
const rows = () => [...screen().querySelectorAll('.player-row')];
const nameInputs = () => rows().map(r => r.querySelector('input'));
const type = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
const sheet = () => document.querySelector('#sheetHost .sheet');
const sheetButton = label => [...(sheet()?.querySelectorAll('button') ?? [])].find(b => b.textContent.startsWith(label));
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

  it('setup W1: number tiles 2–6, 2 preselected without a last group, back to home', () => {
    clickLabel('Neues Spiel');   // no game yet → no confirm sheet
    expect(sheet()).toBeNull();
    expect(title()).toBe('Wie viele spielen?');
    const tiles = screen().querySelectorAll('.number-tile');
    expect([...tiles].map(t => t.textContent)).toEqual(['2', '3', '4', '5', '6']);   // no solo game
    expect(screen().querySelector('.number-tile.is-selected').textContent).toBe('2');
    ref('back').click();
    expect(screen().classList.contains('home')).toBe(true);
  });

  it('setup W2: names with "Spieler N" placeholders, colour swap, keyboard reorder', () => {
    clickLabel('Neues Spiel');
    clickLabel('3');
    expect(title()).toBe('Wer spielt mit?');
    let inputs = nameInputs();
    expect(inputs.map(i => i.placeholder)).toEqual(['Spieler 1', 'Spieler 2', 'Spieler 3']);
    type(inputs[0], 'Clara');
    type(inputs[1], 'Anna');
    type(inputs[2], 'Ben');
    expect(rows()[0].querySelector('.avatar').textContent).toBe('C');

    // Colour: Clara (player-1) takes Anna's colour 2 → they swap.
    rows()[0].querySelector('[data-ref="color"]').click();
    expect(sheet().querySelectorAll('.swatch')).toHaveLength(6);
    sheet().querySelectorAll('.swatch')[1].click();
    expect(sheet()).toBeNull();
    expect(rows()[0].classList.contains('player-2')).toBe(true);
    expect(rows()[1].classList.contains('player-1')).toBe(true);

    // Turn order: move Clara down to the last place with the keyboard.
    rows()[0].querySelector('[data-ref="handle"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    rows()[1].querySelector('[data-ref="handle"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(nameInputs().map(i => i.value)).toEqual(['Anna', 'Ben', 'Clara']);
  });

  it('back from W2 to W1 keeps the names; a lower count drops the last one', () => {
    ref('back').click();
    expect(title()).toBe('Wie viele spielen?');
    expect(screen().querySelector('.number-tile.is-selected').textContent).toBe('3');
    clickLabel('2');
    expect(nameInputs().map(i => i.value)).toEqual(['Anna', 'Ben']);
  });

  it('setup W3: Talstation per player; "Überspringen" hides once something is typed', () => {
    clickLabel('Weiter');
    expect(title()).toBe('Wo ist eure Talstation?');
    expect([...screen().querySelectorAll('.field__label')].map(l => l.textContent)).toEqual(['Anna', 'Ben']);
    expect(ref('skip').hidden).toBe(false);
    const inputs = [...screen().querySelectorAll('.text-field')];
    type(inputs[0], 'Dorf');
    expect(ref('skip').hidden).toBe(true);
    type(inputs[1], 'Bahnhof');
  });

  it('setup W4: full day by default; the short stepper shows the end time and clamps', () => {
    clickLabel('Weiter');
    expect(title()).toBe('Wie lange fahrt ihr?');
    expect(ref('full').classList.contains('is-selected')).toBe(true);
    expect(ref('fullSub').textContent).toBe('20 Runden · 08:00–17:30');
    ref('minus').click();   // selects "Kurz" too
    expect(ref('short').classList.contains('is-selected')).toBe(true);
    expect(ref('shortSub').textContent).toBe('15 Runden · bis 15:00');
    for (let i = 0; i < 10; i++) ref('minus').click();
    expect(ref('value').textContent).toBe('11');
    expect(ref('minus').disabled).toBe(true);
    ref('full').click();   // back to the full day for the rest of the test
  });

  it('"Los geht\'s!" starts the game with chrome and remembers the group', () => {
    clickLabel('Los geht');
    expect(isTurnStart()).toBe(true);
    expect(store.game.totalRounds).toBe(20);
    expect(store.game.players.map(p => [p.name, p.talstation, p.colorIndex])).toEqual([['Anna', 'Dorf', 1], ['Ben', 'Bahnhof', 3]]);
    const group = JSON.parse(localStorage.getItem('abaufdiepiste_v2_last_group'));
    expect(group.players.map(p => p.name)).toEqual(['Anna', 'Ben']);
    expect(document.getElementById('topbar').hidden).toBe(false);
    expect(document.getElementById('topbarTime').textContent).toBe('08:00');
    const chips = document.querySelectorAll('#scoreStrip .score-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0].classList.contains('is-current')).toBe(true);
    expect(chips[0].querySelector('.avatar').textContent).toBe('A');
    expect(JSON.parse(localStorage.getItem('abaufdiepiste_v2_game')).players).toHaveLength(2);
  });

  it('📷 sheet records a Sehenswürdigkeit and can remove the last one', () => {
    document.getElementById('btnSight').click();
    expect(sheet().querySelector('.sheet__title').textContent).toBe('1. Sehenswürdigkeit · +5');
    expect(sheetButton('Letzte entfernen')).toBeUndefined();
    sheetButton('Eintragen').click();
    expect(sheet()).toBeNull();
    expect(store.game.players[0]).toMatchObject({ sightings: 1, points: 5 });
    expect(document.querySelector('#scoreStrip .is-current').textContent).toContain('5');
    expect(JSON.parse(localStorage.getItem('abaufdiepiste_v2_game')).players[0].points).toBe(5);

    document.getElementById('btnSight').click();
    expect(sheet().querySelector('.sheet__title').textContent).toBe('2. Sehenswürdigkeit · +10');
    sheetButton('Letzte entfernen (−5)').click();
    expect(store.game.players[0]).toMatchObject({ sightings: 0, points: 0 });
  });

  it('tapping the scrim cancels a sheet', () => {
    document.getElementById('btnSight').click();
    expect(document.querySelector('.app').inert).toBe(true);
    sheet().parentElement.querySelector('.scrim').click();
    expect(sheet()).toBeNull();
    expect(document.querySelector('.app').inert).toBe(false);
    expect(store.game.players[0].sightings).toBe(0);
  });

  it('🎟 does nothing at 0 and spends one coin otherwise', () => {
    document.getElementById('btnGratis').click();
    expect(sheet()).toBeNull();
    store.game.players[0].gratis = 1;
    store.game.players[0].joker = 2;
    document.getElementById('btnGratis').click();
    sheetButton('Einsetzen').click();
    expect(store.game.players[0].gratis).toBe(0);
    expect(document.getElementById('gratisCount').hidden).toBe(true);
    expect(document.getElementById('btnGratis').classList.contains('is-empty')).toBe(true);

    document.getElementById('btnJoker').click();
    sheetButton('Abbrechen').click();
    expect(store.game.players[0].joker).toBe(2);
    document.getElementById('btnJoker').click();
    sheetButton('Einsetzen').click();
    expect(store.game.players[0].joker).toBe(1);
    expect(document.getElementById('jokerCount').textContent).toBe('1');
    store.game.players[0].joker = 0;
  });

  it('the score strip opens the scores; back returns', () => {
    document.getElementById('scoreStrip').click();
    expect(title()).toBe('Punkte');
    clickLabel('Zurück');
    expect(isTurnStart()).toBe(true);
  });

  it('a turn ends with the burst and moves to the next player', () => {
    clickLabel('Bergab');
    clickLabel('Würfeln');
    clickLabel('+10');
    expect(screen().querySelector('.points-burst').textContent).toBe('+10');
    document.getElementById('btnSight').click();   // quick actions are inert between turns
    expect(sheet()).toBeNull();
    vi.advanceTimersByTime(800);
    expect(isTurnStart()).toBe(true);
    expect(store.game.currentPlayerIndex).toBe(1);
    expect(document.querySelectorAll('#scoreStrip .score-chip')[1].classList.contains('is-current')).toBe(true);
  });

  it('turn start shows the current player with avatar and level stars', () => {
    expect(title()).toBe('Ben');
    expect(ref('avatar').textContent).toBe('B');
    expect(ref('hero').classList.contains('player-3')).toBe(true);
    expect(ref('stars').textContent).toBe('★☆☆');
    expect(ref('stars').getAttribute('aria-label')).toBe('Fahrniveau: Anfänger');
  });

  it('Pause is locked before 11:00: shows why and only wiggles', () => {
    const pause = ref('pause');
    expect(pause.classList.contains('is-locked')).toBe(true);
    expect(pause.getAttribute('aria-disabled')).toBe('true');
    expect(ref('pauseReason').textContent).toBe('ab 11:00');
    clickLabel('Pause');
    expect(isTurnStart()).toBe(true);
    expect(pause.classList.contains('is-wiggling')).toBe(true);
  });

  it('Pause lock reasons: open at 11:00, "vorbei" after 12:30, "schon gemacht" once taken', async () => {
    const { go } = await import('../v2/v2_router.js');
    const round = store.game.round;
    const pauseState = () => [ref('pause').classList.contains('is-locked'), ref('pauseSub').hidden ? '' : ref('pauseReason').textContent];

    store.game.round = 7;   // 11:00
    go('turn_start');
    expect(pauseState()).toEqual([false, '']);
    store.game.round = 11;  // 13:00
    go('turn_start');
    expect(pauseState()).toEqual([true, 'vorbei']);
    store.game.round = 8;
    store.game.players[1].pauseDone = true;
    go('turn_start');
    expect(pauseState()).toEqual([true, 'schon gemacht']);

    store.game.players[1].pauseDone = false;
    go('turn_start');
    clickLabel('Pause');   // open → goes to the pause step
    expect(title()).toBe('Pause');
    store.game.round = round;
    go('turn_start');
  });

  it('turn start of a finished game redirects to game end', async () => {
    const { go } = await import('../v2/v2_router.js');
    store.game.finished = true;
    go('turn_start');
    expect(title()).toBe('Skitag vorbei!');
    store.game.finished = false;
    go('turn_start');
    expect(isTurnStart()).toBe(true);
  });

  it('menu goes back to the previous screen', () => {
    document.getElementById('btnMenu').click();
    expect(title()).toBe('Menü');
    expect(document.getElementById('topbar').hidden).toBe(true);
    clickLabel('Zurück');
    expect(isTurnStart()).toBe(true);
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
    expect(isTurnStart()).toBe(true);
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

  it('Neues Spiel with a running game asks first, prefills the last group and keeps the game until start', () => {
    const running = store.game;
    clickLabel('Neues Spiel');
    expect(sheet().querySelector('.sheet__title').textContent).toBe('Laufendes Spiel verwerfen?');
    sheetButton('Abbrechen').click();
    expect(screen().classList.contains('home')).toBe(true);

    clickLabel('Neues Spiel');
    sheetButton('Neues Spiel').click();
    expect(title()).toBe('Wie viele spielen?');
    expect(screen().querySelector('.number-tile.is-selected').textContent).toBe('2');
    clickLabel('2');
    expect(nameInputs().map(i => i.value)).toEqual(['Anna', 'Ben']);
    expect(rows().map(r => r.className.match(/player-\d/)[0])).toEqual(['player-1', 'player-3']);
    ref('back').click();
    ref('back').click();
    expect(screen().classList.contains('home')).toBe(true);
    expect(store.game).toBe(running);
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
    expect(isTurnStart()).toBe(true);
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
