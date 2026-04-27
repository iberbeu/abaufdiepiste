// DEV PANEL — for local testing only.
// Remove the two DEV ONLY lines in index.html before shipping.
// Toggle panel: Ctrl+Shift+D

(function () {
  const STORAGE_KEY = 'abaufdiepiste_state';

  const COLORS = ['#3A8A8C', '#e05252', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];

  function player(name, colorIdx, points, joker, opts) {
    opts = opts || {};
    return {
      name:         name,
      color:        COLORS[colorIdx],
      points:       points || 0,
      joker:        joker  || 0,
      gratis:       opts.gratis       || 0,
      sightings:    opts.sightings    || 0,
      pauseDone:    opts.pauseDone    || false,
    };
  }

  function base(overrides) {
    return Object.assign({
      currentPlayerIndex: 0,
      round:              1,
      totalRounds:        20,
      startHour:          8,
      history:            [],
      gameStarted:        true,
      playedThisRound:    [],
      diceRolled:         false,
      roundSnapshots:     [],
      gameFinished:       false,
    }, overrides || {});
  }

  // startHour 8, 30 min/round → round 7 = 11:00 (pause window opens)
  const FIXTURES = [
    {
      label: 'Fresh game — 2 players, round 1',
      state: function () {
        return base({ players: [player('Anna', 0), player('Ben', 1)] });
      },
    },
    {
      label: '3 players — round 1, 1 joker each',
      state: function () {
        return base({
          players: [
            player('Anna',  0, 0, 1),
            player('Ben',   1, 0, 1),
            player('Clara', 2, 0, 1),
          ],
        });
      },
    },
    {
      label: 'Mid-game — round 10, mixed levels (Anfänger + Fortgeschritten)',
      state: function () {
        return base({
          round:   10,
          players: [player('Anna', 0, 28), player('Ben', 1, 95)],
        });
      },
    },
    {
      label: 'Pause window — round 7 (11:00), both players active',
      state: function () {
        return base({
          round:   7,
          players: [player('Anna', 0, 20), player('Ben', 1, 40)],
        });
      },
    },
    {
      label: 'BUG-10 — diceRolled=true on reload (locks UI)',
      state: function () {
        return base({
          round:      3,
          diceRolled: true,
          players:    [player('Anna', 0, 10), player('Ben', 1, 20)],
        });
      },
    },
    {
      label: 'Game finished — all 20 rounds done',
      state: function () {
        return base({
          round:        20,
          gameFinished: true,
          players:      [player('Anna', 0, 142), player('Ben', 1, 88)],
        });
      },
    },
  ];

  function applyJson(json, errorEl) {
    try {
      const parsed = JSON.parse(json);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      location.reload();
    } catch (e) {
      errorEl.textContent = 'Ungültiges JSON: ' + e.message;
    }
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'devPanel';
    panel.style.display = 'none';

    const box = document.createElement('div');
    box.className = 'dp-box';

    const h = document.createElement('h2');
    h.textContent = 'DEV FIXTURES';
    const hint = document.createElement('p');
    hint.textContent = 'Lädt einen Zustand in localStorage und lädt neu. Ctrl+Shift+D zum Schließen.';
    box.appendChild(h);
    box.appendChild(hint);

    FIXTURES.forEach(function (f) {
      const btn = document.createElement('button');
      btn.className = 'dp-btn';
      btn.textContent = f.label;
      btn.onclick = function () {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(f.state()));
        location.reload();
      };
      box.appendChild(btn);
    });

    // --- Raw JSON editor ---
    const editorH = document.createElement('h2');
    editorH.className = 'dp-section-title';
    editorH.textContent = 'RAW JSON EDITOR';
    box.appendChild(editorH);

    const textarea = document.createElement('textarea');
    textarea.className = 'dp-textarea';
    textarea.spellcheck = false;
    box.appendChild(textarea);

    const errorEl = document.createElement('p');
    errorEl.className = 'dp-error';
    box.appendChild(errorEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'dp-btn-row';

    const formatBtn = document.createElement('button');
    formatBtn.className = 'dp-btn dp-btn--secondary';
    formatBtn.textContent = 'Format JSON';
    formatBtn.onclick = function () {
      errorEl.textContent = '';
      try {
        textarea.value = JSON.stringify(JSON.parse(textarea.value), null, 2);
      } catch (e) {
        errorEl.textContent = 'Ungültiges JSON: ' + e.message;
      }
    };

    const applyBtn = document.createElement('button');
    applyBtn.className = 'dp-btn dp-btn--apply';
    applyBtn.textContent = 'Apply & Reload';
    applyBtn.onclick = function () {
      errorEl.textContent = '';
      applyJson(textarea.value, errorEl);
    };

    btnRow.appendChild(formatBtn);
    btnRow.appendChild(applyBtn);
    box.appendChild(btnRow);

    const close = document.createElement('button');
    close.className = 'dp-close';
    close.textContent = '✕ Schließen';
    close.onclick = function () { panel.style.display = 'none'; };
    box.appendChild(close);

    panel.appendChild(box);
    document.body.appendChild(panel);
    panel._textarea = textarea;
    panel._errorEl = errorEl;
    return panel;
  }

  let panel = null;

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      if (!panel) panel = buildPanel();
      const isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) {
        panel._errorEl.textContent = '';
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          try {
            panel._textarea.value = JSON.stringify(JSON.parse(raw), null, 2);
          } catch (e) {
            panel._textarea.value = raw;
            panel._errorEl.textContent = 'Warnung: gespeichertes JSON ist ungültig — ' + e.message;
          }
        } else {
          panel._textarea.value = '';
        }
      }
    }
  });
})();
