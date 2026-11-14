import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Overlay ONLY the public catalog and the isolated, hashed Astro assets.
 * Never changes the existing landing pages, API, D1, OAuth or payment routes.
 */
export function overlayMarketingAssets({ productionDir, astroDir }) {
  const destination = resolve(productionDir);
  const source = resolve(astroDir);
  const htmlPath = resolve(source, 'index.html');
  const assetsPath = resolve(source, '_artisys-marketing');
  if (!existsSync(htmlPath)) throw new Error('Astro production catalog was not built');
  if (!existsSync(assetsPath) || !statSync(assetsPath).isDirectory()) throw new Error('Astro assets not found');
  const html = readFileSync(htmlPath, 'utf8');
  if (!html.includes('data-artisys-marketing="p2-p3"') ||
      !html.includes('https://artisys.dev/sistemas/') ||
      !html.includes('data-catalog-item')) {
    throw new Error('Unexpected Astro HTML: refusing to replace the catalog');
  }
  const assets = readdirSync(assetsPath, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).length;
  if (assets < 1) throw new Error('Astro bundle contains no assets');
  mkdirSync(resolve(destination, 'sistemas'), { recursive: true });
  cpSync(assetsPath, resolve(destination, '_artisys-marketing'), { recursive: true, force: true });
  copyFileSync(htmlPath, resolve(destination, 'sistemas/index.html'));
  return { assets, page: '/sistemas/index.html' };
}
