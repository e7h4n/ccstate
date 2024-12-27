import { defineConfig } from 'vite';

export default defineConfig({
  root: './e2e',
  build: {
    rollupOptions: {
      input: {
        app: './index.html',
      },
    },
  },
});
