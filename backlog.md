## Backlog

Bugs and missing features identified by audit on 2026-04-05. Each item references the relevant game rule.

### Bugs

| ID | Area | Description | Rule | Estimate |
|----|------|-------------|------|----------|
| BUG-10 | Persistence | Reloading the page mid-turn locks the player out. `saveState()` persists `diceRolled` but NOT `state.action`, `transportDice`, `transportRolls`, `descentValue`, `eventIndex`, `jokerUsedOnEvent`, `slopeSelection`, or `ohneBefugnisResult`. After reload, `diceRolled=true` disables all three action buttons (`setAction(null)` sets `btn.disabled = locked`) and the sticky footer shows "Aktion wählen …" disabled. There is no way to end the turn or re-roll — only a full game reset escapes the state. Trivial to trigger on mobile (accidental refresh, tab switch kill, etc.). Fix: either persist the full turn state, or clear `diceRolled`/re-allow action switching when the transient turn state is missing on restore. | — | ~3k |
| BUG-12 | Bergauf | Having three dice with the same transport is a joker, however, you can only use it in combination with another die showing the transport you want to use. This means that if I get 3x gondel and 3x Skilift, they are not 2 jokers that I can use as "Sessellift" for example, as I need another die with a Sessellift,, which I did not get.. | Rules | ~1k |
| BUG-13 | Rounds | It is currently possible to set 100 rounds (Anzahl Runde) for the game. As each round is 30 minutes, you end up finishing the day at 23:00, which is not realistic as skiresorts close earlier. Limit the number of rounds to max 20 and min 10. Each round must still take 30 minutes. Remove the option to select the starting time too. It will always start at 8:00. This way it is simpler   | Rules | ~1k |


### Missing Features

