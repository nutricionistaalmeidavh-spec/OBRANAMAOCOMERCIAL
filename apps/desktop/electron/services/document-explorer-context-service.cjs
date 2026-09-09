const fs = require('node:fs')
const path = require('node:path')
const { INTERNAL_TRASH_DIR } = require('./managed-directory-service.cjs')

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function digits(value) {
  return String(value || '').replace(/\D/g, '')
}

function portable(value) {
  return String(value || '').split(path.sep).join('/')
}

function competenceFromPath(relativePath) {
  const match = portable(relativePath).match(/(?:^|\/)Recibos\/(\d{4})\/(0[1-9]|1[0-2])\s*-\s*[^/]+(?:\/|$)/i)
  return match ? `${match[1]}-${match[2]}` : null
}

function statusFromPath(relativePath, fallback = 'geral') {
  const parts = portable(relativePath).split('/')
  if (parts.some((part) => normalize(part) === 'assinados')) return 'assinado'
  if (parts.some((part) => normalize(part) === 'nao assinados')) return 'nao_assinado'
  return fallback || 'geral'
}

function versionedTarget(destination) {
  if (!fs.existsSync(destination)) return destination
  const extension = path.extname(destination)
  const stem = path.basename(destination, extension)
  const folder = path.dirname(destination)
  let version = 2
  let candidate
  do { candidate = path.join(folder, `${stem} (${version++})${extension}`) } while (fs.existsSync(candidate))
  return candidate
}

class DocumentExplorerContextService {
  constructor({ db, explorer, rootId = 'documents' }) {
    this.db = db
    this.explorer = explorer
    this.rootId = rootId
  }

  databaseContext(absolutePath) {
    return this.db.db.prepare(`SELECT
      a.id AS arquivo_id,
      d.id AS documento_id,
      d.categoria,
      d.status_assinatura,
      d.funcionario_id,
      f.nome AS funcionario_nome,
      f.cpf AS funcionario_cpf
      FROM arquivos a
      LEFT JOIN documentos d ON d.arquivo_id=a.id AND d.deleted_at IS NULL
      LEFT JOIN funcionarios f ON f.id=d.funcionario_id AND f.deleted_at IS NULL
      WHERE a.caminho=?
      ORDER BY d.versao DESC,d.id DESC LIMIT 1`).get(absolutePath) || null
  }

  employeeFromPath(relativePath) {
    const parts = portable(relativePath).split('/').filter(Boolean)
    const employeesIndex = parts.findIndex((part) => normalize(part) === 'funcionarios')
    if (employeesIndex < 0 || !parts[employeesIndex + 1]) return null
    const folder = parts[employeesIndex + 1]
    const separator = folder.lastIndexOf(' - ')
    if (separator < 0) return null
    const identity = folder.slice(separator + 3).trim()
    const identityDigits = digits(identity)
    const employees = this.db.db.prepare(`SELECT id,nome,cpf FROM funcionarios WHERE deleted_at IS NULL`).all()
    if (identityDigits.length >= 11) {
      const byCpf = employees.find((employee) => digits(employee.cpf) === identityDigits)
      if (byCpf) return byCpf
    }
    if (/^\d+$/.test(identity)) {
      const byId = employees.find((employee) => Number(employee.id) === Number(identity))
      if (byId) return byId
    }
    return null
  }

  context({ rootId = this.rootId, relativePath } = {}) {
    const resolved = this.explorer.resolve(rootId, relativePath)
    if (!resolved.stat.isFile()) throw new Error('O contexto documental está disponível somente para arquivos.')
    if (fs.lstatSync(resolved.target).isSymbolicLink()) throw new Error('Atalhos simbólicos não possuem contexto documental.')
    const row = this.databaseContext(resolved.target)
    const employee = row?.funcionario_id ? { id: row.funcionario_id, nome: row.funcionario_nome, cpf: row.funcionario_cpf } : this.employeeFromPath(resolved.relativeNative)
    return {
      relativePath: portable(resolved.relativeNative),
      employee: employee ? { id: employee.id, nome: employee.nome, cpf: employee.cpf || null } : null,
      competencia: competenceFromPath(resolved.relativeNative),
      categoria: row?.categoria || null,
      status: statusFromPath(resolved.relativeNative, row?.status_assinatura),
      documentId: row?.documento_id || null,
      arquivoId: row?.arquivo_id || null
    }
  }

