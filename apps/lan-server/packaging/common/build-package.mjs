import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createPackageManifest } from './package-manifest.mjs'

function copyDirectory(source, destination) {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Error(`Diretório obrigatório ausente: ${source}`)
  fs.cpSync(source, destination, { recursive: true, force: true })
}

function safePlatformDestination(outputDir, destination) {
  const platformRoot = path.resolve(outputDir, 'platform')
  const resolved = path.resolve(platformRoot, destination)
  if (resolved !== platformRoot && !resolved.startsWith(`${platformRoot}${path.sep}`)) throw new Error('Destino de arquivo de plataforma inválido.')
  return resolved
}

export function verifySha256(filePath, expectedSha256) {
  const expected = String(expectedSha256 || '').trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('SHA-256 esperado inválido para verificação de checksum.')
  const actual = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
  if (actual !== expected) throw new Error(`Falha de checksum SHA-256: esperado ${expected}, recebido ${actual}.`)
  return actual
}

export function buildServerPackage({ repoRoot, outputDir, platform, arch, commitSha, nodeBinaryPath, platformFiles = [], builtAt } = {}) {
  const root = path.resolve(repoRoot || '.')
  const target = path.resolve(outputDir || '')
  if (!outputDir) throw new Error('outputDir é obrigatório.')
  const serverRoot = path.join(root, 'apps', 'lan-server')
  const packageJsonPath = path.join(serverRoot, 'package.json')
  const nvmrcPath = path.join(root, '.nvmrc')
  if (!fs.existsSync(packageJsonPath)) throw new Error(`package.json do servidor ausente: ${packageJsonPath}`)
  if (!fs.existsSync(nvmrcPath)) throw new Error(`.nvmrc ausente: ${nvmrcPath}`)
  if (!nodeBinaryPath || !fs.existsSync(nodeBinaryPath)) throw new Error('Runtime Node extraído não foi informado ou não existe.')

  const product = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const manifest = createPackageManifest({
    productVersion: product.version,
    commitSha,
    nodeVersion: fs.readFileSync(nvmrcPath, 'utf8').trim(),
    platform,
    arch,
    builtAt
  })

  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(path.join(target, 'app'), { recursive: true })
  fs.mkdirSync(path.join(target, 'runtime'), { recursive: true })
  fs.mkdirSync(path.join(target, 'metadata'), { recursive: true })
  fs.mkdirSync(path.join(target, 'platform'), { recursive: true })

  copyDirectory(path.join(serverRoot, 'src'), path.join(target, 'app', 'src'))
  copyDirectory(path.join(serverRoot, 'migrations'), path.join(target, 'app', 'migrations'))
  const remoteAssets = path.join(serverRoot, 'packaging', 'remote')
  if (fs.existsSync(remoteAssets)) copyDirectory(remoteAssets, path.join(target, 'remote'))
  fs.copyFileSync(packageJsonPath, path.join(target, 'app', 'package.json'))

  const runtimeName = platform === 'win32' ? 'node.exe' : 'node'
  const runtimeTarget = path.join(target, 'runtime', runtimeName)
  fs.copyFileSync(nodeBinaryPath, runtimeTarget)
  if (platform === 'linux') fs.chmodSync(runtimeTarget, 0o755)

  for (const item of platformFiles) {
    if (!item || typeof item.source !== 'string' || typeof item.destination !== 'string') throw new Error('Arquivo de plataforma inválido.')
    const destination = safePlatformDestination(target, item.destination)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(item.source, destination)
  }

  fs.writeFileSync(path.join(target, 'metadata', 'build.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return Object.freeze({ outputDir: target, manifest })
}
