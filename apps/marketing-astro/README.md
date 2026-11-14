# ArtiSys Marketing P0/P1 — Astro Design System

This is an **isolated, non-published static preview**. The production site and Worker remain in `apps/web`. P2 is responsible for integrating the approved routes into the existing build, without replacing it.

## Run locally

```bash
cd apps/marketing-astro
npm install --no-audit --no-fund
npm run check:catalog
npm run build
npm run dev
```

Node.js 22.12+. No paid services, network runtime, login or checkout dependencies.

## Canonical data

`apps/web/public/sistemas/products.json` is the single source of catalog metadata and links. `apps/web/catalog-contract.mjs` validates and exposes the eight approved individual destinations. The existing lactation entry remains in the broader commercial catalog; the retired Oficina Agrícola card is blocked and never reintroduced.

The new ArtiSys Oficina (`/oficina/`) is distinct from the retired Oficina Agrícola listing.

## Visual system

- Palette: #080613, #17102b, #8643ef, #aa62ff; see `src/styles/tokens.css`.
- Kit: `astro-component-kit` (MIT) used in `ArtiSysBento.astro` through the supported cards export.
- Components: button, hero, screenshot frame, product card/grid, bento, CTA and marketing layout.
- Screenshot sources in the preview are *existing, real* site assets, never generated mock-data.
- Motion and Embla are deliberately deferred to P3; the foundation ships zero client-side hydration.
- No provider checkouts, secrets, API or Workers are changed by P0/P1.

## Integration contract for P2

Build output goes to `dist-preview/`, a separate, ignored directory. Do not copy it wholesale to `apps/web/dist`; select only explicitly approved commercial routes and static assets. The current catalog `/sistemas/`, individual system pages, `/api/*`, auth and payments remain the production sources until P2 migration passes regression and SEO QA.
