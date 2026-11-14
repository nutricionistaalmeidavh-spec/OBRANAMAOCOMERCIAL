import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const base = fileURLToPath(new URL('../', import.meta.url));
const text = (p) => readFileSync(resolve(base, p), 'utf8');
const html = text('public/wppprospector/index.html');
const css = text('public/wppprospector/style.css');
const bundle = resolve(base, 'public/wppprospector/experience/experience.js');
const stylesheet = resolve(base, 'public/wppprospector/experience/experience.css');
const app = text('src/wppprospector/experience.tsx');
const manifest = JSON.parse(text('package.json'));

for (const dep of ['react','react-dom','motion','embla-carousel-react','react-parallax-tilt','lenis','@radix-ui/react-slot','class-variance-authority']) {
  assert.ok(manifest.dependencies[dep], `missing self-hosted CRM enhancement: ${dep}`);
}
assert.match(html, /id="crm-hero-visual"/, 'real-image enhancement should mount without removing static fallback');
assert.match(html, /id="galeria"/, 'SEO and no-JS gallery fallback must remain present');
assert.match(html, /experience\/experience.js/, 'page must use a built, self-hosted bundle');
assert.match(html, /experience\/experience.css/, 'page must self-host CSS');
assert.match(html, /analytics-config.js/, 'analytics must be explicit and configurable');
assert.match(html, /analytics.js/, 'analytics must not be a silent paid dependency');
assert.match(app, /useEmblaCarousel/, 'Embla must drive screenshot interaction');
assert.match(app, /MagicCard/, 'Magic UI highlight must be implemented');
assert.match(app, /InView/, 'Motion Primitives entry must be implemented');
assert.match(app, /ParallaxTilt/, 'react-parallax-tilt should be progressive enhancement');
assert.match(app, /Button/, 'shadcn UI button should be used for accessible controls');
assert.match(app, /prefers-reduced-motion|useReducedMotion/, 'motion must respect reduced motion');
assert.match(app, /lenis/, 'optional Lenis module must be discoverable');
assert.doesNotMatch(app, /react-three-fiber|tsparticles/, 'P2 and P3 heavy effects are not mandatory');
assert.match(css, /prefers-reduced-motion/, 'core must respect reduced motion');
assert.ok(statSync(bundle).size > 40000, 'React, Motion, Embla experience must be bundled locally');
const browserBundle = readFileSync(bundle, 'utf8');
assert.doesNotMatch(browserBundle, /\bprocess\.env\b/, 'client JS bundle must not depend on Node process.env');

assert.ok(statSync(stylesheet).size > 1000, 'enhancement styles must be built locally');
const config = text('public/wppprospector/analytics-config.js');
assert.match(config, /enabled: false/, 'analytics should remain disabled until self-host setup');
console.log('WppProspector OSS integration gate passed');
