import { defineConfig } from 'astro/config';

// P0/P1: isolated static preview only. No production routes or assets overwritten.
// P2 will explicitly compose approved pages into the existing Vite/Worker deploy.
export default defineConfig({
  site: 'https://artisys.dev',
  output: 'static',
  outDir: './dist-preview',
  build: { assets: '_artisys-marketing' },
  devToolbar: { enabled: false }
});
