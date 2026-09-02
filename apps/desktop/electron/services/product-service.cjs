const EDITIONS = new Set(['construtora', 'empreiteira'])
const KEY = 'edicao_produto'

class ProductService {
  constructor({ db }) {
    this.db = db
    this.forcedEdition = EDITIONS.has(process.env.FLUXO_DRE_EDITION) ? process.env.FLUXO_DRE_EDITION : null
  }

  getEdition() {
    if (this.forcedEdition) return { edition: this.forcedEdition, locked: true }
    const saved = this.db.db.prepare('SELECT valor FROM configuracoes WHERE chave=?').get(KEY)?.valor
    return { edition: EDITIONS.has(saved) ? saved : 'construtora', locked: false }
  }

  setEdition(edition) {
    if (!EDITIONS.has(edition)) throw new Error('Edição do produto inválida.')
    if (this.forcedEdition) throw new Error('Esta edição foi definida no pacote instalado e não pode ser alterada aqui.')
    this.db.db.prepare('INSERT INTO configuracoes(chave,valor,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP').run(KEY, edition)
    return this.getEdition()
  }
}

module.exports = { ProductService }
