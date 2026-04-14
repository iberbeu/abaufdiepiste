// ═══════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════
const TRANSPORT_SYMBOLS = ['fussweg','kleingondel','skilift','sesselbahn','gondel','zug'];
const TRANSPORT_IMGS    = {
  fussweg:    'img/transport_fussweg.png',
  kleingondel:'img/transport_kleingondel.png',
  skilift:    'img/transport_skilift.png',
  sesselbahn: 'img/transport_sesselbahn.png',
  gondel:     'img/transport_gondel.svg',
  zug:        'img/transport_zug.png',
};
const TRANSPORT_NAMES   = ['Fußweg','Kleingondel','Skilift','Sesselbahn','Gondel','Zug/Bus'];
const EVENT_FACES = [
  { sym:'fahrt',       img:'img/event_fahrt.png',       label:'+1 Fahrt',    cls:'success', text:'+1 Fahrt: Du erhältst eine Gratisfahrt-Münze! 🎟' },
  { sym:'helikopter',  img:'img/event_helikopter.png',  label:'Helikopter',  cls:'warning', text:'Helikopter: Transport ins nächste Tal – neu starten! 🚁' },
  { sym:'schneesturm', img:'img/event_schneesturm.png', label:'Schneesturm', cls:'danger',  text:'Schneesturm: Nur halbe Punkte für diese Abfahrt! ❄' },
  { sym:'pulverschnee',img:'img/event_pulverschnee.png',label:'Pulverschnee',cls:'success', text:'Pulverschnee: +5 Bonuspunkte! 🎉' },
  { sym:'unfall',      img:'img/event_unfall.png',      label:'Unfall',      cls:'danger',  text:'Unfall: Keine Abfahrt möglich – Zug aussetzen. Joker einsetzbar!' },
  { sym:'sonne',       img:'img/event_sonne.png',       label:'Sonne',       cls:'success', text:'Sonne: 1 Joker erhalten! 🃏' }
];
const DESCENT_DICE = {
  anfaenger:      { faces:[1,1,2,2,3,3], cls:'die-descent-red',    label:'🔴 Anfänger',      imgPrefix:'img/descent_anfaenger_' },
  fortgeschritten:{ faces:[2,2,3,3,4,4], cls:'die-descent-black',  label:'⚫ Fortgeschritten', imgPrefix:'img/descent_fortgeschritten_' },
  profi:          { faces:[3,3,4,4,6,6], cls:'die-descent-yellow', label:'🟡 Profi',          imgPrefix:'img/descent_profi_' }
};
const IMG_UNKNOWN = 'img/die_unknown.svg';

function dieImg(src, alt, cover = false) {
  const fit = cover ? 'cover' : 'contain';
  return `<img src="${src}" alt="${alt}" style="width:100%;height:100%;object-fit:${fit};">`;
}

// 3D die cube helpers — unified roll animation shared by every die in the app.
// Based on rolling_die_example.html: spins to a random target face (one of 6)
// using smoothstep easing over 500ms. The final result is placed on that
// target face just before the animation ends, so every die — transport, event,
// descent, Rot/Grün — rolls with the same look and feel.
const ROLL_DURATION = 500; // ms — animation duration (matches example)
const FACE_NAMES    = ['front','back','right','left','top','bottom'];

// Rotation (deg) that brings each face to the viewer (front). Mirrors the
// `faceRotations` array in rolling_die_example.html, mapped to named faces.
const FACE_TARGET_ROTATIONS = {
  front:  { x:   0, y:   0 },
  back:   { x:   0, y: 180 },
  right:  { x:   0, y: -90 },
  left:   { x:   0, y:  90 },
  top:    { x: -90, y:   0 },
  bottom: { x:  90, y:   0 },
};

// Tracks per-die rotation state (accumulated angles) across rolls.
const dieRotations = new WeakMap();

// Wraps face content in the full 6-face cube structure (static — no animation).
// Used for the pre-roll "?" state; all six faces show the same placeholder.
function dieFaceHTML(innerHTML) {
  return '<div class="die-cube">' +
    FACE_NAMES.map(n => `<div class="die-face die-face-${n}">${innerHTML}</div>`).join('') +
    '</div>';
}

// Animates a die with the example's 3D cube roll.
//   el            — the .die wrapper element
//   getRandomHTML — () => string, called once per face to fill the other 5
//                   faces with varied content during the spin (visual noise)
//   finalHTML     — string placed on the landing face (the one facing the
//                   viewer when the animation stops)
//
// Per-die rotation is preserved across calls so consecutive rolls continue
// from where the previous one ended, giving a continuous physical feel.
function animateDieRoll(el, getRandomHTML, finalHTML) {
  const rot = dieRotations.get(el) || { x: 0, y: 0, rolling: false };
  if (rot.rolling) return;
  dieRotations.set(el, rot);
  rot.rolling = true;

  el.classList.add('die-rolling');

  // Pick a random landing face. The face that lands facing the viewer will
  // receive the final HTML; the others get random filler.
  const landingFace = FACE_NAMES[Math.floor(Math.random() * FACE_NAMES.length)];
  const target      = FACE_TARGET_ROTATIONS[landingFace];

  // Build cube — non-landing faces get random filler so the cube looks solid.
  const cubeHTML = '<div class="die-cube">' +
    FACE_NAMES.map(n => `<div class="die-face die-face-${n}">${getRandomHTML()}</div>`).join('') +
    '</div>';
  el.innerHTML = cubeHTML;
  const cube = el.querySelector('.die-cube');

  const startX = rot.x, startY = rot.y;
  // Spin 2 full rotations (720°) plus the delta needed to land on the target.
  // Matches the example exactly: startX + 720 + target.x.
  const spinX = startX + 720 + target.x;
  const spinY = startY + 720 + target.y;

  const startTime = performance.now();

  // Place the result on the landing face ~80ms before the animation ends,
  // while that face is still rotated away from the viewer. This hides the
  // swap so the player never sees it flip.
  setTimeout(() => {
    const landingEl = cube.querySelector('.die-face-' + landingFace);
    if (landingEl) landingEl.innerHTML = finalHTML;
  }, ROLL_DURATION - 80);

  function animate(now) {
    const t = Math.min((now - startTime) / ROLL_DURATION, 1);
    // Smoothstep easing — identical to the example's t*t*(3-2*t).
    const ease = t * t * (3 - 2 * t);

    const x = startX + (spinX - startX) * ease;
    const y = startY + (spinY - startY) * ease;
    cube.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      // Reset to the canonical rotation for the landing face so the next roll
      // always starts from a known position. Without this, accumulated angles
      // drift and the wrong face ends up facing the viewer.
      rot.x = target.x;
      rot.y = target.y;
      cube.style.transform = `rotateX(${target.x}deg) rotateY(${target.y}deg)`;
      rot.rolling = false;
      el.classList.remove('die-rolling');
    }
  }

  requestAnimationFrame(animate);
}

const SLOPE_PTS = { blue: 2, red: 4, black: 6, yellow: 8 };
// Tracks selected Kreuzungen per slope colour: { blue: 0, red: 0, black: 0, yellow: 0 }
let slopeSelection = { blue: 0, red: 0, black: 0, yellow: 0 };
const PLAYER_COLORS = ['#3A8A8C','#e05252','#4caf50','#ff9800','#9c27b0','#00bcd4'];

let state = {
  players: [],
  currentPlayerIndex: 0,
  round: 1,
  totalRounds: 20,
  startHour: 8,
  transportDice: [],     // {sym, heldIndex, held}
  transportRolls: 0,
  action: null,          // 'bergauf'|'bergab'|'pause'
  descentRolled: false,
  descentValue: 0,
  eventRolled: false,
  eventIndex: -1,
  jokerUsedOnEvent: false,
  history: [],
  roundSnapshots: [],    // [{round, time, points:[{name,pts}]}] — one entry per completed round
  gameStarted: false,    // true once a game is actively running
  playedThisRound: [],   // indices of players who have already played in the current round
  diceRolled: false,     // true once any dice have been rolled this turn — locks action switching and fresh re-rolls
  gameFinished: false,   // true once all rounds are completed — blocks Zug and Sonder tabs
};

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
function initDefaultPlayers() {
  const setupList = document.getElementById('playerSetupList');
  setupList.innerHTML = '';
  ['Spieler 1','Spieler 2'].forEach(n => addPlayerField(n));
}

