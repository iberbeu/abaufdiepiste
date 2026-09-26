# App v2 — Flow Spec (UI-12.2)

Status: **agreed** · 2026-09-26 (open points decided, see §10)
Visual reference: `mockups/ui12_mockup_v3.png` (agreed in UI-12.1).
Rules source of truth: `specifications/spielregeln.md`. Pure logic stays in `app/game_logic.js`.

This document describes every screen of v2, what the player does on it and where it leads.
UI copy is German (as in the app); everything else English.

---

## 1. Principles

1. **One main step per screen.** The step fills the screen; when it is done, the app moves on by itself.
2. **Dark mode by default.** Playful, chunky, big touch targets.
3. **Minimal text.** No explanatory paragraphs on screen. Only numbers and words the player needs *now*.
4. **Optional things are small icons, never hidden in the menu:** 📷 Sehenswürdigkeit, 🎟 Gratis Fahrt, 🃏 Joker (top right), 🎲 Extraaktivität (on the Bergab screen).
5. **Contextual Joker:** the Joker appears exactly where it can be used (e.g. as a badge on the event die), not as a separate section.
6. **No handover screen** between turns. **No sound / haptics** for now.
7. **Portrait first; landscape must work** (see §9).
8. **Back is allowed until the first roll.** Once dice are rolled, the action is locked (same rule as v1 `diceRolled`).

---

## 2. Global chrome (in-game screens)

```
┌──────────────────────────────────┐
│ ☰        10:30        📷 🎟² 🃏¹ │  top bar
│ (A 47)  Ⓑ 52  Ⓒ 31  Ⓓ 40        │  score strip
│                                  │
│          main step area          │
│                                  │
│ [      primary button       ]    │  only when the step needs one
└──────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| ☰ Menu | Opens the menu sheet (§8). |
| Time | Current in-game time (`gameTime()`). Round number lives in the menu only. |
| 📷 Sehenswürdigkeit | Sheet: "3. Sehenswürdigkeit · +15" → **Eintragen** / Abbrechen. Small "Letzte entfernen" link in the sheet if `sightings > 0`. Always available during a turn. |
| 🎟 Gratis Fahrt | Badge = count. Greyed at 0. Sheet: "Gratis Fahrt einsetzen?" → **Einsetzen**. Not blocked by rolled dice. |
| 🃏 Joker | Badge = count. Greyed at 0. Sheet for uses the app does not handle in context (e.g. moving a pawn / turning a Beförderungswürfel, see §10.1): "Joker einsetzen?" → **Einsetzen**. |
| Score strip | Circle with initial + points per player; current player = coloured pill. Tap → Punkte screen (§8). |
| Primary button | Big, bottom. Label is the result of the step, e.g. `+10 →`, `Weiter →`. |

**Sheets** = bottom sheets sliding up over a dimmed screen; tap outside = cancel. Used for every small decision so the main screen never grows.

**Transitions:** steps slide left → right; turn end = short "✓ +10" moment (≈0.8 s) where the points fly into the score strip, then the next player's turn start.

---

## 3. Screen map

```
HOME ──► SETUP W1 → W2 → W3 → W4 ──► TURN START ◄──────────────────────┐
  │                                     │  │  │                          │
  │                        ┌────────────┘  │  └──────────┐               │
  │                        ▼               ▼             ▼               │
  │                    BERGAUF         BERGAB          PAUSE             │
  │                    B1 → B2         D1 → D2         P1                │
  │                        └───────────────┴──────────────┘              │
  │                                        ▼                             │
  │                               TURN END (✓ +X, level-up)              │
  │                                        ▼                             │
  │                    [round advanced?] ROUND EVENT card(s)             │
  │                                        ▼                             │
  │                         [rounds left?] ── yes ───────────────────────┘
  │                                        │ no
  │                                        ▼
  │                         GAME END → SCHLUSSWERTUNG (per player) → RANKING
  │
  └──► PUNKTEBLOCK mode (independent, §7)
