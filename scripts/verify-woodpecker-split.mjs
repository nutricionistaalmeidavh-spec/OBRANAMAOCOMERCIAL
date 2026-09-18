import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (relative) => readFileSync(resolve(root, relative), 'utf8');
const normalYaml = read('.woodpecker/obra-comercial-qa.yaml');
const normalRunner = read('scripts/woodpecker-qa.ps1');
const elevatedYaml = read('.woodpecker/obra-comercial-desktop-elevated.yaml');
const elevatedRunner = read('scripts/woodpecker-desktop-elevated.ps1');

assert.doesNotMatch(normalRunner, /desktop-dependencies|desktop-tests|desktop-build|electron-binary-prepare/i, 'normal runner must not run desktop gates');
assert.match(normalYaml, /pilot:\s*pdv-artisys/i, 'normal workflow must stay on existing limited agent');
assert.doesNotMatch(normalYaml, /privilege:\s*elevated/i, 'normal workflow must not request elevated agent');

assert.match(elevatedYaml, /privilege:\s*elevated/i);
assert.match(elevatedYaml, /owner:\s*artisys/i);
assert.doesNotMatch(elevatedYaml, /event:\s*pull_request/i, 'elevated workflow must not run for pull requests');
assert.match(elevatedRunner, /artisys-windows-ci/i);
assert.match(elevatedRunner, /IsInRole\([^)]*Administrator/i);
assert.match(elevatedRunner, /npm run test:desktop/i);
assert.doesNotMatch(elevatedRunner, /testNamePattern|symlink.*omit/i, 'elevated desktop suite must not exclude symlink tests');
assert.match(elevatedRunner, /npm run build:desktop/i);
assert.match(elevatedRunner, /electron-binary-prepare/i);
assert.doesNotMatch(elevatedRunner, /wrangler\s+deploy|d1:migrate|github release/i, 'elevated QA must not deploy or publish');

console.log('Woodpecker split contract OK: limited web gate + elevated full desktop gate.');