function addPlayerField(name) {
  const setupList = document.getElementById('playerSetupList');
  const idx = setupList.children.length;
  if (idx >= 6) return;
  const row = document.createElement('div');
  row.className = 'player-setup-row';
  row.innerHTML = `
    <div class="player-color-dot" style="background:${PLAYER_COLORS[idx]}"></div>
    <input type="text" class="form-input player-name-input" value="${name||'Spieler '+(idx+1)}" placeholder="Name">
    <button class="btn btn-danger" style="padding:6px 10px;font-size:0.85rem;" onclick="this.parentElement.remove()">✕</button>
  `;
  setupList.appendChild(row);
}

function startGame() {
  closeModal('resetModal');
  const names = [...document.querySelectorAll('.player-name-input')].map(i=>i.value.trim()).filter(Boolean);
  if (names.length === 0) { alert('Mindestens einen Spieler eingeben!'); return; }
  const rounds = parseInt(document.getElementById('setupRounds').value)||20;
  const startH = parseInt(document.getElementById('setupStartTime').value)||8;
  state.players = names.map((n,i)=>({
    name:n, color:PLAYER_COLORS[i], points:0, joker:0, gratis:0, sightings:0, pauseDone:false, skipNextTurn:false
  }));
  state.totalRounds = rounds;
  state.startHour = startH;
  state.round = 1;
  state.currentPlayerIndex = 0;
  state.history = [];
  state.roundSnapshots = [];
  state.gameStarted = true;
  state.gameFinished = false;
  state.playedThisRound = [];
  state.diceRolled = false;
  resetTransportState();
  saveState();
  updateAll();
  showTab('tab-turn');
  setAction(null);
}

// ═══════════════════════════════════════
// TABS
// ═══════════════════════════════════════
function showTab(id) {
  // Block access to gameplay tabs until the game has started
  if (!state.gameStarted && (id === 'tab-turn' || id === 'tab-special')) {
    id = 'tab-setup';
  }
  // After the game is finished, Zug and Sonder are locked — scores only
  if (state.gameFinished && (id === 'tab-turn' || id === 'tab-special')) {
    id = 'tab-scores';
  }
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const idx = ['tab-turn','tab-special','tab-scores','tab-setup'].indexOf(id);
  document.querySelectorAll('.tab-btn')[idx]?.classList.add('active');
  if (id === 'tab-scores') updateScoreboard();
  if (id === 'tab-special') updateSpecialTab();
  // Show sticky footer only on the Zug tab (and only when game is active)
  const footer = document.getElementById('stickyFooter');
  if (footer) footer.style.display = (id === 'tab-turn' && state.gameStarted) ? '' : 'none';
}

