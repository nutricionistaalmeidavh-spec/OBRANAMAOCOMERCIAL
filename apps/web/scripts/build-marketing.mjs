import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { overlayMarketingAssets } from './integrate-marketing-astro.mjs';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const astroRoot = resolve(webRoot, '../marketing-astro');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = args => execFileSync(npm, args, { cwd: webRoot, stdio: 'inherit' });

// Compatible with the existing CI, which installs dependencies in apps/web first.
// No paid service, Cloudflare token, database change or secret is needed at build time.
if (!existsSync(resolve(astroRoot, 'node_modules/astro/package.json'))) {
  run(['install', '--prefix', astroRoot, '--no-audit', '--no-fund', '--package-lock=false']);
}
run(['run', 'check:catalog', '--prefix', astroRoot]);
run(['run', 'build', '--prefix', astroRoot]);
const result = overlayMarketingAssets({
  productionDir: resolve(webRoot, 'dist'),
  astroDir: resolve(astroRoot, 'dist-preview')
});
console.log('ArtiSys Marketing integrated:', result);
