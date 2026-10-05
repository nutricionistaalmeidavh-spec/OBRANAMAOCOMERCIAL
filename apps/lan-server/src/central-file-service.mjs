import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

const safeName = value => String(value || 'arquivo').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().slice(0, 160) || 'arquivo'

export class CentralFileService {
  constructor({ repository, rootDir }) {
    if (!repository?.save || !repository?.get) throw new Error('Repositório central inválido para arquivos.')
    this.repository = repository
    this.rootDir = path.resolve(rootDir)
    fs.mkdirSync(this.rootDir, { recursive: true })
  }

  physicalPath(file) {
    const stored = safeName(file?.nome_armazenado)
    const target = path.resolve(this.rootDir, stored)
    const relative = path.relative(this.rootDir, target)
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error('Arquivo central fora da área gerenciada.')
    return target
  }

  saveBuffer(buffer, { originalName = 'arquivo', mimeType = null, origin = 'importado' } = {}) {
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
    if (!data.length) throw new Error('Arquivo vazio não pode ser armazenado.')
    const extension = path.extname(String(originalName || '')).toLowerCase()
    const token = randomUUID().replaceAll('-', '')
    const storedName = `${token}${extension}`
    const destination = path.join(this.rootDir, storedName)
    fs.writeFileSync(destination, data, { flag:'wx' })
    const hash = createHash('sha256').update(data).digest('hex')
    try {
      const created = this.repository.save('arquivos', {
        nome_original:safeName(path.basename(String(originalName || 'arquivo'))),
        nome_armazenado:storedName,
        caminho:`server://file/${token}`,
        tamanho:data.length,
        extensao:extension || null,
        mime_type:mimeType || null,
        hash,
        origem:origin
      })
      return this.repository.save('arquivos', { id:created.id, caminho:`server://file/${created.id}` }) || created
    } catch (error) {
      try { fs.unlinkSync(destination) } catch {}
      throw error
    }
  }

  read(id) {
    const file = this.repository.get('arquivos', Number(id))
    if (!file) throw new Error('Arquivo central não encontrado.')
    const filename = this.physicalPath(file)
    if (!fs.existsSync(filename)) throw new Error('Conteúdo físico do arquivo central não foi encontrado.')
    return { file, buffer:fs.readFileSync(filename) }
  }

  remove(id) {
    const file = this.repository.get('arquivos', Number(id))
    if (!file) return true
    const filename = this.physicalPath(file)
    if (fs.existsSync(filename)) fs.unlinkSync(filename)
    this.repository.remove('arquivos', Number(id))
    return true
  }
}