// ═══════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════
function gameTime() {
  // Each round = 30 min; after all players in a round, clock advances
  const totalMin = (state.startHour * 60) + ((state.round - 1) * 30);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function gameTimeHour() {
  const totalMin = (state.startHour * 60) + ((state.round - 1) * 30);
  return totalMin / 60;
}

// ═══════════════════════════════════════
// PLAYER HELPERS
// ═══════════════════════════════════════
function currentPlayer() { return state.players[state.currentPlayerIndex]; }
function getLevel(pts) {
  if (pts <= 20) return 'anfaenger';
  if (pts <= 70) return 'fortgeschritten';
  return 'profi';
}
function levelLabel(l) {
  return { anfaenger:'Anfänger', fortgeschritten:'Fortgeschritten', profi:'Profi' }[l];
}
function levelBadgeClass(l) {
  return { anfaenger:'level-anfaenger', fortgeschritten:'level-fortgeschritten', profi:'level-profi' }[l];
}

// ═══════════════════════════════════════
// UPDATE UI
// ═══════════════════════════════════════
function updateAll() {
  const p = currentPlayer();
  const t = gameTime();
  const lvl = p ? getLevel(p.points) : 'anfaenger';

  // Header
  document.getElementById('gameClock').textContent = t;
  document.getElementById('roundLabel').textContent = `Runde ${state.round} von ${state.totalRounds}`;
  document.getElementById('currentPlayerHeader').textContent = p ? p.name : '—';
  document.getElementById('currentPlayerDot').style.background = p ? p.color : '';
  document.getElementById('currentPlayerPoints').textContent = p ? p.points : 0;
  const badge = document.getElementById('levelBadge');
  badge.textContent = levelLabel(lvl);
  badge.className = 'level-badge ' + levelBadgeClass(lvl);

  // Player strip
  const strip = document.getElementById('playerStrip');
  strip.innerHTML = '';
  state.players.forEach((pl, i) => {
    const isCurrent = i === state.currentPlayerIndex;
    const isDone = (state.playedThisRound || []).includes(i);
    const chip = document.createElement('button');
    let cls = 'player-chip';
    if (isCurrent) cls += ' active';
    if (isDone && !isCurrent) cls += ' done';
    chip.className = cls;
    chip.setAttribute('aria-label', `${pl.name}: ${pl.points} Punkte${isDone && !isCurrent ? ' – Zug gespielt' : ''}`);
    if (isDone && !isCurrent) {
      chip.setAttribute('aria-disabled', 'true');
      chip.innerHTML = `<span class="chip-done-mark" aria-hidden="true">✓</span>${pl.name} <span class="chip-pts">${pl.points} Pkt</span>`;
      chip.onclick = null;
    } else {
      chip.innerHTML = `${pl.name} <span class="chip-pts">${pl.points} Pkt</span>`;
      chip.style.borderColor = pl.color;
      if (isCurrent) chip.style.background = pl.color;
      // Chips are display-only — current player is managed by endTurn() only.
      // Clicking a non-done, non-current chip is disabled to prevent players from
      // jumping the queue or re-activating themselves after their turn (BUG-6).
      chip.onclick = null;
    }
    strip.appendChild(chip);
  });

  updateCoinsDisplay();
  updateHistory();

  // Re-apply dice-roll lock on every UI refresh so it survives any re-render
  if (state.diceRolled) lockActionButtons();

  // Enable/disable gameplay tabs based on whether the game has started / finished
  const tabBtns = document.querySelectorAll('.tab-btn');
  // tabBtns[0]=Zug, [1]=Sonder, [2]=Punkte, [3]=Setup
  if (tabBtns[0]) tabBtns[0].disabled = !state.gameStarted || state.gameFinished;
  if (tabBtns[1]) tabBtns[1].disabled = !state.gameStarted || state.gameFinished;

  // Sync sticky footer visibility
  const footer = document.getElementById('stickyFooter');
  if (footer) {
    const onZugTab = document.getElementById('tab-turn')?.classList.contains('active');
    footer.style.display = (onZugTab && state.gameStarted) ? '' : 'none';
  }
  updatePrimaryActionButton();

  // Scores tab (if visible)
  if (document.getElementById('tab-scores').classList.contains('active')) updateScoreboard();
  if (document.getElementById('tab-special').classList.contains('active')) updateSpecialTab();
}

// ═══════════════════════════════════════
// ACTION SELECTION
// ═══════════════════════════════════════
function setAction(a) {
  state.action = a;

  // Once dice have been rolled, the player cannot switch actions
  const locked = state.diceRolled;

  ['bergauf','bergab','pause'].forEach(x => {
    const btn = document.getElementById('action'+x.charAt(0).toUpperCase()+x.slice(1));
    if (!btn) return;
    if (a === null) {
      btn.classList.remove('btn-action-selected', 'btn-action-unselected');
    } else if (x === a) {
      btn.classList.add('btn-action-selected');
      btn.classList.remove('btn-action-unselected');
    } else {
      btn.classList.add('btn-action-unselected');
      btn.classList.remove('btn-action-selected');
    }
    // Disable all action buttons once a roll has happened
    btn.disabled = locked;
  });

  document.getElementById('sectionBergauf').style.display      = a==='bergauf' ? '' : 'none';
  document.getElementById('sectionBergabShort').style.display  = a==='bergab'  ? '' : 'none';
  document.getElementById('sectionPause').style.display        = a==='pause'   ? '' : 'none';
  document.getElementById('cardExtraaktivitaet').style.display = a==='bergab'  ? '' : 'none';

  updatePrimaryActionButton();

  if (a === 'bergauf') resetTransportDice();
  if (a === 'bergab')  resetDescentDice();
  if (a === 'pause') {
    const p = currentPlayer();
    document.getElementById('pauseCurrentTime').textContent = gameTime();
    const h = gameTimeHour();
    const inWindow = h >= 11 && h <= 12.5;
    const alreadyDone = p ? p.pauseDone : false;

    document.getElementById('pauseTimeWarning').style.display = (!inWindow && !alreadyDone) ? '' : 'none';
    document.getElementById('pauseDoneWarning').style.display = alreadyDone ? '' : 'none';

    const disabled = !inWindow || alreadyDone;
    document.getElementById('btnPauseRestaurant').disabled = disabled;
    document.getElementById('btnPauseBar').disabled        = disabled;
  }
}


// ═══════════════════════════════════════
// PRIMARY ACTION BUTTON (sticky footer)
// ═══════════════════════════════════════

// Computes the correct label, style, and enabled state for the sticky footer button.
// Called from setAction(), updateConfirmButtonLabel(), rollBothDice(), confirmDescentPoints(),
// takePause(), and updateAll().
//
// Button states:
//   - No action:                         "Aktion wählen …"   [disabled, neutral]
//   - Bergauf: not yet rolled:           "Zug beenden →"     [disabled, neutral hint]
//   - Bergauf: rolled:                   "Zug beenden →"     [enabled, green]
//   - Bergab: not yet rolled:            "Erst würfeln …"    [disabled, neutral]
//   - Bergab: rolled, Unfall/Helikopter: "Bestätigen & weiter →" [enabled, orange]
//   - Bergab: rolled, OhneBefugnis pending: "Erst Rot/Grün würfeln" [disabled, warn]
//   - Bergab: rolled, crossings chosen:  "X Punkte & weiter →" [enabled, green]
//   - Bergab: rolled, no slope chosen:   "Weiter (0 Punkte) →" [enabled, muted-green]
//   - Pause: selected, not confirmed:    "Pause wählen…"     [disabled]
//   - Pause: confirmed (pauseDone):      "Zug beenden →"     [enabled, green]
function updatePrimaryActionButton() {
  const btn = document.getElementById('btnPrimaryAction');
  if (!btn) return;

  const a = state.action;

  // Helper to set button appearance
  function set(label, enabled, style) {
    btn.textContent = label;
    btn.disabled = !enabled;
    btn.className = 'btn btn-full ' + (style || 'btn-success');
  }

  if (!a) {
    set('Aktion wählen …', false, 'btn-neutral');
    return;
  }

  if (a === 'bergauf') {
    if (!state.diceRolled) {
      set('Zug beenden →', false, 'btn-neutral');
    } else {
      set('Zug beenden → Nächster Spieler', true, 'btn-success');
    }
    return;
  }

  if (a === 'pause') {
    const p = currentPlayer();
    if (p && p.pauseDone) {
      set('Zug beenden → Nächster Spieler', true, 'btn-success');
    } else {
      set('Pause wählen …', false, 'btn-neutral');
    }
    return;
  }

  if (a === 'bergab') {
    if (!state.diceRolled) {
      set('Erst würfeln …', false, 'btn-neutral');
      return;
    }
    const ev = state.eventIndex >= 0 ? EVENT_FACES[state.eventIndex] : null;
    const isBlockedEvent = (ev?.sym === 'unfall' || ev?.sym === 'helikopter') && !state.jokerUsedOnEvent;
    if (isBlockedEvent) {
      const label = ev.sym === 'unfall' ? 'Unfall bestätigen & weiter →' : 'Helikopter bestätigen & weiter →';
      set(label, true, 'btn-warn');
      return;
    }
    // Check if Ohne-Befugnis roll is still required
    const confirmBtn = document.getElementById('btnConfirmDescent');
    if (confirmBtn && confirmBtn.disabled && confirmBtn.textContent.startsWith('⚠')) {
      set('Erst Rot/Grün würfeln', false, 'btn-warn');
      return;
    }
    // Compute point total
    const { total, parts } = calcDescentTotal();
    if (parts.length === 0) {
      set('Weiter (0 Punkte) →', true, 'btn-success');
    } else if (total < 0) {
      set(`${Math.abs(total)} Punkte entfernen & weiter →`, true, 'btn-warn');
    } else {
      set(`${total} Punkte eintragen & weiter →`, true, 'btn-success');
    }
    return;
  }
}

// Single handler for the sticky footer button.
// For Bergab it calls confirmDescentPoints() first, then endTurn() after a brief flash.
// For all other actions it calls endTurn() directly.
function handlePrimaryAction() {
  const a = state.action;
  const btn = document.getElementById('btnPrimaryAction');

  if (a === 'bergab' && state.diceRolled) {
    // Run the confirm logic first
    confirmDescentPoints();

    // Flash feedback then advance turn
    if (btn) {
      btn.disabled = true;
      btn.textContent = '✓ Eingetragen …';
    }
    setTimeout(() => {
      endTurn();
    }, 900);
    return;
  }

  // Bergauf, Pause, or fallback
  endTurn();
}

// Disables the three action-choice buttons (Bergauf / Bergab / Pause) so
// the player cannot switch action mid-turn after rolling dice.
function lockActionButtons() {
  ['Bergauf','Bergab','Pause'].forEach(name => {
    const btn = document.getElementById('action' + name);
    if (btn) btn.disabled = true;
  });
}

// ═══════════════════════════════════════
// TRANSPORT DICE
// ═══════════════════════════════════════
function resetTransportState() {
  state.transportDice = Array(6).fill(null).map(()=>({ sym: TRANSPORT_SYMBOLS[0], held: false }));
  state.transportRolls = 0;
}

function resetTransportDice() {
  resetTransportState();
  renderTransportDice();
  document.getElementById('transportResult').style.display = 'none';
  document.getElementById('btnRollTransport').disabled = false;
  document.getElementById('rollCountLabel').textContent = '(Wurf 1 von 2)';
  updateRollDots();
}

function rollTransportDice() {
  if (state.transportRolls >= 2) return;
  state.transportDice.forEach(d => {
    if (!d.held) {
      d.sym = TRANSPORT_SYMBOLS[Math.floor(Math.random() * 6)];
    }
  });
  state.transportRolls++;

  // Lock action switching after the first roll
  if (!state.diceRolled) {
    state.diceRolled = true;
    lockActionButtons();
    // Disable the Reset button — player cannot undo a roll to switch actions
    const btnReset = document.getElementById('btnResetTransport');
    if (btnReset) btnReset.disabled = true;
  }

  renderTransportDice(true);
  updateRollDots();
  document.getElementById('rollCountLabel').textContent =
    state.transportRolls >= 2 ? '(2 von 2 – fertig)' : '(Wurf 2 von 2)';
  if (state.transportRolls >= 2) {
    document.getElementById('btnRollTransport').disabled = true;
  }
  analyzeTransport();
  updatePrimaryActionButton();
}

function renderTransportDice(animate) {
  const row = document.getElementById('transportDiceRow');
  row.innerHTML = '';
  state.transportDice.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'die die-transport' + (d.held ? ' held' : '');
    el.title = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(d.sym)];
    el.onclick = () => {
      if (state.transportRolls === 0) return;
      d.held = !d.held;
      renderTransportDice(false);
    };
    if (animate && !d.held) {
      animateDieRoll(
        el,
        () => {
          const s = TRANSPORT_SYMBOLS[Math.floor(Math.random() * TRANSPORT_SYMBOLS.length)];
          return dieImg(TRANSPORT_IMGS[s], TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(s)]);
        },
        dieImg(TRANSPORT_IMGS[d.sym], TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(d.sym)])
      );
    } else if (state.transportRolls === 0) {
      el.innerHTML = dieFaceHTML(dieImg(IMG_UNKNOWN, '?'));
    } else {
      el.innerHTML = dieFaceHTML(dieImg(TRANSPORT_IMGS[d.sym], TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(d.sym)]));
    }
    row.appendChild(el);
  });
}

function updateRollDots() {
  document.getElementById('rollDot1').classList.toggle('used', state.transportRolls >= 1);
  document.getElementById('rollDot2').classList.toggle('used', state.transportRolls >= 2);
}

