import { defineConfig, coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json-summary', 'json', 'cobertura', 'html'],
      provider: 'v8',
      exclude: [
        ...coverageConfigDefaults.exclude,
        '**/dist/**',
        '**/types/**',
        '**/*.config.*',
        '**/__bench__/**',
        '**/e2e/**',
        'packages/devtools/src/content_scripts.ts',
        'packages/devtools/src/devtools.ts',
        'packages/devtools/src/mocks/**',
      ],
    },
  },
});
