// ═══════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════
const TRANSPORT_SYMBOLS = ['fussweg','kleingondel','skilift','sesselbahn','gondel','zug'];
const TRANSPORT_IMGS    = {
  fussweg:    'img/transport_fussweg.svg',
  kleingondel:'img/transport_kleingondel.svg',
  skilift:    'img/transport_skilift.svg',
  sesselbahn: 'img/transport_sesselbahn.svg',
  gondel:     'img/transport_gondel.svg',
  zug:        'img/transport_zug.svg',
};
const TRANSPORT_NAMES   = ['Fußweg','Kleingondel','Skilift','Sesselbahn','Gondel','Zug/Bus'];
const EVENT_FACES = [
  { sym:'fahrt',       img:'img/event_fahrt.svg',       label:'+1 Fahrt',    cls:'success', text:'+1 Fahrt: Du erhältst eine Gratisfahrt-Münze! 🎟' },
  { sym:'helikopter',  img:'img/event_helikopter.svg',  label:'Helikopter',  cls:'warning', text:'Helikopter: Transport ins nächste Tal – neu starten! 🚁' },
  { sym:'schneesturm', img:'img/event_schneesturm.svg', label:'Schneesturm', cls:'danger',  text:'Schneesturm: Nur halbe Punkte für diese Abfahrt! ❄' },
  { sym:'pulverschnee',img:'img/event_pulverschnee.svg',label:'Pulverschnee',cls:'success', text:'Pulverschnee: +5 Bonuspunkte! 🎉' },
  { sym:'unfall',      img:'img/event_unfall.svg',      label:'Unfall',      cls:'danger',  text:'Unfall: Keine Abfahrt möglich – Zug aussetzen. Joker einsetzbar!' },
  { sym:'sonne',       img:'img/event_sonne.svg',       label:'Sonne',       cls:'success', text:'Sonne: 1 Joker erhalten! 🃏' }
];
const DESCENT_DICE = {
  anfaenger:      { faces:[1,1,2,2,3,3], cls:'die-descent-red',    label:'🔴 Anfänger',      imgPrefix:'img/descent_anfaenger_' },
  fortgeschritten:{ faces:[2,2,3,3,4,4], cls:'die-descent-black',  label:'⚫ Fortgeschritten', imgPrefix:'img/descent_fortgeschritten_' },
  profi:          { faces:[3,3,4,4,6,6], cls:'die-descent-yellow', label:'🟡 Profi',          imgPrefix:'img/descent_profi_' }
};
const IMG_UNKNOWN = 'img/die_unknown.svg';

function dieImg(src, alt) {
  return `<img src="${src}" alt="${alt}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;">`;
}
const SLOPE_PTS = { blue: 2, red: 4, black: 6, yellow: 8 };
// Tracks selected Kreuzungen per slope colour: { blue: 0, red: 0, black: 0, yellow: 0 }
let slopeSelection = { blue: 0, red: 0, black: 0, yellow: 0 };
const PLAYER_COLORS = ['#2e6da4','#e05252','#4caf50','#ff9800','#9c27b0','#00bcd4'];

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
  descentPtsAccumulated: 0,
  history: [],
  gameStarted: false,    // true once a game is actively running
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
  const names = [...document.querySelectorAll('.player-name-input')].map(i=>i.value.trim()).filter(Boolean);
  if (names.length === 0) { alert('Mindestens einen Spieler eingeben!'); return; }
  const rounds = parseInt(document.getElementById('setupRounds').value)||20;
  const startH = parseInt(document.getElementById('setupStartTime').value)||8;
  state.players = names.map((n,i)=>({
    name:n, color:PLAYER_COLORS[i], points:0, joker:0, gratis:0, sightings:0, pauseDone:false
  }));
  state.totalRounds = rounds;
  state.startHour = startH;
  state.round = 1;
  state.currentPlayerIndex = 0;
  state.history = [];
  state.gameStarted = true;
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
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const idx = ['tab-turn','tab-special','tab-scores','tab-setup'].indexOf(id);
  document.querySelectorAll('.tab-btn')[idx]?.classList.add('active');
  if (id === 'tab-scores') updateScoreboard();
  if (id === 'tab-special') updateSpecialTab();
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

  // Turn tab
  if (p) {
    document.getElementById('currentPlayerName').textContent = p.name;
    document.getElementById('currentPlayerDot').style.background = p.color;
    document.getElementById('currentPlayerPoints').textContent = p.points;
    const badge = document.getElementById('levelBadge');
    badge.textContent = levelLabel(lvl);
    badge.className = 'level-badge ' + levelBadgeClass(lvl);
  }

  // Player strip
  const strip = document.getElementById('playerStrip');
  strip.innerHTML = '';
  state.players.forEach((pl, i) => {
    const chip = document.createElement('button');
    chip.className = 'player-chip' + (i === state.currentPlayerIndex ? ' active' : '');
    chip.innerHTML = `${pl.name} <span class="chip-pts">${pl.points} Pkt</span>`;
    chip.style.borderColor = pl.color;
    if (i === state.currentPlayerIndex) chip.style.background = pl.color;
    chip.onclick = () => { state.currentPlayerIndex = i; updateAll(); };
    strip.appendChild(chip);
  });

  updateCoinsDisplay();
  updateHistory();

  // Scores tab (if visible)
  if (document.getElementById('tab-scores').classList.contains('active')) updateScoreboard();
  if (document.getElementById('tab-special').classList.contains('active')) updateSpecialTab();
}

