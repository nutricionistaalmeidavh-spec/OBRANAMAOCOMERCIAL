import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildServerPackage, verifySha256 } from '../packaging/common/build-package.mjs'
import { createPackageManifest } from '../packaging/common/package-manifest.mjs'

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-packaging-common-'))
  const repoRoot = path.join(root, 'repo')
  const outputDir = path.join(root, 'out')
  fs.mkdirSync(path.join(repoRoot, 'apps/lan-server/src'), { recursive: true })
  fs.mkdirSync(path.join(repoRoot, 'apps/lan-server/migrations'), { recursive: true })
  fs.writeFileSync(path.join(repoRoot, '.nvmrc'), '22.14.0\n')
  fs.writeFileSync(path.join(repoRoot, 'apps/lan-server/src/index.mjs'), 'console.log("server")\n')
  fs.writeFileSync(path.join(repoRoot, 'apps/lan-server/src/helper.mjs'), 'export const ok = true\n')
  fs.writeFileSync(path.join(repoRoot, 'apps/lan-server/migrations/001.sql'), 'select 1;\n')
  fs.writeFileSync(path.join(repoRoot, 'apps/lan-server/package.json'), JSON.stringify({ name: 'obra-na-mao-lan-server', version: '0.3.0', type: 'module' }))
  fs.writeFileSync(path.join(repoRoot, 'DO-NOT-PACK.txt'), 'secret-shaped-but-not-secret')
  const nodeBinaryPath = path.join(root, 'node.exe')
  fs.writeFileSync(nodeBinaryPath, 'fake-node-runtime')
  return { root, repoRoot, outputDir, nodeBinaryPath }
}

test('package manifest exposes only safe reproducible metadata', () => {
  const manifest = createPackageManifest({ productVersion: '0.3.0', commitSha: 'abcdef123456', nodeVersion: '22.14.0', platform: 'win32', arch: 'x64', builtAt: '2026-10-01T20:00:00.000Z' })
  assert.deepEqual(manifest, { productVersion: '0.3.0', commitSha: 'abcdef123456', nodeVersion: '22.14.0', platform: 'win32', arch: 'x64', builtAt: '2026-10-01T20:00:00.000Z' })
  assert.deepEqual(Object.keys(manifest).sort(), ['arch', 'builtAt', 'commitSha', 'nodeVersion', 'platform', 'productVersion'].sort())
})

test('package manifest rejects unsupported platform and architecture', () => {
  assert.throws(() => createPackageManifest({ productVersion: '0.3.0', commitSha: 'abc', nodeVersion: '22.14.0', platform: 'darwin', arch: 'x64' }), /platform/i)
  assert.throws(() => createPackageManifest({ productVersion: '0.3.0', commitSha: 'abc', nodeVersion: '22.14.0', platform: 'linux', arch: 'arm64' }), /arch/i)
})

test('common builder copies only allowlisted server runtime content and bundled node', () => {
  const f = fixture()
  try {
    buildServerPackage({ repoRoot: f.repoRoot, outputDir: f.outputDir, platform: 'win32', arch: 'x64', commitSha: 'abcdef123456', nodeBinaryPath: f.nodeBinaryPath, builtAt: '2026-10-01T20:00:00.000Z' })
    assert.equal(fs.existsSync(path.join(f.outputDir, 'app/src/index.mjs')), true)
    assert.equal(fs.existsSync(path.join(f.outputDir, 'app/src/helper.mjs')), true)
    assert.equal(fs.existsSync(path.join(f.outputDir, 'app/migrations/001.sql')), true)
    assert.equal(fs.existsSync(path.join(f.outputDir, 'app/package.json')), true)
    assert.equal(fs.existsSync(path.join(f.outputDir, 'runtime/node.exe')), true)
    assert.equal(fs.existsSync(path.join(f.outputDir, 'DO-NOT-PACK.txt')), false)
    const metadata = JSON.parse(fs.readFileSync(path.join(f.outputDir, 'metadata/build.json'), 'utf8'))
    assert.equal(metadata.nodeVersion, '22.14.0')
    assert.equal(metadata.platform, 'win32')
    assert.equal(metadata.arch, 'x64')
    assert.equal(JSON.stringify(metadata).includes(f.root), false)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test('common builder keeps the F18 entrypoint unchanged', () => {
  const f = fixture()
  try {
    buildServerPackage({ repoRoot: f.repoRoot, outputDir: f.outputDir, platform: 'linux', arch: 'x64', commitSha: 'abcdef123456', nodeBinaryPath: f.nodeBinaryPath })
    assert.equal(fs.readFileSync(path.join(f.outputDir, 'app/src/index.mjs'), 'utf8'), fs.readFileSync(path.join(f.repoRoot, 'apps/lan-server/src/index.mjs'), 'utf8'))
    assert.equal(fs.existsSync(path.join(f.outputDir, 'runtime/node')), true)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test('checksum verification rejects altered dependencies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-checksum-'))
  try {
    const file = path.join(root, 'vendor.bin')
    fs.writeFileSync(file, 'expected bytes')
    const expected = '89a51c27f6905ba4c9a1e284cc4b9c3678fa6660a953c65475d036e7dddd639b'
    assert.doesNotThrow(() => verifySha256(file, expected))
    fs.appendFileSync(file, 'tampered')
    assert.throws(() => verifySha256(file, expected), /sha-?256|checksum/i)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