| ID | Area | Description | Rule | Estimate |
|----|------|-------------|------|----------|
| ~~FEAT-1~~ | ~~Bergab~~ | ~~Resolved then reverted (BUG-11)~~ — `skipNextTurn` was added and later removed. Unfall and Helikopter forfeit only the current turn; no future-turn skip is needed. The field no longer exists in the player object. | — | — |
| ~~FEAT-2~~ | ~~Bergab~~ | ~~Resolved~~ — Forbidden slope rows now show ⚠ badge; selecting one reveals inline RG roll, confirm locked until rolled. Green = normal pts, Red = negative pts. (Joker option and Gondel-zurück not yet implemented.) | — | — |
| ~~FEAT-3~~ | ~~Sonder~~ | ~~Resolved~~ — Extraaktivität panel in Zug/Bergab: +12 on green applied at Zug beenden (deferred via `extraaktivitaetPending`), 0 on red. | — | — |
| ~~FEAT-4~~ | ~~Bergab~~ | ~~Resolved~~ — Ohne Befugnis panel in Zug/Bergab: green unlocks all slope rows (normal pts); red negates final descent points via `ohneBefugnisResult` flag. | — | — |
| ~~FEAT-6~~ | ~~UX~~ | ~~Resolved~~ — Sticky primary action footer implemented. Context-aware label merges Bergab confirm + turn-end into one tap. | — | — |
| ~~FEAT-7~~ | ~~UX~~ | ~~Resolved~~ — Pause buttons are now disabled outside 11:00–12:30 and after `pauseDone = true`. Contextual warning banners shown for each case. | — | — |
| ~~FEAT-9~~ | ~~UX~~ | ~~Resolved~~ — `descentPtsAccumulated` removed from state object and both reset sites. | — | — |
| ~~FEAT-10~~ | ~~Architecture~~ | ~~Resolved~~ — `dice_app.js` now imports from `game_logic.js` via ES modules (`type="module"` in `index.html`). Duplicated constants (`TRANSPORT_SYMBOLS`, `TRANSPORT_NAMES`, `SLOPE_PTS`) and functions (`getLevel`, `levelLabel`) removed. `gameTime`, `gameTimeHour`, `getAllowedSlopes`, `calcDescentTotal`, and `confirmDescentPoints` delegate to `game_logic.js`. `Object.assign(window, …)` block at the bottom of `dice_app.js` restores global bindings for HTML onclick handlers. | — | — |
| **FEAT-11 (CRITICAL)** | **Sonder / Coins** | **Gratis Fahrt Münze usable as extra Bergauf.** A Gratis Fahrt Münze allows an extra Bergauf action in any round, regardless of whether Bergauf or Bergab was already taken. This is currently not implemented at all. Needs a new UI entry point (e.g. a button in Sonder tab or inline in Zug), a new turn-sub-state tracking that a Gratis Fahrt was used this round, and correct coin deduction. Must not conflict with the dice-roll lock (`diceRolled`). | Rules | ~3k |
| ~~FEAT-12~~ | ~~UX / Setup~~ | ~~Resolved~~ — `addPlayerField()` attaches focus/blur listeners. Focus clears the field if the value equals the live slot default ("Spieler N"); blur restores it if left empty. Slot position is read live from the DOM so removing an earlier row doesn't corrupt the restored default. | — | — |
| FEAT-13 | Punkte / Sehenswürdigkeiten | **Undo last Sehenswürdigkeit registration.** If a Sehenswürdigkeit is registered by mistake, there is no way to remove it. Add an undo / remove button next to the Sehenswürdigkeit display for the current player. | — | ~500 |
| ~~FEAT-14~~ | ~~Zug / Punkte~~ | ~~Resolved~~ — Sehenswürdigkeit quick-register card added to Zug tab. Manual point adjustment + Münzen & Joker tracker moved into a collapsed "Anpassungen" accordion at the bottom of Punkte tab, guarded by a confirmation modal. Sonder tab removed entirely. | — | — |
| ~~FEAT-15~~ | ~~Setup~~ | ~~Resolved~~ — Free-text Talstation input added per player in Setup tab. Stored in `player.talstation`. Persisted in `PROFILES_KEY` alongside player names so same group/Talstation is pre-filled on next game. Displayed only in Setup tab (not in game header). | Rules | ~1k |
| ~~FEAT-16~~ | ~~UX / Notifications~~ | ~~Resolved~~ — One-shot modals queued in `_notifQueue` and shown after each round transition: (1) lunch window opens at 11:00, (2) lunch window closes at 12:30, (3) 3 rounds remaining with Talstation list per player. IDs stored in `state.notificationsShown[]` (persisted). | — | — |
| ~~FEAT-17~~ | ~~UX / Animations~~ | ~~Resolved~~ — `checkLevelUp(p, prevLevel)` called after every point award. On level increase, `showLevelUpCelebration()` shows a CSS-animated toast (spring easing, auto-removes after 3.2s). | — | — |
| ~~FEAT-18~~ | ~~Punkte / Punkteverlauf~~ | ~~Resolved~~ — Live in-progress row appended to Punkteverlauf for the current round. Players who have played show their current points + delta; others show `…`. Row is italic with light background to distinguish from completed rounds. Disappears when game ends. | — | — |
| FEAT-19 | Bergab / Ohne Befugnis | **Joker escape on red Ohne Befugnis roll.** When a player rolls red on an Ohne Befugnis slope, they should be able to spend a Joker to avoid the penalty (keep points positive). Verify whether this is already implemented from FEAT-2/FEAT-4; if not, implement: show a "Joker einsetzen" option after a red roll, gated on `player.joker > 0`, which deducts 1 joker and switches the result to green. | Rules | ~1k |
| FEAT-20 | UX / Expert mode | **"Infos einblenden" toggle — hide instructional labels by default.** Add a persistent toggle (stored in localStorage, not game state) that hides all in-app instructional hint labels for experienced players. Default: labels hidden. Toggle label: "Infos einblenden" / "Infos ausblenden". All instructional text elements get a CSS class (e.g. `.info-hint`) controlled by a body-level class. | — | ~2k |
| ~~FEAT-21~~ | ~~Setup~~ | ~~Resolved~~ — `initDefaultPlayers()` reads player names + Talstationen directly from the existing `STORAGE_KEY` on boot (no second key). `startGame()` overwrites `STORAGE_KEY` via `saveState()`, so the next boot always finds the last game's players. Falls back to 2 defaults if no saved state. | — | ~500 |
| FEAT-22 | Punkte / Abschlusswertung | **Interactive guided Abschlusswertung.** Replace or extend the static penalty reference with a guided per-player questionnaire at game end. Flow per player: (1) "Hast du deine ursprüngliche Talstation erreicht?" → if Ja: (2) "Wie viele zusätzliche Münzen/Jokers hast du?"; if Nein: (2) "Anzahl zusätzliche Pisten" (slope selector UI) + (3) "Anzahl zusätzliche Beförderungsmittel" (number input), then (4) "Wie viele zusätzliche Münzen/Jokers hast du?" — app automatically cancels the most expensive penalties according to the coin/joker count entered. Jokers/Münzen are not added as positive points; they only reduce penalties. | Rules | ~5k |

