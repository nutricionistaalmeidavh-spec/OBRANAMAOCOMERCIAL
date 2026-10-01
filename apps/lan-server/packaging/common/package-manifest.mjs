const SUPPORTED_PLATFORMS = new Set(['win32', 'linux'])
const SUPPORTED_ARCHES = new Set(['x64'])

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} é obrigatório.`)
  return value.trim()
}

export function createPackageManifest({ productVersion, commitSha, nodeVersion, platform, arch, builtAt = new Date().toISOString() } = {}) {
  const normalizedPlatform = requiredString(platform, 'platform')
  const normalizedArch = requiredString(arch, 'arch')
  if (!SUPPORTED_PLATFORMS.has(normalizedPlatform)) throw new Error(`platform não suportada: ${normalizedPlatform}`)
  if (!SUPPORTED_ARCHES.has(normalizedArch)) throw new Error(`arch não suportada: ${normalizedArch}`)
  const manifest = {
    productVersion: requiredString(productVersion, 'productVersion'),
    commitSha: requiredString(commitSha, 'commitSha'),
    nodeVersion: requiredString(nodeVersion, 'nodeVersion'),
    platform: normalizedPlatform,
    arch: normalizedArch,
    builtAt: requiredString(builtAt, 'builtAt')
  }
  return Object.freeze(manifest)
}
