import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';
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
  test: {
    exclude: [...configDefaults.exclude, 'qa/runtime/**']
  },
  build: {
    rollupOptions: {
      input: ['index.html', 'sistema.html', 'gestao.html', 'obra.html', 'universidade.html', 'src/finance-landing/entry.tsx'],
      output: {
        // Stable local entry for the SEO-first Financeiro page copied from public/.
        // Other site and system bundles retain Vite's original hashed behavior.
        entryFileNames(chunk) {
          const path = chunk.facadeModuleId?.replaceAll('\\\\', '/') || '';
          return path.endsWith('/src/finance-landing/entry.tsx')
            ? 'assets/finance-landing.js'
            : 'assets/[name]-[hash].js';
        }
      },
      maxParallelFileOps: 128
    }
  }
});
