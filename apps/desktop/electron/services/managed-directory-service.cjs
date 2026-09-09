const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const DEFAULT_MAX_PREVIEW_BYTES = 12 * 1024 * 1024
const INTERNAL_TRASH_DIR = '.fluxo-dre-delete-staging'
const PREVIEW_TYPES = new Map([
  ['.pdf', { previewKind: 'pdf', mimeType: 'application/pdf' }],
  ['.png', { previewKind: 'image', mimeType: 'image/png' }],
  ['.jpg', { previewKind: 'image', mimeType: 'image/jpeg' }],
  ['.jpeg', { previewKind: 'image', mimeType: 'image/jpeg' }],
  ['.gif', { previewKind: 'image', mimeType: 'image/gif' }],
  ['.webp', { previewKind: 'image', mimeType: 'image/webp' }],
  ['.bmp', { previewKind: 'image', mimeType: 'image/bmp' }]
])
const INVALID_NAME = /[<>:"/\\|?*\x00-\x1F]/
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

function portablePath(value) { return String(value || '').split(path.sep).join('/') }
function escapesRoot(relative) { return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) }
function validateName(value) {
  const name = String(value || '')
  if (!name || name === '.' || name === '..' || name === INTERNAL_TRASH_DIR || name !== name.trim() || INVALID_NAME.test(name) || /[. ]$/.test(name) || RESERVED_NAME.test(name)) throw new Error('Nome inválido.')
  return name
}