function analyzeTransport() {
  const syms = state.transportDice.map(d => d.sym);
  const counts = {};
  syms.forEach(s => counts[s] = (counts[s]||0) + 1);

  const resultBox = document.getElementById('transportResult');
  resultBox.style.display = '';

  // 6 same → Helikopter
  if (Object.values(counts).some(c => c === 6)) {
    resultBox.className = 'result-box success';
    resultBox.textContent = '🚁 6 gleiche – Helikopterflug! Du kannst beliebig weit fliegen!';
    return;
  }
  // 3 same (and no other pair) → Sonder-Transport
  const triplets = Object.entries(counts).filter(([,c])=>c>=3);
  if (triplets.length > 0 && !Object.values(counts).some(c=>c===2)) {
    const key3 = triplets[0][0];
    const name3 = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(key3)];
    resultBox.className = 'result-box info';
    resultBox.textContent = `🚂 3× ${name3} – Sonder-Transport erlaubt (Transportmittel ohne eigenes Symbol)!`;
    return;
  }
  // Pairs (2 same)
  const pairs = Object.entries(counts).filter(([,c])=>c>=2);
  if (pairs.length > 0) {
    const lines = pairs.map(([key,cnt]) => {
      const name = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(key)];
      return `${name} (${cnt}×)`;
    });
    resultBox.className = 'result-box success';
    resultBox.textContent = '✓ Gültige Beförderung: ' + lines.join('  +  ');
    return;
  }
  // Check 1 + 3 other same
  const singles = Object.entries(counts).filter(([,c])=>c===1);
  const others  = Object.entries(counts).filter(([,c])=>c>=3);
  if (singles.length > 0 && others.length > 0) {
    const sName = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(singles[0][0])];
    const oName = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(others[0][0])];
    resultBox.className = 'result-box success';
    resultBox.textContent = `✓ 1 + 3 gleiche – gültige Kombination! ${sName} kann mit den 3× ${oName} ergänzt werden.`;
    return;
  }
  resultBox.className = 'result-box danger';
  resultBox.textContent = '✗ Keine gültige Kombination – in der Warteschlange bleiben oder Joker einsetzen.';
}

// ═══════════════════════════════════════
// DESCENT
// ═══════════════════════════════════════
function resetDescentDice() {
  const p = currentPlayer();
  if (!p) return;
  const lvl = getLevel(p.points);
  const dd = DESCENT_DICE[lvl];
  const descentDieEl = document.getElementById('descentDie');
  descentDieEl.className = `die ${dd.cls}`;
  descentDieEl.innerHTML = dieFaceHTML(dieImg(IMG_UNKNOWN, '?'));
  document.getElementById('descentDieLegend').textContent = dd.label + ' · ' + dd.faces.join(', ');
  document.getElementById('descentDiceLabel').textContent = dd.label;
  document.getElementById('descentResult').style.display = 'none';
  document.getElementById('eventResult').style.display = 'none';
  document.getElementById('descentPointsCard').style.display = 'none';
  const crossingCounter = document.getElementById('crossingCounter');
  if (crossingCounter) { crossingCounter.classList.remove('counter-full','counter-over'); }
  const usedEl = document.getElementById('crossingUsed');
  if (usedEl) usedEl.textContent = '0';
  const maxEl = document.getElementById('crossingMax');
  if (maxEl) maxEl.textContent = '0';
  const eventDieEl = document.getElementById('eventDie');
  eventDieEl.innerHTML = dieFaceHTML(dieImg(IMG_UNKNOWN, '?'));
  state.descentRolled = false;
  state.eventRolled = false;
  state.descentValue = 0;
  state.eventIndex = -1;
  state.jokerUsedOnEvent = false;
  clearSlopeSelection();
  resetRGAccordions();
  const rollBtn = document.getElementById('btnRollBothDice');
  if (rollBtn) rollBtn.disabled = false;
}

function rollBothDice() {
  // Prevent rolling more than once per turn
  if (state.diceRolled) return;

  const p = currentPlayer();
  const lvl = getLevel(p.points);
  const dd = DESCENT_DICE[lvl];

  // Lock action switching immediately
  state.diceRolled = true;
  lockActionButtons();
  // Disable the Bergab roll button so it cannot be pressed again
  const rollBtn = document.getElementById('btnRollBothDice');
  if (rollBtn) rollBtn.disabled = true;

  // Roll descent die
  const val = dd.faces[Math.floor(Math.random() * dd.faces.length)];
  state.descentValue = val;
  state.descentRolled = true;

  // Roll event die (compute before animating so both dice animate together)
  const idx = Math.floor(Math.random() * EVENT_FACES.length);
  state.eventIndex = idx;
  state.eventRolled = true;
  const ev = EVENT_FACES[idx];

  // Animate descent die — cycle through unique face values, then settle
  const descentEl = document.getElementById('descentDie');
  descentEl.className = `die ${dd.cls}`;
  const uniqueFaces = [...new Set(dd.faces)];
  animateDieRoll(
    descentEl,
    () => dieImg(`${dd.imgPrefix}${uniqueFaces[Math.floor(Math.random() * uniqueFaces.length)]}.svg`, '?'),
    dieImg(`${dd.imgPrefix}${val}.svg`, String(val))
  );

  // Animate event die — cycle through random event faces, then settle
  const eventEl = document.getElementById('eventDie');
  eventEl.className = `die die-event`;
  animateDieRoll(
    eventEl,
    () => { const r = EVENT_FACES[Math.floor(Math.random() * EVENT_FACES.length)]; return dieImg(r.img, r.label); },
    dieImg(ev.img, ev.label)
  );

  // Show results after animation completes
  setTimeout(() => {
    // Show descent result — suppress for events where no descent happens
    const descentRes = document.getElementById('descentResult');
    if (ev.sym === 'helikopter' || ev.sym === 'unfall') {
      descentRes.style.display = 'none';
    } else {
      descentRes.style.display = '';
      descentRes.className = 'result-box info';
      descentRes.textContent = `🎿 Abfahrt: ${val} – du darfst ${val} Kreuzung${val>1?'en':''} passieren.`;
    }

    // Show event result
    const eventRes = document.getElementById('eventResult');
    eventRes.style.display = '';
    eventRes.className = `result-box ${ev.cls}`;
    eventRes.innerHTML = `<b>${ev.label}</b><br>${ev.text}`;

    // Handle automatic coin/bonus effects — use ev.sym for all programmatic checks
    if (ev.sym === 'sonne') {
      p.joker++;
      addHistory(`${p.name}: Sonne → +1 Joker (${p.joker} total)`);
      checkCoinLimit(p);
      updateCoinsDisplay();
    } else if (ev.sym === 'fahrt') {
      p.gratis++;
      checkCoinLimit(p);
      updateCoinsDisplay();
      addHistory(`${p.name}: +1 Fahrt → +1 Gratisfahrt-Münze (${p.gratis} total)`);
    }
    // Pulverschnee bonus is applied at confirmation time via ev.sym check

    // Show points card
    if (ev.sym === 'unfall' || ev.sym === 'helikopter') {
      const jokerBtn = p && p.joker > 0
        ? `<button class="btn btn-warning" style="margin-top:8px;" onclick="useJokerOnEvent()">🃏 Joker nutzen (${p.joker} verfügbar)</button>`
        : '';
      const bannerText = ev.sym === 'unfall'
        ? `🤕 <b>Unfall</b> – Zug aussetzen, keine Abfahrt.`
        : `🚁 <b>Helikopter</b> – Transport ins nächste Tal, keine Abfahrt.`;
      document.getElementById('descentPointsCard').style.display = '';
      document.getElementById('descentEventBanner').innerHTML =
        `<div class="result-box danger" style="margin:0;">${bannerText}${jokerBtn}</div>`;
      document.getElementById('slopeSelector').style.display = 'none';
      document.getElementById('descentPointsPreview').style.display = 'none';
    } else {
      document.getElementById('descentPointsCard').style.display = '';
      renderDescentEventBanner();
      filterSlopesByLevel();
      initSlopeBoxes();
      updateDescentPreview();
      updateOhneBefugnisUI();
    }
    updatePrimaryActionButton();
  }, ROLL_DURATION);
}

function useJokerOnEvent() {
  const p = currentPlayer();
  if (!p || p.joker < 1) return;
  const ev = state.eventIndex >= 0 ? EVENT_FACES[state.eventIndex] : null;
  p.joker--;
  state.jokerUsedOnEvent = true;
  const eventName = ev ? ev.label : 'Ereignis';
  addHistory(`${p.name}: Joker eingesetzt – ${eventName} abgewendet`);
  checkCoinLimit(p);
  updateCoinsDisplay();
  // Show the descent result text now that the event is averted
  const descentRes = document.getElementById('descentResult');
  descentRes.style.display = '';
  descentRes.className = 'result-box info';
  const val = state.descentValue;
  descentRes.textContent = `🎿 Abfahrt: ${val} – du darfst ${val} Kreuzung${val>1?'en':''} passieren.`;
  // Reveal slope selector (re-render banner without the negative effect)
  renderDescentEventBanner();
  filterSlopesByLevel();
  initSlopeBoxes();
  updateDescentPreview();
  updateOhneBefugnisUI();
  updateAll();
}

