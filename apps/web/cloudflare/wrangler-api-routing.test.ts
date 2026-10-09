import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')) as {
  assets: { run_worker_first?: string[]; not_found_handling?: string };
};

function invokesWorker(path: string): boolean {
  const patterns = config.assets.run_worker_first || [];
  return patterns.some(pattern => pattern.endsWith('*')
    ? path.startsWith(pattern.slice(0, -1))
    : path === pattern);
}

describe('production Worker asset routing regression', () => {
  it('sends all auth and license APIs to the Worker before SPA assets', () => {
    expect(config.assets.not_found_handling).toBe('single-page-application');
    expect(config.assets.run_worker_first).toContain('/api/*');
    for (const path of [
      '/api/auth/config',
      '/api/auth/google-credential',
      '/api/auth/start',
      '/api/auth/callback',
      '/api/auth/me',
      '/api/bootstrap',
      '/api/health',
      '/api/license-center',
      '/api/internal/artisys/license-center',
      '/api/internal/artisys/loja-online/license',
    ]) {
      expect(invokesWorker(path), path).toBe(true);
    }
  });

  it('keeps marketing routes asset-first and existing DevKit redirects on Worker', () => {
    for (const path of ['/', '/index.html', '/sistema.html', '/sistemas/']) {
      expect(invokesWorker(path), path).toBe(false);
    }
    for (const path of ['/devkits/catalogo', '/devkits/catalogo/kits.json']) {
      expect(invokesWorker(path), path).toBe(true);
    }
  });
});