```

Suggested screen ids for the router: `home`, `setup_players`, `setup_names`, `setup_talstation`, `setup_length`, `turn_start`, `bergauf_roll`, `bergauf_result`, `bergab_roll`, `bergab_result`, `pause`, `turn_end`, `round_event`, `game_end`, `schlusswertung`, `ranking`, `punkteblock`, `menu_*`.

---

## 4. Home & setup

### HOME
- Logo / wordmark, three big buttons:
  - **Weiterspielen** — only if a saved game exists (shows "Runde 6 · 10:30").
  - **Neues Spiel** → Setup W1. If a game is running: confirm sheet "Laufendes Spiel verwerfen?".
  - **Punkteblock** → §7.
- No top bar / score strip here.

### SETUP W1 — "Wie viele spielen?"
- Five big number tiles 2–6 (no solo game, decision 26.09.2026). Tap = next step. Pre-selected: last game's count.

### SETUP W2 — Names
- One row per player: colour circle with initial + name field. Pre-filled from the last game (FEAT-21 behaviour); default "Spieler N" clears on focus.
- Tap the colour circle → pick another colour (sheet).
- **The list order is the turn order; the first player starts.** One-line hint under the list: "Wer am wenigsten Skierfahrung hat, beginnt." Reorder by drag handle.
- Primary: **Weiter →**

### SETUP W3 — Talstation
- One row per player: initial + free-text Talstation. Pre-filled from last game.
- Primary: **Weiter →** · Secondary link: "Überspringen".

### SETUP W4 — Spieldauer
- Two tiles: **Ganzer Tag** (20 Runden · 08:00–17:30) / **Kurz** (stepper 11–19 Runden, preset 16, shows end time live). Minimum 11 = the day never ends before the lunch window is over (decision 26.09.2026, see `important_decisions.md`).
- Start is always 08:00 (BUG-13 decision).
- Primary: **Los geht's! →** → TURN START of player 1.

---

## 5. The turn

### TURN START (`turn_start`) — mockup screen 1
- Avatar (big initial circle), name, stars (★★☆).
- Three big buttons: **Bergauf**, **Bergab**, **Pause**.
- Pause is **always visible**; locked (dark, 🔒 + reason) when outside 11:00–12:30 ("ab 11:00" / "vorbei") or `pauseDone` ("schon gemacht"). Tapping it while locked only wiggles it.
- Tap an action = go straight to its first step. No confirm.

### BERGAUF

**B1 `bergauf_roll`**
- 6 transport dice (3×2 grid) showing "?", big **Würfeln** button. "←" back to turn start is possible.
- Tap Würfeln → roll animation → B2.

**B2 `bergauf_result`**
- Dice show symbols. Under the dice: **one result line**, e.g. `✓ 2× Sessellift` / `🃏 3× Schlepplift = 1 Joker-Symbol` / `✗ Liftschlange`. Multiple valid combos → one line each (max 3 lines).
- Roll dots ●○ show the rolls used.
- After roll 1: tap a die = hold (die lifts, 🔒 corner). Two buttons:
  - Primary: **Nochmal würfeln** if nothing valid, otherwise **Fertig →**.
  - Secondary (text button): the other one.
- After roll 2: only **Fertig →**.
- Fertig → TURN END (no points).
- 6× same symbol: result line `🚁 Freie Fahrt – beliebig weit`.
- Joker > 0: a 🃏 badge on the result line. Tap it, then tap a die → face picker (6 symbols) → the die changes, the result line recalculates, 1 Joker is deducted (§10.1).

### BERGAB — mockup screen 2

**D1 `bergab_roll`**
- Descent die (level stars) + event die, both "?". Big **Würfeln**. Back possible.
- Tap → both dice roll together → content of D2 fades in on the same screen.

**D2 `bergab_result`** — depends on the event:

| Event | What changes on D2 |
|---|---|
| Sonne | `+1 🃏` flies into the top-bar Joker icon. Tiles as normal. |
| +1 Fahrt | `+1 🎟` flies into the Gratis-Fahrt icon. Tiles as normal. |
| Pulverschnee | Tiles as normal; `+5` is included in the primary button total once ≥1 crossing is chosen (existing rule in `calcDescentPoints`). |
| Schneesturm | Headline shows the halved number ("2 Kreuzungen"). **🃏 badge on the event die**; tap → sheet "Joker einsetzen? Volle Fahrt: 4 Kreuzungen" → headline and dots update. |
| Unfall / Helikopter | **No tiles.** Big icon + one line ("Unfall – diese Runde keine Abfahrt" / "Helikopter – ab ins nächste Tal"). 🃏 badge on the event die → sheet → tiles appear. Primary: **Weiter →** (0 points). Extraaktivität hidden. |

Coin-limit rule (3 coins → all returned) is checked after Sonne / +1 Fahrt; if it triggers, a sheet explains it once ("3 Münzen – alle zurückgeben").

**Crossings headline:** "N Kreuzungen" + N dots; dots fill as crossings are chosen.

**Slope tiles (2×2):** Blau 2 · Rot 4 · Schwarz 6 · Gelb 8 ("x Punkte" = per crossing).
- Top half = **+**, bottom half = **−**. Count badge in the corner, white outline when count > 0.
- − is faded at 0. + when all crossings are used → tile shakes, dots flash.
- **Forbidden slopes** (level too low): faded + ⚠, still tappable.
  First + on a forbidden tile opens the **Ohne-Befugnis sheet**:
  - One line: "Ohne Befugnis – Entscheidungswürfel entscheidet."
  - **🎲 Würfeln** → smiley die rolls in the sheet.
    - 😀 → "Geschafft – volle Punkte" → sheet closes, crossing added.
    - ☹ → "Negative Punkte" + **🃏 Joker nutzen** (if available) + **OK**. Crossing added, negative.
  - Abbrechen → no crossing added.
  - No Joker before rolling: rolling first is always better for the player, since the Joker is only needed on ☹ (decision §10.2).
  - One roll per descent (as v1). The result shows as a smiley badge on every forbidden tile; later + taps on forbidden tiles do not ask again.

**🎲 Extraaktivität** (small icon above the button):
- Hidden for Anfänger and during Unfall/Helikopter without Joker.
- Tap → sheet → **🎲 Würfeln** → 😀 `+12` / ☹ `0` (+ **🃏 Joker nutzen** on ☹, see §10.3).
- Once per turn. Afterwards the icon shows the result (😀+12 / ☹).

**Primary button:** total of the turn: `+10 →`, `−8 →` (warning colour), or `Weiter →` for 0. Always enabled (unused crossings simply lapse — rule). Tap → TURN END.

### PAUSE `pause`
- Two big tiles: **🍽 Restaurant +15** and **🍺 Bar +7**. Tap = select (other tile dims).
- Primary: `+15 →` → TURN END, sets `pauseDone`.
- Back possible until confirmed.

### TURN END `turn_end`
- ≈0.8 s "✓ +10" moment, points animate into the score strip.
- If the level went up: level-up celebration (FEAT-17) over this moment, tap to continue.
- Then: next player's TURN START, or ROUND EVENT cards first if the round advanced.

### ROUND EVENT `round_event`
Full-screen cards, one at a time, tap **OK** to dismiss (FEAT-16 content):
- 11:00 "Mittagspause offen 🍽" · 12:30 "Mittagspause vorbei" · "Noch 3 Runden – ab ins Tal!" with each player's Talstation.

---

## 6. Game end

### GAME END `game_end`
- "Skitag vorbei! 🏁 17:30" → **Schlusswertung starten →**. The Zug flow is blocked from here on (`gameFinished`).

### SCHLUSSWERTUNG `schlusswertung` — per player, full-screen steps (FEAT-22 logic, `calcAbschlusswertungResult()`)
1. Avatar + "Talstation erreicht?" → **Ja** / **Nein**. (Ja → step 3.)
2. Rückweg: the **same four slope tiles** as Bergab (penalty = half points, shown live), plus two small steppers: Beförderungen (−5 each) and zusätzliche Talstationen (−5 each).
3. Summary: penalty lines, coin bonus (+5 per remaining coin), net total → **Bestätigen →** → next player.

### RANKING `ranking`
- Podium for the top 3 + list for the rest, confetti. Buttons: **Neues Spiel** · **Punkteverlauf**.

---

## 7. Punkteblock mode (FEAT-24) `punkteblock`

For groups rolling the physical dice who only need the score pad.

- **Separate game** with its own storage key; does not touch a running app game.
- Setup: reuse W1 + W2 (+ W3 optional). No game length step — the pad always shows 08:00–17:30.
- Screen mirrors the printed pad (`brettspiel/punkteblock.pdf`): columns = players, rows = time slots 08:00–17:30; lunch window tinted teal, last 3 rounds orange; header rows for Fahrniveau stars and Sehenswürdigkeiten; totals row pinned at the top.
- Tap a cell → sheet with a number pad **plus quick chips**: `+2 +4 +6 +8` (slopes, can be tapped repeatedly), `📷 Sehensw.` (next progressive value), `🍽 +15`, `🍺 +7`, `🎲 +12`, `❄ +5`. Running sum shown; **Eintragen**.
- Stars update automatically from the total.
- Last row: Schlusswertung (penalty/bonus) cell per player, then final total.
- Landscape is the natural orientation here; portrait scrolls horizontally inside the grid only.

---

## 8. Menu ☰

Full-height sheet with big rows:
- **Punkte** — scoreboard + Punkteverlauf table; tap a cell → round detail (FEAT-23).
- **Würfel & Regeln** — Würfel-Referenz + short rule cards (slope points, events, levels).
- **Anpassungen** — manual points and coin counts per player (confirm sheet before opening, as v1).
- **Neues Spiel** (confirm) · **Zum Start** (home).
- No hints toggle (FEAT-20 is dropped in v2, decision §10.4).
- Round number + time shown in the menu header.

---

## 9. Landscape

- Top bar and score strip unchanged.
- Main area splits into two columns:
  - Turn start: avatar/name left, the three action buttons stacked right.
  - Bergab: dice + headline + 🎲 left, 2×2 tiles right, primary button bottom right.
  - Bergauf: dice 6×1 row, result + buttons below.
- Sheets become centred dialogs (max width ~480 px).

---

## 10. Decisions (2026-09-26)

1. **Joker on Beförderungswürfel — new in v2.** The rules allow turning one transport die to any face. On B2, if Joker > 0, a 🃏 badge appears on the result line; tap it, then tap a die → face picker (6 symbols). The result line recalculates; 1 Joker is deducted.
2. **Ohne Befugnis: Joker only after ☹** (same as v1). Offering it before the roll brings nothing — the player always rolls first and uses the Joker only if needed.
3. **Joker on Extraaktivität ☹ — new in v2.** Turns ☹ into 😀 (+12), as the coin rules say.
4. **Hints toggle (FEAT-20) is dropped in v2.** Look-ups go through "Würfel & Regeln" in the menu.
5. **Starting player = first in the list.** The order entered in setup W2 is the turn order.
6. **Unused crossings lapse.** The player may confirm with fewer crossings than allowed (as in v1 and the rules).

---

## 11. Out of scope for v2 (for now)

Sound, haptics, handover screen, online features, custom start time (fixed 08:00), custom slope types.
