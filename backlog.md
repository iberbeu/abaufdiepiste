## Backlog

Bugs and missing features identified by audit on 2026-04-05. Each item references the relevant game rule.

### Bugs

| ID | Area | Description | Rule | Estimate |
|----|------|-------------|------|----------|


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
| ~~FEAT-11~~ | ~~Sonder / Coins~~ | ~~Resolved~~ — "🎟 Gratis Fahrt nutzen" card shown in Zug tab whenever `p.gratis > 0`. Tapping deducts 1 coin, logs to history, shows brief feedback. No dice rolling. Available before or after main action; not blocked by `diceRolled`. Multiple uses per turn (limited by coin count). | — | — |
| ~~FEAT-12~~ | ~~UX / Setup~~ | ~~Resolved~~ — `addPlayerField()` attaches focus/blur listeners. Focus clears the field if the value equals the live slot default ("Spieler N"); blur restores it if left empty. Slot position is read live from the DOM so removing an earlier row doesn't corrupt the restored default. | — | — |
| ~~FEAT-13~~ | ~~Punkte / Sehenswürdigkeiten~~ | ~~Resolved~~ — Each sighting pill now has a `×` button. All buttons call `removeSighting()` which deducts `p.sightings×5` and decrements the count (removing any pill is equivalent to removing the last, since scoring is sequential). Level-ups are permanent; only points are reversed. | — | — |
| ~~FEAT-14~~ | ~~Zug / Punkte~~ | ~~Resolved~~ — Sehenswürdigkeit quick-register card added to Zug tab. Manual point adjustment + Münzen & Joker tracker moved into a collapsed "Anpassungen" accordion at the bottom of Punkte tab, guarded by a confirmation modal. Sonder tab removed entirely. | — | — |
| ~~FEAT-15~~ | ~~Setup~~ | ~~Resolved~~ — Free-text Talstation input added per player in Setup tab. Stored in `player.talstation`. Persisted in `PROFILES_KEY` alongside player names so same group/Talstation is pre-filled on next game. Displayed only in Setup tab (not in game header). | Rules | ~1k |
| ~~FEAT-16~~ | ~~UX / Notifications~~ | ~~Resolved~~ — One-shot modals queued in `_notifQueue` and shown after each round transition: (1) lunch window opens at 11:00, (2) lunch window closes at 12:30, (3) 3 rounds remaining with Talstation list per player. IDs stored in `state.notificationsShown[]` (persisted). | — | — |
| ~~FEAT-17~~ | ~~UX / Animations~~ | ~~Resolved~~ — `checkLevelUp(p, prevLevel)` called after every point award. On level increase, `showLevelUpCelebration()` shows a CSS-animated toast (spring easing, auto-removes after 3.2s). | — | — |
| ~~FEAT-18~~ | ~~Punkte / Punkteverlauf~~ | ~~Resolved~~ — Live in-progress row appended to Punkteverlauf for the current round. Players who have played show their current points + delta; others show `…`. Row is italic with light background to distinguish from completed rounds. Disappears when game ends. | — | — |
| ~~FEAT-19~~ | ~~Bergab / Ohne Befugnis~~ | ~~Resolved~~ — After a red Ohne-Befugnis roll, a "🃏 Joker nutzen" button appears (gated on `p.joker > 0`). Clicking it disables the button (double-tap guard), deducts 1 joker, sets `ohneBefugnisResult = true`, and updates the result display to green. Logged to history. Implemented via `useJokerOnOhneBefugnis()`. | Rules | ~1k |
| ~~FEAT-20~~ | ~~UX / Expert mode~~ | ~~Resolved~~ **"Infos einblenden" toggle — hide instructional labels by default.** Add a persistent toggle (stored in localStorage, not game state) that hides all in-app instructional hint labels for experienced players. Default: labels hidden. Toggle label: "Infos einblenden" / "Infos ausblenden". All instructional text elements get a CSS class (e.g. `.info-hint`) controlled by a body-level class. | — | ~2k |
| ~~FEAT-21~~ | ~~Setup~~ | ~~Resolved~~ — `initDefaultPlayers()` reads player names + Talstationen directly from the existing `STORAGE_KEY` on boot (no second key). `startGame()` overwrites `STORAGE_KEY` via `saveState()`, so the next boot always finds the last game's players. Falls back to 2 defaults if no saved state. | — | ~500 |
| FEAT-22 | Punkte / Abschlusswertung | **Interactive guided Abschlusswertung.** Replace or extend the static penalty reference with a guided per-player questionnaire at game end. Flow per player: (1) "Hast du deine ursprüngliche Talstation erreicht?" → if Ja: (2) "Du hast noch X Joker/Münzen. Die werden benutzt, um die teuresten Straffen auszugleichen"; if Nein: (2) "Anzahl zusätzliche Pisten" (slope selector UI) + (3) "Anzahl zusätzliche Beförderungsmittel" (number input), then (4) "Du hast noch X Joker/Münzen. Die werden benutzt, um die teuresten Straffen auszugleichen" — app automatically cancels the most expensive penalties according to the coin/joker count entered. Jokers/Münzen are not added as positive points; they only reduce penalties. | Rules | ~5k |
| ~~FEAT-23~~ | ~~Punkte~~ | ~~Resolved~~ — Each cell in PUNKTVERLAUF is now clickable. Tapping opens a modal showing the history entries for that player/round that contain "Punkte", with the player-name prefix stripped. `addHistory()` now tags every entry with `round` and `playerIdx`. `showRoundDetail(round, pidx)` renders and opens the modal. | - | - |

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
| ~~UI-8~~ | ~~UX / Colour~~ | ~~Resolved~~ — "Erst Rot/Grün würfeln" disabled footer state changed from `btn-warn` to `btn-danger` (red). | — | — | — |
| ~~UI-9~~ | ~~UX / Pause~~ | ~~Resolved~~ — Footer shows "Andere Aktion wählen …" when time window is invalid or `pauseDone` is true. "Pause wählen …" shown only when pause is genuinely available but not yet chosen. | — | — | — |
| ~~UI-11~~ | ~~CSS / Housekeeping~~ | ~~Resolved~~ — All UI-5 extracted classes integrated into their logical sections (`── CARDS ──`, `── DICE AREA ──`, `── BUTTONS ──`, `── RESULT BOX ──`, `── ACCORDION CARDS ──`, `── SCOREBOARD ──`, `── SETUP FORM ──`, `── SLOPE SELECTOR ──`, `── HEADER ──`). New `── SIGHTINGS ──` section added for `.sighting-pill`, `.sighting-remove`, `#sightingsDisplay`. Old appendix block and its header comment removed. | — | — |
| ~~UI-10~~ | ~~Dice placeholder~~ | ~~Resolved~~ The placeholder for the bergauf dice is now "fussweg" but it should be the same question mark dice as for the bergab dice. | 🟡 Moderate | Put the same placeholder as for the bergab (the '?') | — |

