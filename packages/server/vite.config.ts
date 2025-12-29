import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: './src/main.ts',
      formats: ['es'],
      fileName: 'main',
    },
    rollupOptions: {
      external: [],
    },
  },
});