function renderDescentEventBanner() {
  const ev = state.eventIndex >= 0 ? EVENT_FACES[state.eventIndex] : null;
  let html = '';
  if (ev?.sym === 'schneesturm' && !state.jokerUsedOnEvent) {
    const p = currentPlayer();
    const jokerBtn = p && p.joker > 0
      ? `<button class="btn btn-warning" style="margin-top:6px;font-size:0.8rem;" onclick="useJokerOnEvent()">🃏 Joker nutzen (${p.joker} verfügbar)</button>`
      : '';
    html += `<div class="result-box warning" style="margin:0 0 8px;">⚠ Schneesturm aktiv – nur <b>halbe Punkte</b>!${jokerBtn}</div>`;
  } else if (ev?.sym === 'schneesturm' && state.jokerUsedOnEvent) {
    html += '<div class="result-box success" style="margin:0 0 8px;">🃏 Schneesturm abgewendet – volle Punkte!</div>';
  }
  if (ev?.sym === 'pulverschnee') html += '<div class="result-box success" style="margin:0 0 8px;">❄ Pulverschnee – +5 Bonuspunkte werden addiert!</div>';
  document.getElementById('descentEventBanner').innerHTML = html;
  document.getElementById('slopeSelector').style.display = '';
  document.getElementById('descentPointsPreview').style.display = '';
  // Initialise counter
  const maxEl = document.getElementById('crossingMax');
  if (maxEl) maxEl.textContent = state.descentValue;
  updateCrossingCounter();
}

function updateCrossingCounter() {
  const usedEl = document.getElementById('crossingUsed');
  const counter = document.getElementById('crossingCounter');
  if (!usedEl || !counter) return;
  const used = Object.values(slopeSelection).reduce((a, b) => a + b, 0);
  usedEl.textContent = used;
  counter.classList.remove('counter-full', 'counter-over');
  if (used > state.descentValue) counter.classList.add('counter-over');
  else if (used === state.descentValue && used > 0) counter.classList.add('counter-full');
}

// Returns the set of slope colours allowed for the current player's level
function getAllowedSlopes() {
  const p = currentPlayer();
  const lvl = p ? getLevel(p.points) : 'anfaenger';
  return {
    anfaenger:      ['blue','red'],
    fortgeschritten:['blue','red','black'],
    profi:          ['blue','red','black','yellow']
  }[lvl];
}

function filterSlopesByLevel() {
  const allowed = getAllowedSlopes();
  ['blue','red','black','yellow'].forEach(c => {
    const row = document.getElementById(`slopeRow-${c}`);
    const badge = document.getElementById(`forbiddenBadge-${c}`);
    const isForbidden = !allowed.includes(c);
    row.classList.toggle('slope-forbidden', isForbidden);
    if (badge) badge.style.display = isForbidden ? '' : 'none';
  });
}

function initSlopeBoxes() {
  slopeSelection = { blue: 0, red: 0, black: 0, yellow: 0 };
  ohneBefugnisResult = null;
  const allowed = getAllowedSlopes();

  document.querySelectorAll('.kreuzung-boxes').forEach(group => {
    const color = group.dataset.color;
    const isForbidden = !allowed.includes(color);
    group.querySelectorAll('.kbox').forEach(btn => {
      btn.classList.remove('kbox-active', 'kbox-disabled', 'kbox-forbidden-active');
      btn.onclick = () => {
        const val = parseInt(btn.dataset.val);
        if (btn.classList.contains('kbox-disabled')) return;
        if (slopeSelection[color] === val) {
          slopeSelection[color] = 0;
          btn.classList.remove('kbox-active', 'kbox-forbidden-active');
        } else {
          slopeSelection[color] = val;
          group.querySelectorAll('.kbox').forEach(b => b.classList.remove('kbox-active', 'kbox-forbidden-active'));
          if (isForbidden) {
            btn.classList.add('kbox-forbidden-active');
          } else {
            btn.classList.add('kbox-active');
          }
        }
        updateDescentPreview();
        updateKboxAvailability();
        updateOhneBefugnisUI();
      };
    });
  });
  updateKboxAvailability();
  updateOhneBefugnisUI();
}

// Shows/hides the inline Ohne-Befugnis roll area and toggles the confirm button
function updateOhneBefugnisUI() {
  const allowed = getAllowedSlopes();
  const hasForbiddenSelection = ['blue','red','black','yellow'].some(c => {
    return !allowed.includes(c) && slopeSelection[c] > 0;
  });

  const rollArea = document.getElementById('ohneBefugnisRollArea');
  const confirmBtn = document.getElementById('btnConfirmDescent');
  if (!rollArea || !confirmBtn) return;

  if (hasForbiddenSelection) {
    rollArea.style.display = '';
    // If already rolled, keep confirm enabled; otherwise block it
    if (ohneBefugnisResult === null) {
      confirmBtn.disabled = true;
      confirmBtn.className = 'btn btn-warn';
      confirmBtn.textContent = '⚠ Erst Rot/Grün würfeln';
    } else {
      confirmBtn.disabled = false;
      confirmBtn.className = 'btn btn-success';
      updateConfirmButtonLabel();
    }
  } else {
    rollArea.style.display = 'none';
    // Reset the inline RG die when no forbidden slope is selected
    const dieEl = document.getElementById('rgDieOhneBefugnisInline');
    if (dieEl) {
      dieEl.className = 'die die-rg-neutral';
      dieEl.innerHTML = dieFaceHTML(dieImg('img/die_unknown.svg', '?'));
    }
    const resEl = document.getElementById('ohneBefugnisInlineResult');
    if (resEl) resEl.style.display = 'none';
    ohneBefugnisResult = null;
    confirmBtn.disabled = false;
    confirmBtn.className = 'btn btn-success';
    updateConfirmButtonLabel();
  }
  updatePrimaryActionButton();
}

function updateKboxAvailability() {
  const used = Object.values(slopeSelection).reduce((a, b) => a + b, 0);
  const remaining = state.descentValue - used;

  document.querySelectorAll('.kreuzung-boxes').forEach(group => {
    const color = group.dataset.color;
    const selected = slopeSelection[color];
    group.querySelectorAll('.kbox').forEach(btn => {
      const val = parseInt(btn.dataset.val);
      // A box is reachable if: it's the current selection (always tappable to deselect),
      // or its value <= selected + remaining (we could switch to it without exceeding cap)
      const reachable = (val === selected) || (val <= selected + remaining);
      btn.classList.toggle('kbox-disabled', !reachable);
    });
  });
  updateCrossingCounter();
}

// Returns { total, basePoints, parts, bonusText } for the current descent selection.
// Single source of truth — used by both the preview label and the confirm button.
function calcDescentTotal() {
  let basePoints = 0;
  const parts = [];
  ['blue','red','black','yellow'].forEach(c => {
    const k = slopeSelection[c];
    if (k > 0) {
      const pts = k * SLOPE_PTS[c];
      const label = {blue:'Blau',red:'Rot',black:'Schwarz',yellow:'Gelb'}[c];
      parts.push(`${label} ×${k} = ${pts}`);
      basePoints += pts;
    }
  });

  const ev = state.eventIndex >= 0 ? EVENT_FACES[state.eventIndex] : null;
  let total = basePoints;
  let bonusText = '';
  if (ev?.sym === 'schneesturm' && !state.jokerUsedOnEvent) { total = Math.floor(total / 2); bonusText = ' (÷2 Schneesturm)'; }
  if (ev?.sym === 'pulverschnee') { total += 5; bonusText = ' (+5 Pulverschnee)'; }
  if (ohneBefugnisResult === false) { total = -total; bonusText += ' (Ohne Befugnis: negativ)'; }

  return { total, basePoints, parts, bonusText };
}