  moveToSigned({ rootId = this.rootId, relativePath } = {}) {
    const source = this.explorer.resolve(rootId, relativePath)
    if (!source.stat.isFile()) throw new Error('Somente arquivos podem ser movidos para Assinados.')
    if (fs.lstatSync(source.target).isSymbolicLink()) throw new Error('Atalhos simbólicos não podem ser movidos.')
    const sourceFolder = path.dirname(source.target)
    if (normalize(path.basename(sourceFolder)) !== 'nao assinados') throw new Error('O arquivo precisa estar em Não assinados.')

    const signedFolder = path.join(path.dirname(sourceFolder), 'Assinados')
    const rootReal = fs.realpathSync(source.root)
    let ancestor = signedFolder
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor)
    const relativeReal = path.relative(rootReal, fs.realpathSync(ancestor))
    if (relativeReal === '..' || relativeReal.startsWith(`..${path.sep}`) || path.isAbsolute(relativeReal)) throw new Error('Destino fora da área gerenciada.')
    fs.mkdirSync(signedFolder, { recursive: true })
    const destination = versionedTarget(path.join(signedFolder, path.basename(source.target)))

    fs.renameSync(source.target, destination)
    try {
      this.db.db.transaction(() => {
        const files = this.db.db.prepare('SELECT id FROM arquivos WHERE caminho=?').all(source.target)
        for (const file of files) {
          this.db.db.prepare('UPDATE arquivos SET caminho=?,nome_armazenado=? WHERE id=?').run(destination, path.basename(destination), file.id)
          this.db.db.prepare("UPDATE documentos SET status_assinatura='assinado' WHERE arquivo_id=? AND deleted_at IS NULL").run(file.id)
        }
      })()
    } catch (error) {
      try { fs.renameSync(destination, source.target) } catch {}
      throw error
    }

    const relative = portable(path.relative(source.root, destination))
    const refreshed = this.context({ rootId, relativePath: relative })
    return { ...refreshed, relativePath: relative, status: 'assinado' }
  }

  async index({ rootId = this.rootId } = {}) {
    const root = this.explorer.rootFor(rootId)
    const items = []
    const walk = async (folder) => {
      const entries = await fs.promises.readdir(folder, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === INTERNAL_TRASH_DIR) continue
        const absolute = path.join(folder, entry.name)
        const stat = await fs.promises.lstat(absolute)
        if (stat.isSymbolicLink()) continue
        if (entry.isDirectory()) await walk(absolute)
        else if (entry.isFile()) {
          const relativePath = portable(path.relative(root, absolute))
          try { items.push(this.context({ rootId, relativePath })) } catch {}
        }
      }
    }
    await walk(root)
    items.sort((a, b) => String(a.employee?.nome || '').localeCompare(String(b.employee?.nome || ''), 'pt-BR') || String(a.competencia || '').localeCompare(String(b.competencia || '')) || a.relativePath.localeCompare(b.relativePath, 'pt-BR'))
    const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
    const employeeMap = new Map()
    for (const item of items) if (item.employee) employeeMap.set(item.employee.id, item.employee)
    return {
      items,
      facets: {
        employees: [...employeeMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        competencias: unique(items.map((item) => item.competencia)),
        categorias: unique(items.map((item) => item.categoria)),
        statuses: unique(items.map((item) => item.status))
      }
    }
  }
}

module.exports = { DocumentExplorerContextService, competenceFromPath, statusFromPath, versionedTarget }
