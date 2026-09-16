import { defineConfig } from 'vite';
import { applyPrivateNoindexHtml, applyPublicSeoHtml } from './seo-transform.mjs';

const PRIVATE_HTML = ['sistema.html', 'gestao.html', 'obra.html', 'universidade.html'];

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'artisys-seo',
      enforce: 'pre',
      transformIndexHtml(html, ctx) {
        const filename = String(ctx.filename || '').replaceAll('\\', '/');
        if (filename.endsWith('/index.html')) return applyPublicSeoHtml(html);
        if (PRIVATE_HTML.some((file) => filename.endsWith(`/${file}`))) return applyPrivateNoindexHtml(html);
        return html;
      }
    }
  ],
  build: {
    rollupOptions: {
      input: ['index.html', 'sistema.html', 'gestao.html', 'obra.html', 'universidade.html'],
      maxParallelFileOps: 128
    }
  }
});
