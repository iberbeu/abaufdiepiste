import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',   // pure logic tests — no DOM needed
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['game_logic.js'],
    },
  },
});
