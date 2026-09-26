// ═══════════════════════════════════════════════════════════════
// App v2 — entry point. Loads the saved game, registers all screens, starts the router.
// ═══════════════════════════════════════════════════════════════

import { loadGame } from './v2_store.js';
import { initRouter, go } from './v2_router.js';
import { initChrome, showChrome, renderChrome } from './v2_chrome.js';
import { closeSheet } from './v2_sheet.js';

// Screen modules register themselves on import.
import './screens/home_screen.js';
import './screens/setup_screens.js';
import './screens/turn_start_screen.js';
import './screens/turn_end_screen.js';
import './screens/round_event_screen.js';
import './screens/placeholder_screens.js';

loadGame();
initChrome();
initRouter(document.getElementById('outlet'), (id, def) => {
  closeSheet();
  showChrome(def.chrome, def.quickActions);
  if (def.chrome) renderChrome();
});

go('home');
