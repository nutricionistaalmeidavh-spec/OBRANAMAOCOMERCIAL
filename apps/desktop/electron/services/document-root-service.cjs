const fs = require('node:fs')
const path = require('node:path')
const { dialog, shell } = require('electron')

const KEY = 'documentos_pasta_raiz'

class DocumentRootService {
  constructor({ db, files, defaultDir }) {
    this.db = db
    this.files = files
    this.defaultDir = defaultDir
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
    fs.cpSync(source, destination, { recursive: true, force: false, errorOnExist: false })
  }

  async chooseRoot() {
    const picked = await dialog.showOpenDialog({ title: 'Escolha a pasta raiz da documentação', properties: ['openDirectory','createDirectory'] })
    if (picked.canceled || !picked.filePaths[0]) return null
    const selected = path.resolve(picked.filePaths[0])
    const previous = this.files.documentsDir
    fs.mkdirSync(selected, { recursive: true })
    if (path.resolve(previous) !== selected && fs.existsSync(previous) && fs.readdirSync(previous).length) {
      const answer = await dialog.showMessageBox({ type: 'question', buttons: ['Copiar arquivos existentes','Usar sem copiar','Cancelar'], defaultId: 0, cancelId: 2, title: 'Alterar pasta da documentação', message: 'Deseja copiar a documentação atual para a nova pasta?', detail: 'Os arquivos existentes não serão apagados da pasta anterior.' })
      if (answer.response === 2) return null
      if (answer.response === 0) this.copyExisting(previous, selected)
    }
    this.db.db.prepare(`INSERT INTO configuracoes(chave,valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP`).run(KEY, selected)
    this.files.documentsDir = selected
    this.mirrorStructure(selected)
    return { path: selected, previous }
  }

  openRoot() { fs.mkdirSync(this.files.documentsDir, { recursive: true }); return shell.openPath(this.files.documentsDir) }
}

module.exports = { DocumentRootService }
