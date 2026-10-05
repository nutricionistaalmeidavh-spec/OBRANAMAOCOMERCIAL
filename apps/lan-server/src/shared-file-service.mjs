import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const MAX_FILE_BYTES = 48 * 1024 * 1024

function safeExt(name = '') {
  const ext = path.extname(String(name || '')).toLowerCase()
  return /^[.][a-z0-9]{1,12}$/i.test(ext) ? ext : ''
}

function decodeBase64(contentBase64) {
  const value = String(contentBase64 || '')
  if (!value) throw new Error('Conteúdo do arquivo não informado.')
  const buffer = Buffer.from(value, 'base64')
  if (!buffer.length) throw new Error('Arquivo compartilhado vazio ou inválido.')
  if (buffer.length > MAX_FILE_BYTES) throw new Error('Arquivo excede o limite de 48 MB para compartilhamento no servidor local.')
  return buffer
}

export class SharedFileService {
  constructor({ repository, dataDir }) {
    if (!repository?.save || !repository?.get) throw new Error('Repositório central inválido para arquivos.')
    if (!dataDir) throw new Error('Diretório central de arquivos não informado.')
    this.repository = repository
    this.root = path.resolve(dataDir, 'shared-files')
    fs.mkdirSync(this.root, { recursive:true })
  }

  physicalPath(file) {
    const stored = path.basename(String(file?.nome_armazenado || ''))
    if (!stored) throw new Error('Arquivo central sem nome armazenado.')
    const target = path.resolve(this.root, stored)
    const relative = path.relative(this.root, target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Caminho de arquivo central inválido.')
    return target
  }

  storeFile(file = {}, contentBase64) {
    const buffer = decodeBase64(contentBase64)
    const ext = safeExt(file.nome_original || file.nome_armazenado)
    const storedName = `${randomUUID()}${ext}`
    const target = path.join(this.root, storedName)
    fs.writeFileSync(target, buffer, { flag:'wx' })
    try {
      const saved = this.repository.save('arquivos', {
        nome_original:String(file.nome_original || file.nome_armazenado || `arquivo${ext}`),
        nome_armazenado:storedName,
        caminho:`lan://arquivo/${randomUUID()}`,
        tamanho:buffer.length,
        extensao:file.extensao || ext || null,
        mime_type:file.mime_type || null,
        hash:file.hash || null,
        origem:file.origem || 'compartilhado'
      })
      const updated = this.repository.save('arquivos', { id:saved.id, caminho:`lan://arquivo/${saved.id}` })
      return updated || saved
    } catch (error) {
      try { fs.unlinkSync(target) } catch {}
      throw error
    }
  }

  storeMigratedFile(data = {}) {
    const { __file_base64:contentBase64, ...file } = data
    if (!contentBase64) throw new Error(`Arquivo local não pôde ser enviado ao servidor: ${file.nome_original || file.caminho || 'arquivo sem nome'}.`)
    return this.storeFile(file, contentBase64)
  }

  importDocument(payload = {}) {
    const { file = {}, document = {}, link = null } = payload
    const db = this.repository.connection()
    db.exec('BEGIN IMMEDIATE;')
    let savedFile = null
    try {
      savedFile = this.storeFile(file, file.contentBase64)
      const savedDocument = this.repository.save('documentos', {
        ...document,
        arquivo_id:savedFile.id,
        versao:Number(document.versao || 1),
        status_assinatura:document.status_assinatura || 'geral'
      })
      if (link?.kind === 'measurement') {
        this.repository.save('medicao_anexos', { medicao_id:Number(link.id), documento_id:savedDocument.id, tipo:link.tipo || 'comprovante' })
      } else if (link?.kind === 'rdo') {
        this.repository.save('rdo_anexos', { rdo_id:Number(link.id), documento_id:savedDocument.id, frente_id:document.frente_id || null, legenda:link.legenda || document.titulo || null })
      } else if (link?.kind === 'contract') {
        this.repository.save('contrato_anexos', { contrato_id:Number(link.id), documento_id:savedDocument.id, tipo:link.tipo || 'contrato' })
      } else if (link?.kind === 'purchase') {
        this.repository.save('pedido_compra_anexos', { pedido_compra_id:Number(link.id), documento_id:savedDocument.id, tipo:link.tipo || 'nota' })
      }
      db.exec('COMMIT;')
      return { document:savedDocument, file:savedFile }
    } catch (error) {
      try { db.exec('ROLLBACK;') } catch {}
      if (savedFile) {
        try { fs.unlinkSync(this.physicalPath(savedFile)) } catch {}
      }
      throw error
    }
  }

  content(fileId) {
    const file = this.repository.get('arquivos', Number(fileId))
    if (!file) throw new Error('Arquivo compartilhado não encontrado.')
    const target = this.physicalPath(file)
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error('Conteúdo físico do arquivo compartilhado não foi encontrado no servidor.')
    const buffer = fs.readFileSync(target)
    return {
      file:{ id:file.id, nome_original:file.nome_original, mime_type:file.mime_type, tamanho:buffer.length, caminho:file.caminho },
      contentBase64:buffer.toString('base64')
    }
  }

  deleteDocument({ id, deletePhysical = false } = {}) {
    const document = this.repository.get('documentos', Number(id))
    if (!document) return true
    const file = document.arquivo_id ? this.repository.get('arquivos', Number(document.arquivo_id)) : null
    this.repository.remove('documentos', Number(id))
    if (deletePhysical && file) {
      try { fs.unlinkSync(this.physicalPath(file)) } catch {}
      try { this.repository.remove('arquivos', Number(file.id)) } catch {}
    }
    return true
  }
}

export { MAX_FILE_BYTES }