### Errors in the instructions
| ID | Area | Issue  | Solution? |
|----|------|--------|-----------|


## UI Improvements

Top 5 issues identified by design critique on 2026-04-06.

| ID | Area | Finding | Severity | Recommendation | Estimate |
|----|------|---------|----------|----------------|----------|
| ~~UI-1~~ | ~~UX / Layout~~ | ~~Resolved~~ — Sticky footer implemented: `.sticky-footer { position: fixed; bottom: 0 }` in CSS; `#tab-turn.active` has `padding-bottom: 80px` to prevent content being hidden. | — | — | — |
| ~~UI-2~~ | ~~Visual / Semantics~~ | ~~Resolved~~ — Level badges now use non-piste colours: `level-anfaenger` = glacier teal tint, `level-fortgeschritten` = alpine night tint, `level-profi` = alpenglühen tint. CSS comment confirms "deliberate non-piste colours". | — | — | — |
| ~~UI-3~~ | ~~Visual / Semantics~~ | ~~Resolved~~ — `DESCENT_DICE` in `dice_app.js` now uses `die-descent-anfaenger/fortgeschritten/profi`. Old alias rules (`die-descent-red/black/yellow`) removed from CSS. Initial class on `#descentDie` in `index.html` updated to match. | — | — | — |
| ~~UI-4~~ | ~~UX / Forms~~ | ~~Resolved~~ — `setAction('pause')` disables both Restaurant and Bar buttons when outside 11:00–12:30 or when `pauseDone = true`. | — | — | — |
| ~~UI-5~~ | ~~Code / Maintainability~~ | ~~Resolved~~ — All non-JS-managed inline `style=""` attributes extracted into named classes in `dice_app.css` (`.btn-row--flush`, `.btn-row--column`, `.die-wrapper`, `.die-legend`, `.label-sub`, `.section-hint`, `.text-muted-sm`, `.descent-points-preview`, `.ohne-befugnis-roll-row`, `.input-row`, `.input-pts`, `.coin-control`, `.coin-count`, `.btn-coin`, `.penalty-text`, `.setup-note`, `.accordion-hint`, `.card--mt-8`, `.card--mt-14`, `.result-box--mt-8`, `.result-box--mt-10`, `.result-box--flush-bottom`, ID-based rules for `#sightingsDisplay`, `#manualResult`, `#rgDieOhneBefugnisInline`, `#punktverlaufContainer`, `#descentEventBanner`). Only `style="display:none"` remains (JS-managed). CLAUDE.md updated with hard rule against inline styles. | — | — |
| ~~UI-6~~ | ~~UX / Sticky footer~~ | ~~Resolved~~ — `handlePrimaryAction()` sets `btn.disabled = true` and `btn.textContent = '✓ Eingetragen …'` immediately on tap, preventing double-tap and giving visual feedback during the 900ms window. | — | — | — |
| ~~UI-7~~ | ~~UX / Copy~~ | ~~Resolved~~ — Sub-label "2. Wurf noch möglich ↑" shown below footer button when `transportRolls === 1`. Hidden after roll 2 and on all other actions. | — | — |
| UI-8 | UX / Colour | Footer button uses `btn-warn` (orange) for "Ohne Befugnis pending / blocked" state, but orange also means "Bergab action". Orange carries two meanings. | 🟡 Moderate | Use `btn-danger` (red) for the blocked/pending footer state to distinguish it from the Bergab action colour. | ~500 |
| UI-9 | UX / Pause | When Pause is selected but the time window is invalid, the footer shows disabled "Pause wählen …" with no hint to switch action. Player is stuck without guidance. | 🟡 Moderate | Change footer label to "Andere Aktion wählen …" when time window is invalid and pauseDone is false. | ~500 |
| UI-11 | CSS / Housekeeping | The extracted UI-5 classes (`.die-wrapper`, `.section-hint`, `.btn-coin`, etc.) are appended as one block at the end of `dice_app.css` rather than integrated into their logical sections (Dice Area, Buttons, Cards…). | 🟢 Minor | In a future CSS cleanup pass, move each class to its matching section. No functional impact. | ~1k |
| ~~UI-10~~ | ~~Dice placeholder~~ | ~~Resolved~~ The placeholder for the bergauf dice is now "fussweg" but it should be the same question mark dice as for the bergab dice. | 🟡 Moderate | Put the same placeholder as for the bergab (the '?') | — |