function updateDescentPreview() {
  const { total, parts, bonusText } = calcDescentTotal();

  const el = document.getElementById('descentPointsPreview');
  if (parts.length === 0) {
    el.textContent = 'Keine Piste gewählt';
    el.style.color = 'var(--muted)';
  } else {
    el.innerHTML = `${parts.join(' + ')}${bonusText} → <b>${total} Punkte</b>`;
    el.style.color = ohneBefugnisResult === false ? 'var(--piste-red)' : 'var(--glacier-teal)';
  }
  updateConfirmButtonLabel();
}

// Updates the confirm button text to reflect the current point total.
// Positive: "✓ 6 Punkte eintragen"
// Negative: "✓ 5 Punkte entfernen"
// No selection: "✓ Punkte eintragen"
function updateConfirmButtonLabel() {
  const confirmBtn = document.getElementById('btnConfirmDescent');
  if (!confirmBtn) return;
  // Don't overwrite the warning state set by updateOhneBefugnisUI
  if (confirmBtn.textContent.startsWith('⚠')) return;

  const { total, parts } = calcDescentTotal();
  if (parts.length === 0) {
    confirmBtn.textContent = '✓ Punkte eintragen';
  } else if (total < 0) {
    confirmBtn.textContent = `✓ ${Math.abs(total)} Punkte entfernen`;
  } else {
    confirmBtn.textContent = `✓ ${total} Punkte eintragen`;
  }
  updatePrimaryActionButton();
}

function clearSlopeSelection() {
  slopeSelection = { blue: 0, red: 0, black: 0, yellow: 0 };
  document.querySelectorAll('.kbox').forEach(b => b.classList.remove('kbox-active', 'kbox-disabled', 'kbox-forbidden-active'));
  ohneBefugnisResult = null;
  // Reset inline roll area
  const dieInline = document.getElementById('rgDieOhneBefugnisInline');
  if (dieInline) {
    dieInline.className = 'die die-rg-neutral';
    dieInline.innerHTML = dieFaceHTML(dieImg('img/die_unknown.svg', '?'));
  }
  const resInline = document.getElementById('ohneBefugnisInlineResult');
  if (resInline) resInline.style.display = 'none';
  const rollBtn = document.getElementById('btnRollOhneBefugnis');
  if (rollBtn) rollBtn.disabled = false;
  updateDescentPreview();
  updateKboxAvailability();
  updateOhneBefugnisUI();
}

function rollOhneBefugnisInline() {
  const p = currentPlayer();
  const isGreen = Math.random() < 0.5;
  ohneBefugnisResult = isGreen;

  // Disable re-roll button immediately
  const rollBtn = document.getElementById('btnRollOhneBefugnis');
  if (rollBtn) rollBtn.disabled = true;

  const dieEl = document.getElementById('rgDieOhneBefugnisInline');
  dieEl.className = `die ${isGreen ? 'die-rg-green' : 'die-rg-red'}`;
  animateDieRoll(
    dieEl,
    () => { const g = Math.random() < 0.5; return dieImg(g ? 'img/rg_gruen.svg' : 'img/rg_rot.svg', g ? 'Grün' : 'Rot'); },
    dieImg(isGreen ? 'img/rg_gruen.svg' : 'img/rg_rot.svg', isGreen ? 'Grün' : 'Rot')
  );

  setTimeout(() => {
    const resEl = document.getElementById('ohneBefugnisInlineResult');
    resEl.style.display = '';
    if (isGreen) {
      resEl.className = 'result-box success';
      resEl.textContent = '✅ Grün – normale Punkte werden eingetragen.';
    } else {
      resEl.className = 'result-box danger';
      resEl.textContent = '✗ Rot – Punkte werden als negative Werte eingetragen!';
    }
    addHistory(`${p.name}: Ohne Befugnis → ${isGreen ? 'GRÜN → normale Punkte' : 'ROT → negative Punkte'}`);
    updateDescentPreview();
    updateOhneBefugnisUI();
  }, ROLL_DURATION);
}

function confirmDescentPoints() {
  const p = currentPlayer();
  const ev = state.eventIndex >= 0 ? EVENT_FACES[state.eventIndex] : null;

  // Unfall / Helikopter (no Joker used): consume turn and mark next turn as skipped
  if ((ev?.sym === 'unfall' || ev?.sym === 'helikopter') && !state.jokerUsedOnEvent) {
    document.getElementById('descentPointsCard').style.display = 'none';
    const cc = document.getElementById('crossingCounter');
    if (cc) cc.classList.remove('counter-full','counter-over');
    p.skipNextTurn = true;
    const logMsg = ev.sym === 'unfall'
      ? `${p.name}: Unfall – dieser Zug und nächster Zug ausgesetzt`
      : `${p.name}: Helikopter – Transport ins nächste Tal, nächster Zug ausgesetzt`;
    addHistory(logMsg);
    updateAll();
    return;
  }

  let basePoints = 0;
  const parts = [];
  ['blue','red','black','yellow'].forEach(c => {
    const k = slopeSelection[c];
    if (k > 0) {
      const pts = k * SLOPE_PTS[c];
      const label = {blue:'Blau',red:'Rot',black:'Schwarz',yellow:'Gelb'}[c];
      parts.push(`${label}×${k}=${pts}`);
      basePoints += pts;
    }
  });

  let total = basePoints;
  if (ev?.sym === 'schneesturm' && !state.jokerUsedOnEvent) { total = Math.floor(total / 2); }
  if (ev?.sym === 'pulverschnee') { total += 5; }
  const ohneBefugnisRed = ohneBefugnisResult === false;
  if (ohneBefugnisRed) { total = -total; }

  p.points += total;
  const schneesturmActive = ev?.sym === 'schneesturm' && !state.jokerUsedOnEvent;
  const histLine = parts.length > 0
    ? `${p.name}: Abfahrt [${parts.join(', ')}]${schneesturmActive?' (Schneesturm ÷2)':''}${state.jokerUsedOnEvent && ev?.sym==='schneesturm'?' (Joker: Schneesturm abgewendet)':''}${ev?.sym==='pulverschnee'?' (+5 Pulverschnee)':''}${ohneBefugnisRed?' (Ohne Befugnis: negativ)':''} → ${total >= 0 ? '+' : ''}${total} Punkte`
    : `${p.name}: Abfahrt ohne Pisten-Punkte bestätigt`;
  addHistory(histLine);
  saveState();
  updateAll();

  document.getElementById('descentPointsCard').style.display = 'none';
  const crossingCounter = document.getElementById('crossingCounter');
  if (crossingCounter) crossingCounter.classList.remove('counter-full','counter-over');
  const res = document.getElementById('descentResult');
  res.className = 'result-box success';
  res.textContent = total > 0 ? `✓ +${total} Punkte eingetragen!` : '✓ Abfahrt bestätigt (0 Punkte).';
}

// ═══════════════════════════════════════
// ROT/GRÜN ACCORDION PANELS (Zug tab – Bergab)
// ═══════════════════════════════════════

// Tracks the result of the Ohne Befugnis roll for the current descent
// null = not yet rolled, true = green (use positive pts), false = red (negate pts)
let ohneBefugnisResult = null;

function toggleAccordion(which) {
  const body    = document.getElementById('body'    + which.charAt(0).toUpperCase() + which.slice(1));
  const chevron = document.getElementById('chevron' + which.charAt(0).toUpperCase() + which.slice(1));
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (chevron) chevron.textContent = open ? '▸' : '▾';
}

function resetRGAccordions() {
  // Close Extraaktivität panel and reset its die + result
  const bodyExtra = document.getElementById('bodyExtraaktivitaet');
  if (bodyExtra) bodyExtra.style.display = 'none';
  const chevronExtra = document.getElementById('chevronExtraaktivitaet');
  if (chevronExtra) chevronExtra.textContent = '▸';
  const rgDieExtra = document.getElementById('rgDieExtra');
  if (rgDieExtra) {
    rgDieExtra.className = 'die die-rg-neutral';
    rgDieExtra.innerHTML = dieFaceHTML(dieImg('img/die_unknown.svg', '?'));
  }
  const rgResultExtra = document.getElementById('rgResultExtra');
  if (rgResultExtra) rgResultExtra.style.display = 'none';

  // Reset inline Ohne-Befugnis area
  const dieInline = document.getElementById('rgDieOhneBefugnisInline');
  if (dieInline) {
    dieInline.className = 'die die-rg-neutral';
    dieInline.innerHTML = dieFaceHTML(dieImg('img/die_unknown.svg', '?'));
  }
  const resInline = document.getElementById('ohneBefugnisInlineResult');
  if (resInline) resInline.style.display = 'none';
  const rollBtn = document.getElementById('btnRollOhneBefugnis');
  if (rollBtn) rollBtn.disabled = false;
  const rollArea = document.getElementById('ohneBefugnisRollArea');
  if (rollArea) rollArea.style.display = 'none';

  ohneBefugnisResult = null;
}

