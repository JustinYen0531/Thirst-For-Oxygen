import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        editor: resolve(process.cwd(), 'index.html'),
        home: resolve(process.cwd(), 'home.html'),
        play: resolve(process.cwd(), 'play.html'),
        encyclopedia: resolve(process.cwd(), 'enemy-encyclopedia.html'),
        sandbox: resolve(process.cwd(), 'sandbox.html'),
      },
    },
  },
});
