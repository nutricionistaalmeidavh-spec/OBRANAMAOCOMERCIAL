const LAYOUTS = new Set(['command-center', 'classic'])
const LAYOUT_KEY = 'layout_interface'

class UiPreferencesService {
  constructor({ db }) {
    this.db = db
  }

  getLayout() {
    const saved = this.db.db.prepare('SELECT valor FROM configuracoes WHERE chave=?').get(LAYOUT_KEY)?.valor
    return LAYOUTS.has(saved) ? saved : 'command-center'
  }

  setLayout(layout) {
    if (!LAYOUTS.has(layout)) throw new Error('Layout de interface invalido.')
    this.db.db.prepare('INSERT INTO configuracoes(chave,valor,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP').run(LAYOUT_KEY, layout)
    return this.getLayout()
  }
}

module.exports = { UiPreferencesService }