function rollRGInTurn(context) {
  const p = currentPlayer();
  const isGreen = Math.random() < 0.5;

  if (context === 'extraaktivitaet') {
    const dieEl = document.getElementById('rgDieExtra');
    dieEl.className = `die ${isGreen ? 'die-rg-green' : 'die-rg-red'}`;
    animateDieRoll(
      dieEl,
      () => { const g = Math.random() < 0.5; return dieImg(g ? 'img/rg_gruen.svg' : 'img/rg_rot.svg', g ? 'Grün' : 'Rot'); },
      dieImg(isGreen ? 'img/rg_gruen.svg' : 'img/rg_rot.svg', isGreen ? 'Grün' : 'Rot')
    );

    setTimeout(() => {
      const res = document.getElementById('rgResultExtra');
      res.style.display = '';
      if (isGreen) {
        res.className = 'result-box success';
        res.textContent = '✅ Erfolg! +12 Punkte werden eingetragen.';
        p.points += 12;
        saveState();
        updateAll();
        addHistory(`${p.name}: Extraaktivität → GRÜN → +12 Punkte`);
      } else {
        res.className = 'result-box danger';
        res.textContent = '✗ Nicht gemeistert – 0 Punkte.';
        addHistory(`${p.name}: Extraaktivität → ROT → 0 Punkte`);
      }
    }, ROLL_DURATION);
  }
}

// ═══════════════════════════════════════
// SPECIAL TAB
// ═══════════════════════════════════════
function updateSpecialTab() {
  const p = currentPlayer();
  if (!p) return;
  document.getElementById('jokerCount').textContent = p.joker;
  document.getElementById('gratisCount').textContent = p.gratis;
  updateSightingsDisplay();
}


function rollRGDie(context) {
  const isGreen = Math.random() < 0.5;
  const dieEl = document.getElementById('rgDie');
  dieEl.className = `die ${isGreen ? 'die-rg-green' : 'die-rg-red'} rolling`;
  dieEl.innerHTML = dieImg(isGreen ? 'img/rg_gruen.svg' : 'img/rg_rot.svg', isGreen ? 'Grün' : 'Rot');
  dieEl.addEventListener('animationend', () => dieEl.classList.remove('rolling'), {once:true});

  const res = document.getElementById('rgResult');
  res.style.display = '';
  const p = currentPlayer();

  if (context === 'extraaktivitaet') {
    if (isGreen) {
      res.className = 'result-box success';
      res.textContent = '✅ Erfolg! Extraaktivität gemeistert: +12 Punkte!';
    } else {
      res.className = 'result-box danger';
      res.textContent = '✗ Nicht gemeistert – 0 Punkte. Piste bis Ende fahren.';
    }
  } else if (context === 'ohne_befugnis') {
    if (isGreen) {
      res.className = 'result-box success';
      res.textContent = '✅ Erfolg! Piste erfolgreich befahren – normale Punkte.';
    } else {
      res.className = 'result-box danger';
      res.textContent = '✗ Fehlschlag! Negative Punkte in Höhe der normalen Pistenwertung!';
    }
  } else {
    res.className = isGreen ? 'result-box success' : 'result-box danger';
    res.textContent = isGreen ? '✅ Grün – Erfolg!' : '✗ Rot – Fehlschlag / negative Konsequenz.';
  }

  addHistory(`${p?.name||'?'}: Rot/Grün-Würfel (${context}) → ${isGreen?'GRÜN':'ROT'}`);
}

function addSighting() {
  const p = currentPlayer();
  if (!p) return;
  p.sightings++;
  // Points: 5, 10, 15, 20, 25 ...
  const pts = p.sightings * 5;
  p.points += pts;
  saveState();
  updateAll();
  updateSightingsDisplay();
  addHistory(`${p.name}: Sehenswürdigkeit #${p.sightings} → +${pts} Punkte`);
  const msg = `✓ Sehenswürdigkeit #${p.sightings} eingetragen: +${pts} Punkte`;
  const res = document.createElement('div');
  res.className = 'result-box success';
  res.textContent = msg;
  res.style.marginTop = '8px';
  const btn = document.querySelector('#tab-special .btn-success');
  btn.parentElement.appendChild(res);
  setTimeout(() => res.remove(), 3000);
}

function updateSightingsDisplay() {
  const p = currentPlayer();
  if (!p) return;
  const el = document.getElementById('sightingsDisplay');
  if (p.sightings === 0) {
    el.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Noch keine passiert.</span>';
    return;
  }
  let html = '';
  for (let i=1; i<=p.sightings; i++) {
    const pts = i * 5;
    html += `<span style="background:#DDF0F0;color:#1F5F60;padding:3px 9px;border-radius:50px;font-size:0.78rem;font-weight:600;margin:2px;display:inline-block;">🏔 #${i}: +${pts} Pkt</span>`;
  }
  el.innerHTML = html;
}

function adjustPoints(sign) {
  const p = currentPlayer();
  if (!p) return;
  const val = parseInt(document.getElementById('manualPoints').value)||0;
  const delta = sign * val;
  p.points += delta;
  saveState();
  updateAll();
  const label = delta >= 0 ? `+${delta}` : `${delta}`;
  addHistory(`${p.name}: Manuelle Anpassung ${label} Punkte → ${p.points} Pkt gesamt`);
  document.getElementById('manualResult').textContent = `✓ ${p.name}: ${label} Punkte eingetragen (${p.points} gesamt)`;
}

function adjustCoins(type, delta) {
  const p = currentPlayer();
  if (!p) return;
  if (type === 'joker') p.joker = Math.max(0, p.joker + delta);
  if (type === 'gratis') p.gratis = Math.max(0, p.gratis + delta);
  checkCoinLimit(p);
  saveState();
  updateCoinsDisplay();
  updateAll();
}

function checkCoinLimit(p) {
  const total = p.joker + p.gratis;
  if (total >= 3) {
    // Rule: as soon as a player has 3 coins simultaneously, all are returned
    const returned = p.joker + p.gratis;
    p.joker  = 0;
    p.gratis = 0;
    addHistory(`${p.name}: 3 Münzen erreicht – alle ${returned} Münze(n) zurückgegeben`);
  }
}

function updateCoinsDisplay() {
  const p = currentPlayer();
  if (!p) return;
  document.getElementById('jokerCount').textContent  = p.joker;
  document.getElementById('gratisCount').textContent = p.gratis;
}

// ═══════════════════════════════════════
// PAUSE
// ═══════════════════════════════════════
function takePause(type) {
  const p = currentPlayer();
  if (!p) return;
  const h = gameTimeHour();
  if (!(h >= 11 && h <= 12.5)) return; // buttons are disabled; guard against direct JS calls
  if (p.pauseDone) return;
  const pts = type === 'restaurant' ? 15 : 7;
  p.points += pts;
  p.pauseDone = true;
  addHistory(`${p.name}: Mittagspause (${type==='restaurant'?'Restaurant':'Bar'}) → +${pts} Punkte`);
  saveState();
  updateAll();
  // Lock buttons immediately — pauseDone is now true
  document.getElementById('btnPauseRestaurant').disabled = true;
  document.getElementById('btnPauseBar').disabled        = true;
  document.getElementById('pauseDoneWarning').style.display = '';
  document.getElementById('pauseTimeWarning').style.display = 'none';
  const sectionPause = document.getElementById('sectionPause');
  const msg = document.createElement('div');
  msg.className = 'result-box success';
  msg.textContent = `✓ ${type==='restaurant'?'Restaurant':'Bar'}: +${pts} Punkte!`;
  msg.style.marginTop = '8px';
  sectionPause.appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
  updatePrimaryActionButton();
}

