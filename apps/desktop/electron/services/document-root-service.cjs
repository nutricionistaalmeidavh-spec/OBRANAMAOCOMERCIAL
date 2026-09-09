const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { dialog, shell } = require('electron')
const { applyPathMappings, pathMappingsForRoot } = require('./file-registry-paths.cjs')

const KEY = 'documentos_pasta_raiz'

function sha256(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

class DocumentRootService {
  constructor({ db, files, defaultDir, dialogApi = dialog, shellApi = shell }) {
    this.db = db
    this.files = files
    this.defaultDir = defaultDir
    this.dialog = dialogApi
    this.shell = shellApi
    const configured = this.getConfigured()
    this.files.documentsDir = configured || defaultDir
    fs.mkdirSync(this.files.documentsDir, { recursive: true })
  }

  getConfigured() {
    return this.db.db.prepare('SELECT valor FROM configuracoes WHERE chave=?').get(KEY)?.valor || null
  }

  getRoot() { return this.files.documentsDir }

  mirrorStructure(root) {
    fs.mkdirSync(root, { recursive: true })
    for (const company of this.db.list('empresas')) {
      const companyFolder = path.join(root, this.files.constructor.sanitizeName ? this.files.constructor.sanitizeName(company.nome_fantasia || company.razao_social) : String(company.nome_fantasia || company.razao_social))
      fs.mkdirSync(path.join(companyFolder, 'Funcionários'), { recursive: true })
    }
    for (const employee of this.db.list('funcionarios')) {
      const company = employee.empresa_id ? this.db.get('empresas', employee.empresa_id) : null
      this.files.employeeFolders(employee, company?.nome_fantasia || company?.razao_social)
    }
  }

  copyExisting(source, destination) {
    if (!source || !fs.existsSync(source) || path.resolve(source) === path.resolve(destination)) return
    fs.mkdirSync(destination, { recursive: true })
    for (const entry of fs.readdirSync(source)) {
      fs.cpSync(path.join(source, entry), path.join(destination, entry), { recursive: true, force: false, errorOnExist: false })
    }
  }

  mappingIsValid(mapping) {
    if (!fs.existsSync(mapping.nextPath) || !fs.statSync(mapping.nextPath).isFile()) return false
    if (fs.existsSync(mapping.previousPath) && fs.statSync(mapping.previousPath).isFile()) return sha256(mapping.nextPath) === sha256(mapping.previousPath)
    if (mapping.hash) return sha256(mapping.nextPath) === mapping.hash
    return true
  }

  async warnUnsafeRootChange(mappings) {
    if (!this.dialog?.showMessageBox) return
    await this.dialog.showMessageBox({
      type: 'warning',
      buttons: ['OK'],
      defaultId: 0,
      title: 'Pasta de documentação não alterada',
      message: 'A nova pasta não contém uma cópia válida de todos os documentos registrados.',
      detail: `${mappings.length} arquivo(s) registrado(s) não puderam ser confirmado(s) no novo local. A pasta atual e os registros foram preservados.`
    })
  }

  async chooseRoot() {
    const picked = await this.dialog.showOpenDialog({ title: 'Escolha a pasta raiz da documentação', properties: ['openDirectory','createDirectory'] })
    if (picked.canceled || !picked.filePaths[0]) return null
    const selected = path.resolve(picked.filePaths[0])
    const previous = path.resolve(this.files.documentsDir)
    fs.mkdirSync(selected, { recursive: true })

    if (previous !== selected && fs.existsSync(previous) && fs.readdirSync(previous).length) {
      const answer = await this.dialog.showMessageBox({ type: 'question', buttons: ['Copiar arquivos existentes','Usar sem copiar','Cancelar'], defaultId: 0, cancelId: 2, title: 'Alterar pasta da documentação', message: 'Deseja copiar a documentação atual para a nova pasta?', detail: 'Os arquivos existentes não serão apagados da pasta anterior. Se escolher usar sem copiar, o Fluxo DRE só concluirá a troca se os documentos registrados já existirem no novo local.' })
      if (answer.response === 2) return null
      if (answer.response === 0) this.copyExisting(previous, selected)
    }

    const mappings = previous === selected ? [] : pathMappingsForRoot(this.db, previous, selected)
    const invalidMappings = mappings.filter((mapping) => !this.mappingIsValid(mapping))
    if (invalidMappings.length) {
      await this.warnUnsafeRootChange(invalidMappings)
      return null
    }

    this.db.db.transaction(() => {
      applyPathMappings(this.db, mappings)
      this.db.db.prepare(`INSERT INTO configuracoes(chave,valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP`).run(KEY, selected)
    })()
    this.files.documentsDir = selected
    this.mirrorStructure(selected)
    return { path: selected, previous, remapped: mappings.length }
  }

  openRoot() { fs.mkdirSync(this.files.documentsDir, { recursive: true }); return this.shell.openPath(this.files.documentsDir) }
}

module.exports = { DocumentRootService, KEY }
