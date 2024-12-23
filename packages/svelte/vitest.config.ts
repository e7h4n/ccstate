import { defineConfig, type Plugin } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte() as Plugin[]],
  test: {
    environment: 'happy-dom',
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