// ═══════════════════════════════════════
// END TURN
// ═══════════════════════════════════════
function endTurn() {
  const p = currentPlayer();
  addHistory(`── ${p?.name||'?'}: Zug beendet (${gameTime()})`);

  // Mark this player as having played this round
  if (!state.playedThisRound) state.playedThisRound = [];
  if (!state.playedThisRound.includes(state.currentPlayerIndex)) {
    state.playedThisRound.push(state.currentPlayerIndex);
  }

  // Advance to next player; if all played → advance round
  state.currentPlayerIndex++;
  if (state.currentPlayerIndex >= state.players.length) {
    state.currentPlayerIndex = 0;
    state.playedThisRound = []; // clear for the new round
    // Snapshot points at the end of this completed round
    if (!state.roundSnapshots) state.roundSnapshots = [];
    state.roundSnapshots.push({
      round: state.round,
      time: gameTime(),
      points: state.players.map(p => ({ name: p.name, pts: p.points }))
    });
    state.round++;
    if (state.round > state.totalRounds) {
      state.round = state.totalRounds;
      showGameEnd();
    }
  }

  // Skip next turn for Unfall / Helikopter: auto-advance past this player and log it
  const nextP = state.players[state.currentPlayerIndex];
  if (nextP && nextP.skipNextTurn) {
    nextP.skipNextTurn = false;
    addHistory(`── ${nextP.name}: Zug übersprungen (Unfall / Helikopter)`);
    state.currentPlayerIndex++;
    if (state.currentPlayerIndex >= state.players.length) {
      state.currentPlayerIndex = 0;
      state.playedThisRound = [];
      // Snapshot points at the end of this completed round (skip path)
      if (!state.roundSnapshots) state.roundSnapshots = [];
      state.roundSnapshots.push({
        round: state.round,
        time: gameTime(),
        points: state.players.map(p => ({ name: p.name, pts: p.points }))
      });
      state.round++;
      if (state.round > state.totalRounds) {
        state.round = state.totalRounds;
        showGameEnd();
      }
    }
  }
  resetTransportState();
  renderTransportDice(false);
  // Reset transient descent state so the next player starts clean
  state.descentRolled = false;
  state.eventRolled = false;
  state.descentValue = 0;
  state.eventIndex = -1;
  state.jokerUsedOnEvent = false;
  state.action = null;
  state.diceRolled = false;  // unlock for the next player's turn
  ohneBefugnisResult = null;
  saveState();
  setAction(null);
  updateAll();
}

function showGameEnd() {
  state.gameFinished = true;
  saveState();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `<div class="modal">
    <h2><img src="img/logo_abaufdiepiste.png" alt="" style="height:28px;width:28px;object-fit:contain;border-radius:5px;vertical-align:middle;margin-right:6px;"> Spielende!</h2>
    <p>Der Skitag ist vorbei! Jetzt Schlusswertung durchführen (Tab <b>Punkte</b>).</p>
    <div class="btn-row"><button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove();showTab('tab-scores')">Zur Schlusswertung</button></div>
  </div>`;
  document.body.appendChild(overlay);
}

// ═══════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════
function addHistory(text) {
  state.history.unshift({ time: gameTime(), text });
  saveState();
  updateHistory();
}
function updateHistory() {
  const list = document.getElementById('turnHistory');
  if (state.history.length === 0) {
    list.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;padding:8px;">Noch keine Züge.</div>';
    return;
  }
  list.innerHTML = state.history.slice(0,30).map(h =>
    `<div class="history-item"><span class="history-time">${h.time}</span><span class="history-text">${h.text}</span></div>`
  ).join('');
}

// ═══════════════════════════════════════
// PUNKTVERLAUF
// ═══════════════════════════════════════
function updatePunktverlauf() {
  const snapshots = state.roundSnapshots || [];
  const players   = state.players || [];
  const head      = document.getElementById('punktverlaufHead');
  const body      = document.getElementById('punktverlaufBody');
  const card      = document.getElementById('punktverlaufCard');

  if (!head || !body) return;

  if (card) card.style.display = '';

  if (snapshots.length === 0) {
    head.innerHTML = '';
    body.innerHTML = '<tr><td style="text-align:center;color:var(--muted);font-size:0.85rem;padding:16px 0;">Noch keine Runden gespielt – der Punktverlauf erscheint hier nach der ersten Runde.</td></tr>';
    return;
  }

  // Header row: Zeit | Player 1 | Player 2 | …
  head.innerHTML = '<tr><th>Zeit</th>' +
    players.map(p =>
      `<th><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:5px;vertical-align:middle;"></span>${p.name}</th>`
    ).join('') +
    '</tr>';

  // One row per completed round snapshot
  body.innerHTML = snapshots.map((snap, idx) => {
    const prevSnap = snapshots[idx - 1];
    const cells = players.map(p => {
      const total = snap.points.find(e => e.name === p.name)?.pts ?? 0;
      const prev  = prevSnap
        ? (prevSnap.points.find(e => e.name === p.name)?.pts ?? 0)
        : 0;
      const delta = total - prev;
      const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
      const deltaColor = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--piste-red)' : 'var(--muted)';
      return `<td style="text-align:center;">
        <span style="font-weight:600;">${total}</span>
        <span style="font-size:0.75rem;color:${deltaColor};margin-left:3px;">(${deltaStr})</span>
      </td>`;
    }).join('');
    return `<tr><td style="white-space:nowrap;color:var(--muted);font-size:0.82rem;">${snap.time}</td>${cells}</tr>`;
  }).join('');
}

// ═══════════════════════════════════════
// SCOREBOARD
// ═══════════════════════════════════════
function updateScoreboard() {
  document.getElementById('scoreRound').textContent = `${state.round} / ${state.totalRounds}`;
  document.getElementById('scoreTime').textContent  = gameTime();

  updatePunktverlauf();

  const sorted = [...state.players].sort((a,b) => b.points - a.points);
  const body = document.getElementById('scoreBody');
  body.innerHTML = '';
  sorted.forEach(pl => {
    const lvl = getLevel(pl.points);
    const isCurrent = pl === currentPlayer();
    const tr = document.createElement('tr');
    if (isCurrent) tr.className = 'current-player';
    tr.innerHTML = `
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${pl.color};margin-right:7px;"></span>${pl.name}</td>
      <td><span class="level-badge ${levelBadgeClass(lvl)}">${levelLabel(lvl)}</span></td>
      <td style="font-size:1rem;font-weight:800;">${pl.points}</td>
      <td>🃏${pl.joker}</td>
      <td>🎟${pl.gratis}</td>
    `;
    body.appendChild(tr);
  });
}

// ═══════════════════════════════════════
// RESET
// ═══════════════════════════════════════
function confirmStart() {
  document.getElementById('resetModal').classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ═══════════════════════════════════════
// PERSISTENCE (localStorage)
// ═══════════════════════════════════════
const STORAGE_KEY = 'abaufdiepiste_state';

function saveState() {
  try {
    // We don't persist transient dice/UI state – only the durable game state
    const toSave = {
      players:            state.players,
      currentPlayerIndex: state.currentPlayerIndex,
      round:              state.round,
      totalRounds:        state.totalRounds,
      startHour:          state.startHour,
      history:            state.history,
      gameStarted:        state.gameStarted,
      playedThisRound:    state.playedThisRound || [],
      diceRolled:         state.diceRolled || false,
      roundSnapshots:     state.roundSnapshots || [],
      gameFinished:       state.gameFinished || false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    // Basic sanity check
    if (!saved.players || !Array.isArray(saved.players) || saved.players.length === 0) return false;
    Object.assign(state, saved);
    // Backwards compatibility: fields may be missing in older saves
    if (!Array.isArray(state.playedThisRound)) state.playedThisRound = [];
    if (typeof state.diceRolled !== 'boolean') state.diceRolled = false;
    if (!Array.isArray(state.roundSnapshots)) state.roundSnapshots = [];
    if (typeof state.gameFinished !== 'boolean') state.gameFinished = false;
    state.players.forEach(p => { if (typeof p.skipNextTurn !== 'boolean') p.skipNextTurn = false; });
    return true;
  } catch (e) {
    console.warn('Could not load state:', e);
    return false;
  }
}

function clearSavedState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
}

// ═══════════════════════════════════════
// BOOT
// ═══════════════════════════════════════
initDefaultPlayers();
const restored = loadState();
if (restored && state.gameStarted) {
  // Resume saved game
  resetTransportState();
  updateAll();
  setAction(null);
  showTab(state.gameFinished ? 'tab-scores' : 'tab-turn');
} else {
  // Fresh start – go to setup
  showTab('tab-setup');
}