// ═══════════════════════════════════════
// ACTION SELECTION
// ═══════════════════════════════════════
function setAction(a) {
  state.action = a;
  ['bergauf','bergab','pause'].forEach(x => {
    const btn = document.getElementById('actionB'+x.charAt(0).toUpperCase()+x.slice(1));
    if (!btn) return;
    if (a === null) {
      // No action chosen yet — all buttons look normal
      btn.classList.remove('btn-action-selected', 'btn-action-unselected');
    } else if (x === a) {
      btn.classList.add('btn-action-selected');
      btn.classList.remove('btn-action-unselected');
    } else {
      btn.classList.add('btn-action-unselected');
      btn.classList.remove('btn-action-selected');
    }
  });
  document.getElementById('sectionBergauf').style.display      = a==='bergauf' ? '' : 'none';
  document.getElementById('sectionBergabShort').style.display  = a==='bergab'  ? '' : 'none';
  document.getElementById('sectionPause').style.display        = a==='pause'   ? '' : 'none';

  // Enable/disable "Zug beenden" based on whether an action was chosen
  const btnEnd = document.getElementById('btnEndTurn');
  if (btnEnd) btnEnd.disabled = (a === null);

  if (a === 'bergauf') resetTransportDice();
  if (a === 'bergab')  resetDescentDice();
  if (a === 'pause') {
    document.getElementById('pauseCurrentTime').textContent = gameTime();
    const h = gameTimeHour();
    const inWindow = h >= 11 && h < 12.5;
    document.getElementById('pauseTimeWarning').style.display = inWindow ? 'none' : '';
  }
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
  state.transportDice.forEach((d, i) => {
    if (!d.held) {
      d.sym = TRANSPORT_SYMBOLS[Math.floor(Math.random() * 6)];
    }
  });
  state.transportRolls++;
  renderTransportDice(true);
  updateRollDots();
  document.getElementById('rollCountLabel').textContent =
    state.transportRolls >= 2 ? '(2 von 2 – fertig)' : '(Wurf 2 von 2)';
  if (state.transportRolls >= 2) {
    document.getElementById('btnRollTransport').disabled = true;
  }
  analyzeTransport();
}

