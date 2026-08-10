import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { createEditorMapApiPlugin } from './scripts/editor-map-api.mjs';

export default defineConfig({
  plugins: [createEditorMapApiPlugin()],
  build: {
    rollupOptions: {
      input: {
        editor: resolve(process.cwd(), 'index.html'),
        home: resolve(process.cwd(), 'home.html'),
        play: resolve(process.cwd(), 'play.html'),
        encyclopedia: resolve(process.cwd(), 'enemy-encyclopedia.html'),
        sandbox: resolve(process.cwd(), 'sandbox.html'),
        tutorial: resolve(process.cwd(), 'tutorial.html'),
      },
    },
  },
});
