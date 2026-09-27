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
const chip = i => document.querySelectorAll('#scoreStrip .score-chip')[i];
const chipPoints = i => chip(i).querySelector('.score-chip__points').textContent;
const confettiShown = () => document.querySelector('#fxHost .confetti') !== null;
const sheetButton = label => [...(sheet()?.querySelectorAll('button') ?? [])].find(b => b.textContent.startsWith(label));
const ROLL_MS = 480;
const playBergauf = () => {
  clickLabel('Bergauf');
  clickLabel('Würfeln');
  vi.advanceTimersByTime(ROLL_MS);
  clickLabel('Fertig');
};
/** Runs fn with Math.random pinned to x (x = 0.55 → event Pulverschnee; see EVENT_SYMBOLS order). */
const withRandom = (x, fn) => {
  const spy = vi.spyOn(Math, 'random').mockReturnValue(x);
  try { fn(); } finally { spy.mockRestore(); }
};
const rollBergab = x => {
  clickLabel('Bergab');
  withRandom(x, () => clickLabel('Würfeln'));
  vi.advanceTimersByTime(ROLL_MS);
};
const tile = color => screen().querySelector(`.slope-tile--${color}`);
const plus = color => tile(color).querySelector('[data-ref="plus"]').click();
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

  it('tapping the scrim cancels a sheet and gives focus back to the opener', () => {
    document.getElementById('btnSight').focus();
    document.getElementById('btnSight').click();
    expect(document.querySelector('.app').inert).toBe(true);
    sheet().parentElement.querySelector('.scrim').click();
    expect(sheet()).toBeNull();
    expect(document.querySelector('.app').inert).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('btnSight'));
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
    ref('close').click();
    expect(isTurnStart()).toBe(true);
  });

  it('a turn ends with the burst and moves to the next player', () => {
    rollBergab(0.55);   // Anfänger: descent 4, Pulverschnee
    plus('red');
    plus('red');
    expect(ref('primary').textContent).toBe('+13 →');   // 2 × 4 + 5 Pulverschnee
    ref('primary').click();
    expect(screen().querySelector('.points-burst').textContent).toBe('+13');
    expect(store.game.players[0].points).toBe(13);
    expect(chipPoints(0)).toBe('0');   // the points are still flying in
    document.getElementById('btnSight').click();   // quick actions are inert between turns
    expect(sheet()).toBeNull();
    vi.advanceTimersByTime(700);
    expect(chipPoints(0)).toBe('13');
    expect(chip(0).classList.contains('is-bumped')).toBe(true);
    vi.advanceTimersByTime(100);
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
    expect(title()).toBe('Mittagspause');
    store.game.round = round;
    go('turn_start');
  });

  it('Pause: choose Restaurant or Bar (the other dims), confirm → points, pauseDone, turn end', async () => {
    const { go } = await import('../v2/v2_router.js');
    const round = store.game.round;
    store.game.round = 8;   // 11:30
    const p = store.game.players[store.game.currentPlayerIndex];
    p.pauseDone = false;
    const before = p.points;
    go('turn_start');
    clickLabel('Pause');
    expect(ref('primary').disabled).toBe(true);
    expect(ref('primary').textContent).toBe('Restaurant oder Bar?');
    ref('bar').click();
    expect(ref('primary').textContent).toBe('+7 →');
    expect(ref('restaurant').classList.contains('is-dimmed')).toBe(true);
    expect(ref('bar').getAttribute('aria-pressed')).toBe('true');
    ref('restaurant').click();
    expect(ref('primary').textContent).toBe('+15 →');

    ref('back').click();   // nothing booked yet
    expect(isTurnStart()).toBe(true);
    expect(p.pauseDone).toBe(false);

    clickLabel('Pause');
    ref('bar').click();
    ref('primary').click();
    expect(p).toMatchObject({ points: before + 7, pauseDone: true });
    expect(store.game.history.at(-1).text).toBe('Mittagspause Bar: +7 Punkte');
    expect(screen().querySelector('.points-burst').textContent).toBe('+7');
    vi.advanceTimersByTime(800);
    store.game.round = round;
    go('turn_start');
  });

  it('the pause step cannot be opened once the pause is taken', async () => {
    const { go } = await import('../v2/v2_router.js');
    const p = store.game.players.find(pl => pl.pauseDone);
    const idx = store.game.currentPlayerIndex;
    store.game.currentPlayerIndex = store.game.players.indexOf(p);
    store.game.round = 8;
    go('pause');
    expect(isTurnStart()).toBe(true);
    store.game.currentPlayerIndex = idx;
    store.game.round = 1;
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

  it('Bergauf B1: six unknown dice, back to the turn start is still possible', () => {
    clickLabel('Bergauf');
    expect(title()).toBe('Bergauf');
    const dice = screen().querySelectorAll('.die');
    expect(dice).toHaveLength(6);
    expect([...dice].every(d => d.disabled && d.querySelector('img').src.endsWith('die_unknown.svg'))).toBe(true);
    ref('back').click();
    expect(isTurnStart()).toBe(true);
  });

  it('Bergauf B2: the roll animates, then shows faces, one roll dot, hold hint and a result', () => {
    clickLabel('Bergauf');
    clickLabel('Würfeln');
    expect(screen().querySelectorAll('.die.is-rolling')).toHaveLength(6);
    expect(ref('primary').disabled).toBe(true);
    vi.advanceTimersByTime(ROLL_MS);
    expect(screen().querySelectorAll('.die.is-rolling')).toHaveLength(0);
    expect(screen().querySelectorAll('.roll-dots .dot.is-used')).toHaveLength(1);
    expect(ref('hint').textContent).toBe('Antippen = behalten');
    expect(ref('lines').children.length).toBeGreaterThan(0);
    expect(ref('secondary').hidden).toBe(false);
  });

  it('after rolling, the action is locked: the turn start sends the player back to the dice', async () => {
    const { go } = await import('../v2/v2_router.js');
    go('turn_start');
    expect(isTurnStart()).toBe(false);
    expect(title()).toBe('Bergauf');
    expect(screen().querySelector('.roll-dots')).not.toBeNull();
  });

  it('no ride → "Liftschlange" and "Nochmal würfeln" first; held dice keep their face; roll 2 ends', async () => {
    const { go } = await import('../v2/v2_router.js');
    const { turn } = await import('../v2/turn_state.js');
    turn.data.dice = ['fussweg', 'kleingondel', 'skilift', 'sesselbahn', 'gondel', 'zug'];
    turn.data.held = Array(6).fill(false);
    go('bergauf_result');
    expect(ref('lines').textContent).toBe('Liftschlange – nächste Runde nochmal');
    expect(ref('primary').textContent).toBe('Nochmal würfeln');
    expect(ref('secondary').textContent).toBe('Fertig');

    screen().querySelectorAll('.die')[4].click();   // hold the Kabinengondel
    expect(turn.data.held[4]).toBe(true);
    expect(screen().querySelectorAll('.die')[4].getAttribute('aria-pressed')).toBe('true');
    ref('primary').click();
    vi.advanceTimersByTime(ROLL_MS);
    expect(turn.data.rolls).toBe(2);
    expect(turn.data.dice[4]).toBe('gondel');
    expect(screen().querySelectorAll('.roll-dots .dot.is-used')).toHaveLength(2);
    expect(ref('secondary').hidden).toBe(true);
    expect(ref('primary').textContent).toBe('Fertig →');
    expect(ref('hint').hidden).toBe(true);
    expect(screen().querySelectorAll('.die')[0].disabled).toBe(true);   // no holding after roll 2
  });

  it('Joker: tap the Joker, tap a die, pick a face → the die turns, 1 Joker is spent', async () => {
    const { go } = await import('../v2/v2_router.js');
    const { turn } = await import('../v2/turn_state.js');
    const p = store.game.players[store.game.currentPlayerIndex];
    p.joker = 1;
    turn.data.dice = ['fussweg', 'kleingondel', 'skilift', 'sesselbahn', 'gondel', 'zug'];
    go('bergauf_result');
    expect(ref('joker').hidden).toBe(false);
    expect(ref('jokerLabel').textContent).toBe('Joker einsetzen (1)');
    ref('joker').click();
    expect(ref('hint').textContent).toBe('Welchen Würfel drehen?');
    screen().querySelectorAll('.die')[5].click();   // the Zug die
    const options = sheet().querySelectorAll('.face-option');
    expect(options).toHaveLength(6);
    options[4].click();   // → Kabinengondel
    expect(p.joker).toBe(0);
    expect(turn.data.dice[5]).toBe('gondel');
    expect(turn.data.jokered[5]).toBe(true);
    expect(ref('lines').textContent).toBe('2× Kabinengondel');
    expect(ref('joker').hidden).toBe(true);
    expect(document.getElementById('jokerCount').hidden).toBe(true);
    expect(store.game.history.at(-1).text).toBe('Joker eingesetzt');

    // A die turned with a Joker is final: it cannot be turned again (no second Joker on it).
    p.joker = 1;
    go('bergauf_result');
    ref('joker').click();
    const turned = screen().querySelectorAll('.die')[5];
    expect(turned.disabled).toBe(true);
    expect(turned.getAttribute('aria-label')).toBe('Kabinengondel, mit Joker gedreht');
    turned.click();
    expect(sheet()).toBeNull();
    ref('joker').click();   // leave pick mode
    p.joker = 0;
    go('bergauf_result');
  });

  it('Fertig logs the ride and ends the turn without points', () => {
    const idx = store.game.currentPlayerIndex;
    const entries = store.game.history.length;
    const fertig = [...screen().querySelectorAll('button')].find(b => b.textContent.includes('Fertig'));
    fertig.click();
    fertig.click();   // double tap: the detached button must not log the ride again
    expect(store.game.history.length).toBe(entries + 1);
    expect(store.game.history.at(-1).text).toBe('Bergauf: Kabinengondel');
    expect(ref('check').hidden).toBe(false);
    vi.advanceTimersByTime(800);
    expect(isTurnStart()).toBe(true);
    expect(store.game.currentPlayerIndex).not.toBe(idx);
  });

  it('Bergab D1: descent die shows the level stars; back is possible', () => {
    store.game.players[store.game.currentPlayerIndex].points = 30;   // Fortgeschritten
    clickLabel('Bergab');
    expect(title()).toBe('Bergab');
    expect(ref('stars').textContent).toBe('★★');
    ref('back').click();
    expect(isTurnStart()).toBe(true);
  });

  it('Bergab D2: crossings, tiles, cap, Ohne Befugnis with Joker, Extraaktivität, total', () => {
    const p = store.game.players[store.game.currentPlayerIndex];
    p.points = 30;   // Fortgeschritten: blue, red, black allowed; die 2·4·6
    p.joker = 1;
    p.gratis = 0;
    rollBergab(0.55);   // descent 4, Pulverschnee
    expect(ref('crossLabel').textContent).toBe('4 Kreuzungen');
    expect(ref('live').textContent).toBe('0 von 4 Kreuzungen, 0 Punkte');
    expect(ref('dots').children).toHaveLength(4);
    expect(ref('eventLine').textContent).toBe('Pulverschnee: +5 mit Abfahrt');
    expect(tile('yellow').classList.contains('is-forbidden')).toBe(true);
    expect(tile('black').classList.contains('is-forbidden')).toBe(false);
    expect(ref('primary').textContent).toBe('Weiter →');
    expect(tile('blue').querySelector('[data-ref="minus"]').disabled).toBe(true);

    // Four crossings on red; a fifth only shakes the tile.
    for (let i = 0; i < 5; i++) plus('red');
    expect(tile('red').querySelector('[data-ref="count"]').textContent).toBe('4');
    expect(tile('red').classList.contains('is-bumped')).toBe(true);
    expect(screen().querySelectorAll('.crossings .dot.is-used')).toHaveLength(4);
    expect(ref('live').textContent).toBe('4 von 4 Kreuzungen, +21 Punkte');
    tile('red').querySelector('[data-ref="minus"]').click();

    // Forbidden yellow → Ohne-Befugnis sheet; Abbrechen adds nothing.
    plus('yellow');
    expect(sheet().querySelector('.sheet__title').textContent).toBe('Ohne Befugnis');
    sheetButton('Abbrechen').click();
    expect(tile('yellow').querySelector('[data-ref="count"]').hidden).toBe(true);
    // Sad smiley → negative, then the Joker turns it happy.
    plus('yellow');
    withRandom(0.9, () => sheetButton('Würfeln').click());
    expect(sheet().querySelector('.sheet__title').textContent).toBe('Negative Punkte');
    expect(ref('primary').textContent).toBe('+9 →');   // 12 + 5 − 8
    sheetButton('Joker nutzen').click();
    expect(p.joker).toBe(0);
    expect(ref('primary').textContent).toBe('+25 →');   // 12 + 8 + 5
    expect(tile('yellow').querySelector('[data-ref="smiley"]').src).toContain('froehlich');

    // Extraaktivität: happy smiley → +12, then the icon shows the result and is done.
    ref('extra').click();
    withRandom(0.1, () => sheetButton('Würfeln').click());
    expect(sheet().querySelector('.sheet__title').textContent).toBe('+12 Punkte');
    sheetButton('OK').click();
    expect(ref('extraLabel').textContent).toBe('+12');
    expect(ref('extra').disabled).toBe(true);
    expect(ref('primary').textContent).toBe('+37 →');

    const before = p.points;
    ref('primary').click();
    expect(p.points).toBe(before + 37);
    expect(store.game.history.at(-1).text).toBe('Bergab: Rot ×3 = 12, Gelb ×1 = 8 (+5 Pulverschnee), Extraaktivität +12 → +37 Punkte');
    vi.advanceTimersByTime(800);
  });

  it('Bergab Unfall: no tiles, "Weiter →"; the Joker on the event die averts it', () => {
    const p = store.game.players[store.game.currentPlayerIndex];
    p.points = 0;
    p.joker = 1;
    p.gratis = 0;
    rollBergab(0.7);   // Unfall
    expect(ref('tiles').hidden).toBe(true);
    expect(ref('blockedText').textContent).toBe('Unfall – diese Runde keine Abfahrt');
    expect(ref('extra').hidden).toBe(true);
    expect(ref('primary').textContent).toBe('Weiter →');
    ref('eventJoker').click();
    sheetButton('Einsetzen').click();
    expect(p.joker).toBe(0);
    expect(ref('tiles').hidden).toBe(false);
    expect(ref('eventLine').textContent).toBe('Joker: Unfall abgewendet');
    expect(ref('eventJoker').hidden).toBe(true);
    ref('primary').click();
    vi.advanceTimersByTime(800);
  });

  it('Bergab Sonne as the 3rd coin: all coins are returned, a sheet says so once', async () => {
    const { go } = await import('../v2/v2_router.js');
    const p = store.game.players[store.game.currentPlayerIndex];
    p.joker = 1;
    p.gratis = 1;
    rollBergab(0.9);   // Sonne
    expect(p).toMatchObject({ joker: 0, gratis: 0 });
    expect(sheet().querySelector('.sheet__title').textContent).toBe('3 Münzen – alle zurückgeben');
    sheetButton('OK').click();
    expect(ref('eventLine').textContent).toBe('3 Münzen – alle zurückgegeben');
    go('turn_start');   // locked → back to the dice, without the sheet again
    expect(title()).toBe('Bergab');
    expect(sheet()).toBeNull();
    ref('primary').click();
    vi.advanceTimersByTime(800);
  });

  it('menu goes back to the previous screen', () => {
    document.getElementById('btnMenu').click();
    expect(title()).toBe('Menü');
    expect(document.getElementById('topbar').hidden).toBe(true);
    ref('close').click();
    expect(isTurnStart()).toBe(true);
    expect(screen().classList.contains('screen--back')).toBe(true);
  });

  it('menu shows round and time; pages return to the menu, the menu to the game (no bouncing)', () => {
    document.getElementById('btnMenu').click();
    expect(ref('status').textContent).toBe(`Runde ${store.game.round} von 20 · ${document.getElementById('topbarTime').textContent}`);
    ref('scores').click();
    expect(title()).toBe('Punkte');
    ref('close').click();
    expect(title()).toBe('Menü');
    ref('rules').click();
    ref('close').click();
    expect(title()).toBe('Menü');
    ref('close').click();
    expect(isTurnStart()).toBe(true);
  });

  it('Punkte: ranking, Punkteverlauf with a live row, round detail on tap', () => {
    document.getElementById('scoreStrip').click();
    const rows = [...screen().querySelectorAll('.rank-row')];
    expect(rows).toHaveLength(2);
    const shown = rows.map(r => Number(r.querySelector('[data-ref="points"]').textContent));
    expect(shown).toEqual([...shown].sort((a, b) => b - a));
    const tableRows = screen().querySelectorAll('.score-table tbody tr');
    expect(tableRows).toHaveLength(store.game.roundSnapshots.length + 1);
    expect(tableRows[tableRows.length - 1].classList.contains('is-live')).toBe(true);

    screen().querySelector('.score-table tbody .score-cell[data-ref="btn"]').click();
    expect(sheet().querySelector('.sheet__title').textContent).toMatch(/^(Anna|Ben) · \d\d:\d\d$/);
    sheetButton('OK').click();
    ref('close').click();   // opened from the score strip → straight back to the game
    expect(isTurnStart()).toBe(true);
  });

  it('Würfel & Regeln is built from the rule constants', () => {
    document.getElementById('btnMenu').click();
    ref('rules').click();
    const cards = screen().querySelectorAll('.rule-card');
    expect(cards).toHaveLength(5);
    const first = cards[0].querySelector('.rule-item');
    expect(first.querySelector('[data-ref="label"]').textContent).toBe('★☆☆ Anfänger');
    expect(first.querySelector('[data-ref="text"]').textContent).toBe('0–20 Punkte · Würfel 2 / 4 · Pisten: Blau, Rot');
    ref('close').click();
    ref('close').click();
  });

  it('Anpassungen: confirm first, edit on a copy, coins stay below the limit, save logs it', () => {
    const p = store.game.players[0];
    const before = { points: p.points, joker: p.joker, gratis: p.gratis };
    document.getElementById('btnMenu').click();
    ref('adjust').click();
    expect(sheet().querySelector('.sheet__title').textContent).toBe('Punkte und Münzen ändern?');
    sheetButton('Anpassen').click();
    expect(title()).toBe('Anpassungen');

    const card = screen().querySelectorAll('.adjust-card')[0];
    const step = (field, dir) => card.querySelector(`[data-field="${field}"] [data-step="${dir}"]`);
    // Cancel: nothing changes.
    step('points', 1).click();
    ref('close').click();
    expect(title()).toBe('Menü');
    expect(p.points).toBe(before.points);

    ref('adjust').click();
    sheetButton('Anpassen').click();
    const card2 = screen().querySelectorAll('.adjust-card')[0];
    const step2 = (field, dir) => card2.querySelector(`[data-field="${field}"] [data-step="${dir}"]`);
    p.joker = 0;
    p.gratis = 0;
    step2('points', 1).click();
    step2('joker', 1).click();
    step2('joker', 1).click();
    expect(step2('joker', 1).disabled).toBe(true);    // 2 coins = the most a player can hold
    expect(step2('gratis', 1).disabled).toBe(true);
    ref('save').click();
    expect(title()).toBe('Menü');
    expect(p).toMatchObject({ points: before.points + 1, joker: 2, gratis: 0 });
    expect(store.game.history.slice(-2).map(h => [h.playerIdx, h.text])).toEqual([[0, 'Anpassung: +1 Punkte'], [0, 'Anpassung: Joker 0 → 2']]);
    Object.assign(p, before);
    ref('close').click();
  });

  it('Neues Spiel from the menu asks first and keeps the game until the new one starts', () => {
    const running = store.game;
    document.getElementById('btnMenu').click();
    ref('newGame').click();
    sheetButton('Neues Spiel').click();
    expect(title()).toBe('Wie viele spielen?');
    expect(store.game).toBe(running);
    ref('back').click();   // wizard → home
    screen().querySelector('[data-ref="continue"]').click();
    expect(isTurnStart()).toBe(true);
  });

  it('shows the lunch card when a round starts at 11:00, once', () => {
    store.game.round = 6;               // 10:30
    store.game.currentPlayerIndex = 1;  // last player
    playBergauf();
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
    playBergauf();
    vi.advanceTimersByTime(800);
    expect(title()).toBe('Noch 3 Runden – ab ins Tal!');
    const rows = screen().querySelectorAll('.talstation-list__row');
    expect([...rows].map(r => r.textContent)).toEqual(['AnnaDorf', 'BenBahnhof']);
    clickLabel('OK');
  });

  it('the last turn of the last round leads to game end; home then offers the Schlusswertung', async () => {
    store.game.round = 20;
    store.game.currentPlayerIndex = 1;
    playBergauf();
    vi.advanceTimersByTime(800);
    expect(title()).toBe('Skitag vorbei!');
    expect(store.game.finished).toBe(true);
    expect(ref('time').textContent).toBe('17:30');
    clickLabel('Schlusswertung starten');
    expect(title()).toBe('Anna');
    const { go } = await import('../v2/v2_router.js');
    go('home');
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
    playBergauf();
    document.getElementById('btnMenu').click();   // leave turn_end before the 800 ms
    vi.advanceTimersByTime(2000);
    expect(store.game.currentPlayerIndex).toBe(0);
  });

  it('a turn without points shows the check icon instead of a number', async () => {
    ref('close').click();   // menu → back to turn_end, which restarts its timer
    expect(screen().querySelector('[data-ref="check"]').hidden).toBe(false);
    expect(screen().querySelector('.points-burst').hidden).toBe(true);
    vi.advanceTimersByTime(800);
    expect(isTurnStart()).toBe(true);
  });

  it('a level-up at turn end: points land, then the celebration card waits for a tap', () => {
    const idx = store.game.currentPlayerIndex;
    const p = store.game.players[idx];
    const saved = p.points;
    p.points = 18;
    rollBergab(0.55);   // Anfänger: descent 4, Pulverschnee
    plus('red');
    plus('red');
    ref('primary').click();   // +13 → 31 = Fortgeschritten
    vi.advanceTimersByTime(800);
    expect(sheet().querySelector('.sheet__title').textContent).toBe(`${p.name} steigt auf!`);
    expect(sheet().querySelector('.sheet__text').textContent).toBe('Neues Fahrniveau: Fortgeschritten');
    expect(document.querySelector('.sheet-layer--celebrate')).not.toBeNull();
    const stars = [...sheet().querySelectorAll('.level-up__star')];
    expect(stars.map(s => s.textContent).join('')).toBe('★★☆');
    expect(stars.map(s => s.classList.contains('is-new'))).toEqual([false, true, false]);
    expect(confettiShown()).toBe(true);
    vi.advanceTimersByTime(5000);   // no auto-advance while the card is open
    expect(screen().classList.contains('turn-end')).toBe(true);
    expect(store.game.currentPlayerIndex).toBe(idx);
    sheetButton('Weiter').click();
    expect(isTurnStart()).toBe(true);
    expect(confettiShown()).toBe(false);
    p.points = saved;
  });

  it('a Sehenswürdigkeit that lifts the level is celebrated right away; Escape closes it', () => {
    const p = store.game.players[store.game.currentPlayerIndex];
    const saved = { points: p.points, sightings: p.sightings };
    Object.assign(p, { points: 17, sightings: 0 });
    document.getElementById('btnSight').click();
    sheetButton('Eintragen').click();   // +5 → 22
    expect(sheet().querySelector('.sheet__title').textContent).toBe(`${p.name} steigt auf!`);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(sheet()).toBeNull();
    expect(confettiShown()).toBe(false);
    expect(isTurnStart()).toBe(true);
    Object.assign(p, saved);
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

  it('Schlusswertung: Ja → coin bonus; Nein → Rückweg with half slope points, rides, Talstationen', async () => {
    const { go } = await import('../v2/v2_router.js');
    const { setGame } = await import('../v2/v2_store.js');
    const { createGame } = await import('../v2/flow_logic.js');
    const g = createGame([{ name: 'Anna', talstation: 'Dorf' }, { name: 'Ben', talstation: 'Bahnhof' }]);
    Object.assign(g, { finished: true, round: 20 });
    Object.assign(g.players[0], { points: 40, joker: 1, gratis: 1 });
    g.players[1].points = 30;
    setGame(g);
    go('game_end');
    expect(title()).toBe('Skitag vorbei!');
    clickLabel('Schlusswertung starten');

    // Anna: Ja → summary → back → Ja → confirm
    expect(title()).toBe('Anna');
    expect(ref('progress').textContent).toBe('Schlusswertung 1/2');
    expect(ref('talstation').textContent).toBe('Dorf');
    expect(ref('back').hidden).toBe(true);
    ref('yes').click();
    expect(ref('stepSummary').hidden).toBe(false);
    expect([...screen().querySelectorAll('.summary-line')].map(l => l.textContent)).toEqual(['2 Münzen übrig+10']);
    expect(ref('total').textContent).toBe('+10 → 50 Punkte');
    ref('back').click();
    expect(ref('stepReached').hidden).toBe(false);
    ref('yes').click();
    ref('confirm').click();
    expect(g.players[0]).toMatchObject({ points: 50, joker: 0, gratis: 0, schlusswertungDone: true });

    // Ben: Nein → 1× Rot, 2 rides, 1 extra Talstation = −15 −2 −10 −5
    expect(title()).toBe('Ben');
    ref('no').click();
    expect(ref('stepReturn').hidden).toBe(false);
    screen().querySelector('.slope-tile--red [data-ref="plus"]').click();
    const step = (field, dir) => screen().querySelector(`.stepper[data-field="${field}"] [data-step="${dir}"]`);
    step('transports', 1).click();
    step('transports', 1).click();
    step('extraTalstationen', 1).click();
    expect(ref('penalty').textContent).toBe('Strafe: −32');
    ref('toSummary').click();
    expect(screen().querySelectorAll('.summary-line')).toHaveLength(5);
    expect(ref('total').textContent).toBe('−32 → −2 Punkte');
    ref('back').click();   // back to the Rückweg, answers kept
    expect(ref('transports').textContent).toBe('2');
    ref('toSummary').click();
    ref('confirm').click();
    expect(g.players[1].points).toBe(-2);
    expect(g.history.at(-1)).toMatchObject({ playerIdx: 1, text: 'Schlusswertung: −32 Punkte' });
  });

  it('Rangliste: podium in rank order, Punkteverlauf and back, home offers the ranking', async () => {
    const { go } = await import('../v2/v2_router.js');
    expect(title()).toBe('Rangliste');
    const places = [...screen().querySelectorAll('.podium__place')];
    expect(places.map(pl => pl.getAttribute('aria-label'))).toEqual(['1. Platz: Anna, 50 Punkte', '2. Platz: Ben, −2 Punkte']);
    expect(confettiShown()).toBe(true);   // right after the last Schlusswertung
    ref('history').click();
    expect(confettiShown()).toBe(false);
    expect(title()).toBe('Punkte');
    ref('close').click();
    expect(title()).toBe('Rangliste');
    expect(confettiShown()).toBe(false);   // only once
    go('game_end');   // everyone is done → straight to the ranking
    expect(title()).toBe('Rangliste');
    go('home');
    expect(screen().querySelector('[data-ref="continueSub"]').textContent).toBe('Rangliste');
  });


  it('unconfirmed Schlusswertung answers never carry over into another game', async () => {
    const { go } = await import('../v2/v2_router.js');
    const { setGame } = await import('../v2/v2_store.js');
    const { createGame } = await import('../v2/flow_logic.js');
    const finished = () => Object.assign(createGame([{ name: 'Anna' }, { name: 'Ben' }]), { finished: true, round: 20 });
    setGame(finished());
    go('schlusswertung');
    ref('no').click();
    screen().querySelector('.slope-tile--red [data-ref="plus"]').click();   // not confirmed
    setGame(finished());
    go('schlusswertung');
    expect(ref('stepReached').hidden).toBe(false);
    ref('no').click();
    expect(screen().querySelector('.slope-tile--red [data-ref="count"]').hidden).toBe(true);
  });


  it('Punkteblock: setup is 3 steps and leaves the app game alone', async () => {
    const { go } = await import('../v2/v2_router.js');
    const gameBefore = store.game;
    store.pad = null;
    go('home');
    clickLabel('Punkteblock');
    expect(title()).toBe('Wie viele spielen?');
    const dots = [...screen().querySelectorAll('.wizard__dots .dot')];
    expect(dots.filter(d => !d.hidden)).toHaveLength(3);
    expect(screen().querySelector('.wizard__dots').getAttribute('aria-label')).toBe('Schritt 1 von 3');
    clickLabel('3');
    ['Anna', 'Ben', 'Clara'].forEach((name, i) => type(nameInputs()[i], name));
    clickLabel('Weiter');
    expect(screen().querySelector('.wizard__dots').getAttribute('aria-label')).toBe('Schritt 3 von 3');
    clickLabel('Weiter');
    expect(title()).toBe('Punkteblock');
    expect(store.pad.players.map(pl => pl.name)).toEqual(['Anna', 'Ben', 'Clara']);
    expect(store.game).toBe(gameBefore);
    expect(JSON.parse(localStorage.getItem('abaufdiepiste_v2_punkteblock')).players).toHaveLength(3);
  });

  it('Punkteblock: the pad mirrors the printed one (20 time rows, lunch and valley rows)', () => {
    const timeRows = [...screen().querySelectorAll('.pad tbody tr')].filter(tr => /^\d\d:\d\d$/.test(tr.firstElementChild.textContent));
    expect(timeRows).toHaveLength(20);
    expect(screen().querySelectorAll('.pad tr.is-lunch')).toHaveLength(4);
    expect(screen().querySelectorAll('.pad tr.is-valley')).toHaveLength(3);
    expect(screen().querySelectorAll('.pad__player')).toHaveLength(3);
  });

  it('Punkteblock: chips add up, Sehenswürdigkeit grows, ± flips, totals and stars follow', () => {
    const cellBtn = (time, col) => {
      const tr = [...screen().querySelectorAll('.pad tbody tr')].find(r => r.firstElementChild.textContent === time);
      return tr.querySelectorAll('.pad__cell')[col];
    };
    const chip = label => [...sheet().querySelectorAll('.chip')].find(c => c.textContent.startsWith(label));

    cellBtn('10:00', 0).click();
    expect(sheet().querySelector('.sheet__title').textContent).toBe('Anna · 10:00');
    chip('+4').click();
    chip('+4').click();
    chip('Sehensw.').click();
    expect(chip('Sehensw.').textContent).toBe('Sehensw. +10');
    expect(sheet().querySelector('.pad-entry__input').value).toBe('13');
    sheetButton('Eintragen').click();
    expect(cellBtn('10:00', 0).textContent).toBe('13');
    const sightsShown = () => screen().querySelectorAll('.pad__meta')[1].querySelectorAll('.pad__value')[0].textContent;
    expect(sightsShown()).toBe('1');

    cellBtn('10:30', 0).click();
    const input = sheet().querySelector('.pad-entry__input');
    input.value = '6';
    sheet().querySelector('[data-ref="sign"]').click();
    expect(input.value).toBe('-6');
    sheetButton('Eintragen').click();
    const totals = [...screen().querySelectorAll('[data-ref="totals"] .pad__value')].map(td => td.textContent);
    expect(totals).toEqual(['7', '0', '0']);
    expect(cellBtn('10:30', 0).textContent).toBe('−6');
    expect(screen().querySelector('.pad__stars').textContent).toBe('★☆☆');

    // Schlusswertung row: its own chips; the Endstand includes it
    screen().querySelector('[data-ref="finalRow"] .pad__cell').click();
    chip('Talstation nicht erreicht').click();
    sheetButton('Eintragen').click();
    expect(screen().querySelector('[data-ref="endRow"] .pad__value').textContent).toBe('−8');
    expect(totals[0]).toBe('7');   // the running total ignores the Schlusswertung

    // Re-opening the 10:00 cell starts from its own Sehenswürdigkeit; "Löschen" takes it back out
    cellBtn('10:00', 0).click();
    expect(chip('Sehensw.').textContent).toBe('Sehensw. +10');
    sheet().querySelector('[data-ref="clear"]').click();
    expect(chip('Sehensw.').textContent).toBe('Sehensw. +5');
    sheetButton('Eintragen').click();
    expect(cellBtn('10:00', 0).textContent).toBe('');
    expect(sightsShown()).toBe('0');
  });

  it('Punkteblock: reopening shows the pad; "Neu" asks and keeps it until the new one starts', () => {
    ref('home').click();
    clickLabel('Punkteblock');
    expect(title()).toBe('Punkteblock');
    const pad = store.pad;
    ref('newPad').click();
    sheetButton('Neuer Block').click();
    expect(title()).toBe('Wie viele spielen?');
    expect(store.pad).toBe(pad);
  });


  it('Schlusswertung: "Ja" clears earlier Rückweg answers; a tie for 1st stands equally high', async () => {
    const { go } = await import('../v2/v2_router.js');
    const { setGame } = await import('../v2/v2_store.js');
    const { createGame } = await import('../v2/flow_logic.js');
    const g = Object.assign(createGame([{ name: 'Anna' }, { name: 'Ben' }]), { finished: true, round: 20 });
    g.players.forEach(pl => { pl.points = 30; });
    setGame(g);
    go('schlusswertung');
    ref('no').click();
    screen().querySelector('.slope-tile--red [data-ref="plus"]').click();
    ref('back').click();
    ref('yes').click();
    ref('back').click();
    ref('no').click();
    expect(screen().querySelector('.slope-tile--red [data-ref="count"]').hidden).toBe(true);
    ref('back').click();
    ref('yes').click();
    ref('confirm').click();
    ref('yes').click();
    ref('confirm').click();

    expect(title()).toBe('Rangliste');
    const places = [...screen().querySelectorAll('.podium__place')];
    expect(places.map(pl => pl.querySelector('[data-ref="rank"]').textContent)).toEqual(['1', '1']);
    expect(places.map(pl => [pl.classList.contains('podium__place--pos-1'), pl.classList.contains('podium__place--pos-2')])).toEqual([[true, false], [false, true]]);
    expect(places.every(pl => pl.classList.contains('podium__place--1'))).toBe(true);
  });

});