function renderTransportDice(animate) {
  const row = document.getElementById('transportDiceRow');
  row.innerHTML = '';
  state.transportDice.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'die die-transport' + (d.held ? ' held' : '') + (animate && !d.held ? ' rolling' : '');
    el.innerHTML = dieImg(TRANSPORT_IMGS[d.sym], TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(d.sym)]);
    el.title = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(d.sym)];
    el.onclick = () => {
      if (state.transportRolls === 0) return;
      d.held = !d.held;
      renderTransportDice(false);
    };
    if (animate && !d.held) el.addEventListener('animationend', () => el.classList.remove('rolling'));
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
  // 3 same → Sonder-Transport (Zug/Bus etc.)
  const triplets = Object.entries(counts).filter(([,c])=>c>=3);
  if (triplets.length > 0 && !Object.values(counts).some(c=>c>=2 && c<3)) {
    const key3 = triplets[0][0];
    const name3 = TRANSPORT_NAMES[TRANSPORT_SYMBOLS.indexOf(key3)];
    resultBox.className = 'result-box info';
    resultBox.textContent = `🚂 3× ${name3} – Sonder-Transport (Zug, Bus, Zahnradbahn) erlaubt!`;
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
  descentDieEl.innerHTML = dieImg(IMG_UNKNOWN, '?');
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
  eventDieEl.innerHTML = dieImg(IMG_UNKNOWN, '?');
  state.descentRolled = false;
  state.eventRolled = false;
  state.descentValue = 0;
  state.eventIndex = -1;
  state.descentPtsAccumulated = 0;
  clearSlopeSelection();
}

function rollBothDice() {
  const p = currentPlayer();
  const lvl = getLevel(p.points);
  const dd = DESCENT_DICE[lvl];

  // Roll descent die
  const val = dd.faces[Math.floor(Math.random() * dd.faces.length)];
  state.descentValue = val;
  state.descentRolled = true;

  const descentEl = document.getElementById('descentDie');
  descentEl.className = `die ${dd.cls} rolling`;
  descentEl.innerHTML = dieImg(`${dd.imgPrefix}${val}.svg`, String(val));
  descentEl.addEventListener('animationend', () => descentEl.classList.remove('rolling'), {once:true});

  // Roll event die
  const idx = Math.floor(Math.random() * EVENT_FACES.length);
  state.eventIndex = idx;
  state.eventRolled = true;
  const ev = EVENT_FACES[idx];

  const eventEl = document.getElementById('eventDie');
  eventEl.className = `die die-event rolling`;
  eventEl.innerHTML = dieImg(ev.img, ev.label);
  eventEl.addEventListener('animationend', () => eventEl.classList.remove('rolling'), {once:true});

  // Show descent result
  const descentRes = document.getElementById('descentResult');
  descentRes.style.display = '';
  descentRes.className = 'result-box info';
  descentRes.textContent = `🎿 Abfahrt: ${val} – du darfst ${val} Kreuzung${val>1?'en':''} passieren.`;

  // Show event result
  const eventRes = document.getElementById('eventResult');
  eventRes.style.display = '';
  eventRes.className = `result-box ${ev.cls}`;
  eventRes.innerHTML = `<div class="event-icon"><img src="${ev.img}" alt="${ev.label}" style="width:48px;height:48px;object-fit:contain;"></div><b>${ev.label}</b><br>${ev.text}`;

  // Handle automatic coin/bonus effects
  if (ev.label === 'Sonne') {
    p.joker++;
    updateCoinsDisplay();
    addHistory(`${p.name}: Sonne → +1 Joker (${p.joker} total)`);
  } else if (ev.label === '+1 Fahrt') {
    p.gratis++;
    checkCoinLimit(p);
    updateCoinsDisplay();
    addHistory(`${p.name}: +1 Fahrt → +1 Gratisfahrt-Münze (${p.gratis} total)`);
  } else if (ev.label === 'Pulverschnee') {
    state.descentPtsAccumulated += 5;
  }

  // Show points card
  if (ev.label === 'Unfall') {
    document.getElementById('descentPointsCard').style.display = '';
    document.getElementById('descentEventBanner').innerHTML =
      '<div class="result-box danger" style="margin:0;">🤕 <b>Unfall</b> – Zug aussetzen, keine Abfahrt. Joker kann eingesetzt werden.</div>';
    document.getElementById('slopeSelector').style.display = 'none';
    document.getElementById('descentPointsPreview').style.display = 'none';
  } else if (ev.label !== 'Helikopter') {
    document.getElementById('descentPointsCard').style.display = '';
    renderDescentEventBanner();
    filterSlopesByLevel();
    initSlopeBoxes();
    updateDescentPreview();
  }
}