class ManagedDirectoryService {
  constructor({ roots, shell, dialog, maxPreviewBytes, onPathChanged, onPathRemoved } = {}) {
    this.roots = roots || {}; this.shell = shell; this.dialog = dialog
    this.onPathChanged = onPathChanged; this.onPathRemoved = onPathRemoved
    this.maxPreviewBytes = Number.isFinite(maxPreviewBytes) && Number(maxPreviewBytes) > 0 ? Number(maxPreviewBytes) : DEFAULT_MAX_PREVIEW_BYTES
  }
  rootFor(rootId) {
    const resolver = this.roots[String(rootId || '')]
    if (!resolver) throw new Error('Área de arquivos não autorizada.')
    const raw = typeof resolver === 'function' ? resolver() : resolver
    if (!raw || typeof raw !== 'string') throw new Error('Área de arquivos indisponível.')
    const root = path.resolve(raw)
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error('Pasta raiz de documentos indisponível.')
    return root
  }
  normalizeRelative(relativePath = '') {
    if (relativePath == null || relativePath === '') return ''
    if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) throw new Error('Caminho inválido.')
    const segments = relativePath.split(/[\\/]+/).filter((segment) => segment && segment !== '.')
    if (segments.some((segment) => segment === '..')) throw new Error('Caminho fora da área gerenciada.')
    if (segments.some((segment) => segment === INTERNAL_TRASH_DIR)) throw new Error('Caminho reservado ao sistema.')
    return segments.join(path.sep)
  }
  resolve(rootId, relativePath = '') {
    const root = this.rootFor(rootId), relativeNative = this.normalizeRelative(relativePath), target = path.resolve(root, relativeNative)
    if (escapesRoot(path.relative(root, target))) throw new Error('Caminho fora da área gerenciada.')
    if (!fs.existsSync(target)) throw new Error('Arquivo ou pasta não encontrado.')
    const rootReal = fs.realpathSync(root), targetReal = fs.realpathSync(target)
    if (escapesRoot(path.relative(rootReal, targetReal))) throw new Error('Caminho fora da área gerenciada.')
    return { root, target, relativeNative, stat: fs.statSync(target) }
  }
  resolveDestination(rootId, parentRelativePath = '', name) {
    const parent = this.resolve(rootId, parentRelativePath)
    if (!parent.stat.isDirectory()) throw new Error('O destino informado não é uma pasta.')
    if (fs.lstatSync(parent.target).isSymbolicLink()) throw new Error('Atalhos simbólicos não podem ser usados como destino.')
    const safeName = validateName(name), target = path.join(parent.target, safeName), relativeNative = path.relative(parent.root, target)
    if (escapesRoot(relativeNative)) throw new Error('Caminho fora da área gerenciada.')
    return { ...parent, target, relativeNative }
  }
  assertMutableSource(resolved) {
    if (!resolved.relativeNative) throw new Error('Não é permitido alterar a pasta raiz.')
    if (fs.lstatSync(resolved.target).isSymbolicLink()) throw new Error('Atalhos simbólicos não podem ser alterados.')
  }
  list({ rootId, relativePath = '' } = {}) {
    const resolved = this.resolve(rootId, relativePath)
    if (!resolved.stat.isDirectory()) throw new Error('O caminho informado não é uma pasta.')
    const parentNative = resolved.relativeNative ? path.dirname(resolved.relativeNative) : ''
    const parentRelativePath = !resolved.relativeNative ? null : portablePath(parentNative === '.' ? '' : parentNative)
    const items = fs.readdirSync(resolved.target, { withFileTypes: true }).filter((entry) => entry.name !== INTERNAL_TRASH_DIR).map((entry) => {
      const absolute = path.join(resolved.target, entry.name), stat = fs.lstatSync(absolute), isLink = stat.isSymbolicLink()
      const kind = isLink ? 'link' : entry.isDirectory() ? 'folder' : entry.isFile() ? 'file' : 'link'
      return { name: entry.name, relativePath: portablePath(path.relative(resolved.root, absolute)), kind, extension: kind === 'file' ? path.extname(entry.name).toLowerCase() : '', size: kind === 'file' ? stat.size : null, modifiedAt: stat.mtime.toISOString(), canOpen: !isLink && (entry.isDirectory() || entry.isFile()) }
    }).sort((left, right) => {
      const weight = { folder: 0, file: 1, link: 2 }, difference = weight[left.kind] - weight[right.kind]
      return difference || left.name.localeCompare(right.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
    })
    return { rootId: String(rootId), name: resolved.relativeNative ? path.basename(resolved.target) : path.basename(resolved.root), relativePath: portablePath(resolved.relativeNative), parentRelativePath, items }
  }
  preview({ rootId, relativePath } = {}) {
    const resolved = this.resolve(rootId, relativePath), linkStat = fs.lstatSync(resolved.target)
    if (linkStat.isSymbolicLink()) throw new Error('Atalhos simbólicos não podem ser visualizados por este explorador.')
    if (!resolved.stat.isFile()) throw new Error('Somente arquivos podem ser visualizados.')
    const extension = path.extname(resolved.target).toLowerCase(), previewType = PREVIEW_TYPES.get(extension)
    const base = { rootId: String(rootId), name: path.basename(resolved.target), relativePath: portablePath(resolved.relativeNative), extension, size: resolved.stat.size, modifiedAt: resolved.stat.mtime.toISOString(), previewKind: previewType?.previewKind || 'unsupported', mimeType: previewType?.mimeType || null, dataUrl: null, previewBlockedReason: previewType ? null : 'type' }
    if (!previewType) return base
    if (resolved.stat.size > this.maxPreviewBytes) return { ...base, previewKind: 'unsupported', previewBlockedReason: 'size' }
    const bytes = fs.readFileSync(resolved.target)
    return { ...base, previewKind: previewType.previewKind, mimeType: previewType.mimeType, dataUrl: `data:${previewType.mimeType};base64,${bytes.toString('base64')}`, previewBlockedReason: null }
  }
  createFolder({ rootId, parentRelativePath = '', name } = {}) {
    const destination = this.resolveDestination(rootId, parentRelativePath, name)
    if (fs.existsSync(destination.target)) throw new Error('Já existe um item com esse nome no destino.')
    fs.mkdirSync(destination.target)
    return { name: path.basename(destination.target), relativePath: portablePath(destination.relativeNative) }
  }
  rename({ rootId, relativePath, newName } = {}) {
    const source = this.resolve(rootId, relativePath); this.assertMutableSource(source)
    const parentRelativePath = portablePath(path.dirname(source.relativeNative) === '.' ? '' : path.dirname(source.relativeNative))
    const destination = this.resolveDestination(rootId, parentRelativePath, newName)
    if (fs.existsSync(destination.target)) throw new Error('Já existe um item com esse nome no destino.')
    fs.renameSync(source.target, destination.target)
    try { this.onPathChanged?.(source.target, destination.target) } catch (error) { try { fs.renameSync(destination.target, source.target) } catch {}; throw error }
    return { name: path.basename(destination.target), relativePath: portablePath(destination.relativeNative) }
  }
  move({ rootId, relativePath, destinationRelativePath = '' } = {}) {
    const source = this.resolve(rootId, relativePath); this.assertMutableSource(source)
    const destinationFolder = this.resolve(rootId, destinationRelativePath)
    if (!destinationFolder.stat.isDirectory()) throw new Error('O destino informado não é uma pasta.')
    if (fs.lstatSync(destinationFolder.target).isSymbolicLink()) throw new Error('Atalhos simbólicos não podem ser usados como destino.')
    if (source.stat.isDirectory()) { const nested = path.relative(source.target, destinationFolder.target); if (!nested || (!nested.startsWith('..' + path.sep) && nested !== '..' && !path.isAbsolute(nested))) throw new Error('Uma pasta não pode ser movida para dentro dela mesma.') }
    const target = path.join(destinationFolder.target, path.basename(source.target))
    if (fs.existsSync(target)) throw new Error('Já existe um item com esse nome no destino.')
    fs.renameSync(source.target, target)
    try { this.onPathChanged?.(source.target, target) } catch (error) { try { fs.renameSync(target, source.target) } catch {}; throw error }
    return { name: path.basename(target), relativePath: portablePath(path.relative(source.root, target)) }
  }
  cleanupStaging(stagingRoot) {
    try { if (fs.existsSync(stagingRoot) && fs.readdirSync(stagingRoot).length === 0) fs.rmdirSync(stagingRoot) } catch {}
  }
  remove({ rootId, relativePath, recursive = false } = {}) {
    const source = this.resolve(rootId, relativePath); this.assertMutableSource(source)
    if (source.stat.isDirectory() && fs.readdirSync(source.target).length > 0 && !recursive) throw new Error('A pasta não está vazia.')

    const stagingRoot = path.join(source.root, INTERNAL_TRASH_DIR)
    fs.mkdirSync(stagingRoot, { recursive: true })
    const staged = path.join(stagingRoot, `${Date.now()}-${crypto.randomUUID()}-${path.basename(source.target)}`)
    fs.renameSync(source.target, staged)

    try {
      this.onPathRemoved?.(source.target)
    } catch (error) {
      try {
        fs.renameSync(staged, source.target)
        this.cleanupStaging(stagingRoot)
      } catch (recoveryError) {
        throw new Error(`Falha ao atualizar o banco e restaurar o item. O conteúdo foi preservado em ${staged}. ${error?.message || error}; ${recoveryError?.message || recoveryError}`, { cause: error })
      }
      throw error
    }

    try { fs.rmSync(staged, { recursive: source.stat.isDirectory(), force: false }) }
    catch (error) { console.error(`Exclusão lógica concluída, mas a limpeza física pendente ficou em ${staged}.`, error) }
    this.cleanupStaging(stagingRoot)
    return true
  }
  importFiles({ rootId, destinationRelativePath = '', sourcePaths } = {}) {
    const destination = this.resolve(rootId, destinationRelativePath)
    if (!destination.stat.isDirectory()) throw new Error('O destino informado não é uma pasta.')
    if (fs.lstatSync(destination.target).isSymbolicLink()) throw new Error('Atalhos simbólicos não podem ser usados como destino.')
    if (!Array.isArray(sourcePaths) || !sourcePaths.length) return []
    const pending = sourcePaths.map((sourcePath) => {
      if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath) || !fs.existsSync(sourcePath)) throw new Error('Arquivo de origem indisponível.')
      const stat = fs.lstatSync(sourcePath); if (stat.isSymbolicLink()) throw new Error('Atalhos simbólicos não podem ser importados.'); if (!stat.isFile()) throw new Error('Somente arquivos podem ser importados.')
      const name = validateName(path.basename(sourcePath)), target = path.join(destination.target, name)
      if (fs.existsSync(target)) throw new Error('Já existe um item com esse nome no destino.')
      return { sourcePath, name, target, relativePath: portablePath(path.relative(destination.root, target)) }
    })
    const copied = []
    try { for (const item of pending) { fs.copyFileSync(item.sourcePath, item.target, fs.constants.COPYFILE_EXCL); copied.push(item.target) }; return pending.map(({ name, relativePath }) => ({ name, relativePath })) }
    catch (error) { for (const target of copied.reverse()) fs.rmSync(target, { force: true }); throw error }
  }
  async pickImportFiles({ rootId, destinationRelativePath = '' } = {}) {
    if (!this.dialog?.showOpenDialog) throw new Error('Seletor de arquivos indisponível.')
    const result = await this.dialog.showOpenDialog({ title: 'Importar arquivos', properties: ['openFile', 'multiSelections'] })
    if (result.canceled || !result.filePaths?.length) return []
    return this.importFiles({ rootId, destinationRelativePath, sourcePaths: result.filePaths })
  }
  async open({ rootId, relativePath = '' } = {}) {
    const resolved = this.resolve(rootId, relativePath)
    if (fs.lstatSync(resolved.target).isSymbolicLink()) throw new Error('Atalhos simbólicos não podem ser abertos por este explorador.')
    if (!this.shell?.openPath) throw new Error('Integração com o sistema operacional indisponível.')
    return this.shell.openPath(resolved.target)
  }
}
module.exports = { ManagedDirectoryService, portablePath, validateName, DEFAULT_MAX_PREVIEW_BYTES, INTERNAL_TRASH_DIR }
