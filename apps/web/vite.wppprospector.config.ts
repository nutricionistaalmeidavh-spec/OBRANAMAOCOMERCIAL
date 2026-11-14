import { defineConfig } from 'vite';

// Only the WppProspector public page gets the React enhancement.
// The main Obra na Mão portal remains unchanged.
export default defineConfig({
  publicDir: false,
  // Vite library builds preserve process.env by default; browser clients cannot
  // execute the React runtime if Node's global process leaks into the output.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}'
  },
  build: {
    outDir: 'public/wppprospector/experience',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: 'src/wppprospector/experience.tsx',
      formats: ['es'],
      fileName: 'experience',
      cssFileName: 'experience'
    },
    rollupOptions: {
      output: {
        assetFileNames: 'experience.css'
      }
    }
  }
});
