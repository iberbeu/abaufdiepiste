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

    const close = document.createElement('button');
    close.className = 'dp-close';
    close.textContent = '✕ Schließen';
    close.onclick = function () { panel.style.display = 'none'; };
    box.appendChild(close);

    panel.appendChild(box);
    document.body.appendChild(panel);
    return panel;
  }

  let panel = null;

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      if (!panel) panel = buildPanel();
      panel.style.display = (panel.style.display === 'none') ? 'flex' : 'none';
    }
  });
})();
