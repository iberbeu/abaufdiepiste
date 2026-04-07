# CLAUDE.md — app/ (Coding Context)

> **Full project context lives in [`../CLAUDE.md`](../CLAUDE.md).**
> Read it for: game rules, architecture decisions, feature backlog, UI audit, brand and folder conventions.

---

## Maintenance Rule

**After every code change, update this file if any of the following are affected:**
- JS section index (lines shifted significantly → update approximate line numbers)
- Key function signatures (new function added, signature changed, function removed)
- State shape (new field added to `state` or player object, field removed or renamed)
- CSS class reference (new component class, renamed class)
- Active bugs table (bug fixed → remove row; new bug found → add row with ID + short description)

Also apply the maintenance rules from `../CLAUDE.md` (feature checklist, file structure, etc.).

---

## External References

Fetch these files when the task requires it — do not ignore them for coding decisions:

| File | When to read |
|------|-------------|
| [`../CLAUDE.md`](../CLAUDE.md) | Always — full project context, conventions, backlog |
| [`../brand/brand_strategy.md`](../brand/brand_strategy.md) | Any UI copy, colours, tone, naming, or visual decisions |
| [`../specifications/`](../specifications/) | Any game rule question or logic implementation |

---

## What lives here

| File | Role |
|------|------|
| `dice_app.html` | App shell — tab structure, all UI markup. No inline JS. |
| `dice_app.css` | All styles. CSS variables at top. No inline styles in HTML. |
| `dice_app.js` | All game logic and state. No framework. Procedural + DOM. |
| `img/` | SVG assets for all dice faces (referenced by JS via `src`). |

---

## Hard Rules

- **Never combine HTML / CSS / JS** — always separate files.
- **No inline styles** in HTML (`style=""` is a violation — use CSS classes).
- **No external libraries** — vanilla JS only.
- **snake_case** for all file names.
- **Do not touch `../backup/`** under any circumstances.

---

## State

Single `state` object in `dice_app.js`. Persisted via `localStorage`.

```
state.players[]          name, color, points, joker, gratisFahrt, sightings, pauseDone, skipNextTurn
state.currentPlayerIndex
state.round / totalRounds / startHour
state.transportDice[]    array of 6 face values
state.transportRolls     0 | 1 | 2
state.action             'bergauf' | 'bergab' | 'pause' | null
state.descentRolled      bool
state.descentValue       int
state.eventRolled        bool
state.eventIndex         0–5
state.diceRolled         bool — locks action buttons after first roll
state.history[]          log entries
state.gameStarted        bool
```

Module-level (not persisted):
```
slopeSelection           { blue, red, black, yellow } crossing counts
ohneBefugnisResult       null | true | false
```

---

## JS Section Index

Use this to jump directly to the right area without reading the whole file.

| Section | Approx. line |
|---------|-------------|
| STATE object + defaults | ~20 |
| saveState / loadState | ~80 |
| Player setup | ~130 |
| Game clock / round | ~200 |
| Transport dice (Bergauf) | ~260 |
| analyzeTransport() | ~360 |
| Descent dice (Bergab) | ~450 |
| Event die | ~560 |
| Rot/Grün die | ~620 |
| Slope selector + Ohne Befugnis | ~680 |
| confirmDescentPoints() | ~770 |
| Pause | ~870 |
| endTurn() | ~920 |
| handlePrimaryAction() | ~990 |
| Sehenswürdigkeiten | ~1030 |
| Coins / Joker | ~1070 |
| UI update functions | ~1110 |
| History log | ~1200 |
| Game reset | ~1240 |

> Line numbers are approximate — update this table when major sections move.

---

## Key Function Signatures

```js
endTurn()
  // Checks skipNextTurn, advances currentPlayerIndex, clears diceRolled, saves state.

confirmDescentPoints()
  // Reads slopeSelection + ohneBefugnisResult, writes points to current player.
  // Returns early (no points) on Unfall or Helikopter.

handlePrimaryAction()
  // Context-aware footer button handler.
  // Bergab: calls confirmDescentPoints() then endTurn() after 900ms.
  // Others: calls endTurn() directly.

rollTransportDice(keepIndices[])
  // Rolls all dice not in keepIndices. Increments transportRolls.
  // Blocked if transportRolls >= 2.

analyzeTransport(dice[])
  // Returns array of valid transport combos found in dice[].
  // 2× same = transport. 3× same = Sonder. 6× same = Helikopter.
  // Pair and Sonder-Transport in same roll are BOTH reported (see BUG-8).

rollDescentAndEvent()
  // Rolls descent die (level-based) + event die together.
  // Sets descentValue, eventIndex, descentRolled, eventRolled.

updatePrimaryFooter()
  // Reads state.action + roll state → sets footer button label + enabled/disabled.
```

---

## Active Bugs (quick ref)

| ID | Short description |
|----|-------------------|
| BUG-5 | Pause + Unfall do not skip the next turn (FEAT-1 needed) |
| BUG-6 | `rollRGDie()` references non-existent DOM IDs — dead code |
| BUG-7 | Unfall/Helikopter confirm shows no visual feedback |
| BUG-8 | `analyzeTransport()` suppresses Sonder-Transport when a pair is also present |
| BUG-9 | `coinWarning` element always hidden — dead UI |
| BUG-10 | `descentPtsAccumulated` is dead state — never read |

Full descriptions and rule references → `../CLAUDE.md` → Backlog → Bugs.

---

## CSS Quick Ref

```
:root variables     --color-*, --radius-*, --font-* at top of dice_app.css
Level badges        .badge-anfaenger / .badge-fortgeschritten / .badge-profi
Piste colours       .slope-blue / .slope-red / .slope-black / .slope-yellow
Dice faces          .die-transport / .die-event / .die-descent-* / .die-rg
Footer button       #primaryActionBtn  —  .btn-primary / .btn-warn / .btn-danger
```