function renderDescentEventBanner() {
  const ev = state.eventIndex >= 0 ? EVENT_FACES[state.eventIndex] : null;
  let html = '';
  if (ev?.label === 'Schneesturm') html += '<div class="result-box warning" style="margin:0 0 8px;">⚠ Schneesturm aktiv – nur <b>halbe Punkte</b>!</div>';
  if (ev?.label === 'Pulverschnee') html += '<div class="result-box success" style="margin:0 0 8px;">❄ Pulverschnee – +5 Bonuspunkte werden addiert!</div>';
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

function filterSlopesByLevel() {
  const p = currentPlayer();
  const lvl = p ? getLevel(p.points) : 'anfaenger';
  // Anfänger: blau + rot; Fortgeschritten: blau + rot + schwarz; Profi: alle
  const allowed = {
    anfaenger:      ['blue','red'],
    fortgeschritten:['blue','red','black'],
    profi:          ['blue','red','black','yellow']
  }[lvl];
  ['blue','red','black','yellow'].forEach(c => {
    document.getElementById(`slopeRow-${c}`).style.display = allowed.includes(c) ? '' : 'none';
  });
}

function initSlopeBoxes() {
  slopeSelection = { blue: 0, red: 0, black: 0, yellow: 0 };
  document.querySelectorAll('.kreuzung-boxes').forEach(group => {
    const color = group.dataset.color;
    group.querySelectorAll('.kbox').forEach(btn => {
      btn.classList.remove('kbox-active', 'kbox-disabled');
      btn.onclick = () => {
        const val = parseInt(btn.dataset.val);
        if (btn.classList.contains('kbox-disabled')) return;
        if (slopeSelection[color] === val) {
          slopeSelection[color] = 0;
          btn.classList.remove('kbox-active');
        } else {
          slopeSelection[color] = val;
          group.querySelectorAll('.kbox').forEach(b => b.classList.remove('kbox-active'));
          btn.classList.add('kbox-active');
        }
        updateDescentPreview();
        updateKboxAvailability();
      };
    });
  });
  updateKboxAvailability();
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

function updateDescentPreview() {
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
  if (ev?.label === 'Schneesturm') { total = Math.floor(total / 2); bonusText = ' (÷2 Schneesturm)'; }
  if (ev?.label === 'Pulverschnee') { total += 5; bonusText = ' (+5 Pulverschnee)'; }

  const el = document.getElementById('descentPointsPreview');
  if (parts.length === 0) {
    el.textContent = 'Keine Piste gewählt';
    el.style.color = 'var(--muted)';
  } else {
    el.innerHTML = `${parts.join(' + ')}${bonusText} → <b>${total} Punkte</b>`;
    el.style.color = '#2e6da4';
  }
}

function clearSlopeSelection() {
  slopeSelection = { blue: 0, red: 0, black: 0, yellow: 0 };
  document.querySelectorAll('.kbox').forEach(b => b.classList.remove('kbox-active', 'kbox-disabled'));
  updateDescentPreview();
  updateKboxAvailability();
}

function confirmDescentPoints() {
  const p = currentPlayer();
  const ev = state.eventIndex >= 0 ? EVENT_FACES[state.eventIndex] : null;

  // Unfall case: just close the card
  if (ev?.label === 'Unfall') {
    document.getElementById('descentPointsCard').style.display = 'none';
    const cc = document.getElementById('crossingCounter');
    if (cc) cc.classList.remove('counter-full','counter-over');
    addHistory(`${p.name}: Unfall – Zug ausgesetzt`);
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
  if (ev?.label === 'Schneesturm') { total = Math.floor(total / 2); }
  if (ev?.label === 'Pulverschnee') { total += 5; }

  p.points += total;
  const histLine = parts.length > 0
    ? `${p.name}: Abfahrt [${parts.join(', ')}]${ev?.label==='Schneesturm'?' (Schneesturm ÷2)':''}${ev?.label==='Pulverschnee'?' (+5 Pulverschnee)':''} → +${total} Punkte`
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
// SPECIAL TAB
// ═══════════════════════════════════════
function updateSpecialTab() {
  const p = currentPlayer();
  if (!p) return;
  document.getElementById('jokerCount').textContent = p.joker;
  document.getElementById('gratisCount').textContent = p.gratis;
  updateSightingsDisplay();
  checkCoinWarning(p);
}

function updateSpecialTabFull() {
  updateSpecialTab();
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
    html += `<span style="background:#e3f2fd;color:#1565c0;padding:3px 9px;border-radius:50px;font-size:0.78rem;font-weight:600;margin:2px;display:inline-block;">🏔 #${i}: +${pts} Pkt</span>`;
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
  if (total > 3) {
    const excess = total - 3;
    // Reduce gratis first, then joker
    const reduceGratis = Math.min(excess, p.gratis);
    p.gratis -= reduceGratis;
    p.joker  -= (excess - reduceGratis);
    addHistory(`${p.name}: Münzen-Limit (3) – ${excess} Münze(n) zurückgegeben`);
  }
}

function checkCoinWarning(p) {
  const total = (p?.joker||0) + (p?.gratis||0);
  document.getElementById('coinWarning').style.display = total >= 3 ? '' : 'none';
}

function updateCoinsDisplay() {
  const p = currentPlayer();
  if (!p) return;
  document.getElementById('jokerCount').textContent  = p.joker;
  document.getElementById('gratisCount').textContent = p.gratis;
  checkCoinWarning(p);
}

// ═══════════════════════════════════════
// PAUSE
// ═══════════════════════════════════════
function takePause(type) {
  const p = currentPlayer();
  if (!p) return;
  if (p.pauseDone) {
    alert('Mittagspause wurde bereits eingelegt!');
    return;
  }
  const pts = type === 'restaurant' ? 15 : 7;
  p.points += pts;
  p.pauseDone = true;
  addHistory(`${p.name}: Mittagspause (${type==='restaurant'?'Restaurant':'Bar'}) → +${pts} Punkte, 1 Zug aussetzen`);
  saveState();
  updateAll();
  const sectionPause = document.getElementById('sectionPause');
  const msg = document.createElement('div');
  msg.className = 'result-box success';
  msg.textContent = `✓ ${type==='restaurant'?'Restaurant':'Bar'}: +${pts} Punkte! Nächste Runde aussetzen.`;
  msg.style.marginTop = '8px';
  sectionPause.appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
}

// ═══════════════════════════════════════
// END TURN
// ═══════════════════════════════════════
function endTurn() {
  const p = currentPlayer();
  addHistory(`── ${p?.name||'?'}: Zug beendet (${gameTime()})`);
  // Advance to next player; if all played → advance round
  state.currentPlayerIndex++;
  if (state.currentPlayerIndex >= state.players.length) {
    state.currentPlayerIndex = 0;
    state.round++;
    if (state.round > state.totalRounds) {
      state.round = state.totalRounds;
      showGameEnd();
    }
  }
  resetTransportState();
  renderTransportDice(false);
  state.action = null;
  saveState();
  setAction(null);
  updateAll();
}

function showGameEnd() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `<div class="modal">
    <h2>⛷ Spielende!</h2>
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
// SCOREBOARD
// ═══════════════════════════════════════
function updateScoreboard() {
  document.getElementById('scoreRound').textContent = `${state.round} / ${state.totalRounds}`;
  document.getElementById('scoreTime').textContent  = gameTime();

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
function confirmReset() {
  document.getElementById('resetModal').classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
function resetGame() {
  closeModal('resetModal');
  clearSavedState();
  state.players = [];
  state.round = 1;
  state.currentPlayerIndex = 0;
  state.history = [];
  state.gameStarted = false;
  resetTransportState();
  setAction(null);
  initDefaultPlayers();
  showTab('tab-setup');
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
  showTab('tab-turn');
} else {
  // Fresh start – go to setup
  showTab('tab-setup');
}
