import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test this checkout, not the ignored historical copies under .kilo.
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
