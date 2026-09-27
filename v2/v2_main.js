// ═══════════════════════════════════════════════════════════════
// App v2 — entry point. Loads the saved game, registers all screens, starts the router.
// ═══════════════════════════════════════════════════════════════

import { loadGame, loadPad } from './v2_store.js';
import { initRouter, go } from './v2_router.js';
import { initChrome, showChrome, renderChrome } from './v2_chrome.js';
import { closeSheet } from './v2_sheet.js';

// Screen modules register themselves on import.
import './screens/home_screen.js';
import './screens/setup_screens.js';
import './screens/turn_start_screen.js';
import './screens/bergauf_screens.js';
import './screens/bergab_screens.js';
import './screens/pause_screen.js';
import './screens/menu_screens.js';
import './screens/game_end_screens.js';
import './screens/punkteblock_screen.js';
import './screens/turn_end_screen.js';
import './screens/round_event_screen.js';

loadGame();
loadPad();
initChrome();
initRouter(document.getElementById('outlet'), (id, def) => {
  closeSheet();
  showChrome(def.chrome, def.quickActions);
  if (def.chrome) renderChrome();
});

go('home');
