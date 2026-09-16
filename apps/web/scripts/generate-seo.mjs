import { mkdirSync, writeFileSync } from 'node:fs';
import { artisysSeoConfig } from '../seo.config.mjs';
import { buildRobotsTxt, buildSitemapXml } from '../vendor/artisys-seo/technical.mjs';

const publicDir = new URL('../public/', import.meta.url);
mkdirSync(publicDir, { recursive: true });
writeFileSync(new URL('../public/robots.txt', import.meta.url), buildRobotsTxt(artisysSeoConfig));
writeFileSync(new URL('../public/sitemap.xml', import.meta.url), buildSitemapXml(artisysSeoConfig));
console.log('SEO public assets generated');
