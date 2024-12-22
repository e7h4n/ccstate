import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  test: {
    environment: 'happy-dom',
    deps: {
      // https://dev.to/mbarzeev/update-testing-a-solidjs-component-using-vitest-1pj9
      inline: [/solid-js/, /solid-testing-library/],
    },
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
