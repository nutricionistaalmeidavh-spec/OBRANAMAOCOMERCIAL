import domainCore from './domain-core.cjs'
const { stockBalance,resolveStockMaterial }=domainCore
import { createHash } from 'node:crypto'
import { FieldRdoCatalog } from './field-rdo-catalog.mjs'

const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ')
const materialKey = (description, unit) => `${clean(description).toLocaleLowerCase('pt-BR')}|${clean(unit).toLocaleLowerCase('pt-BR')}`
const quantity = n => Math.round(Number(n) * 1e6) / 1e6
const signature = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/**
 * An RDO material revision is a replacement of the desired consumed amounts.
 * Only the net delta is journaled into movimentacoes_estoque, within the same
 * SQLite transaction as the revision and idempotency receipt. The PWA is not
 * allowed to invent its own stock balance.
 */
export class RdoMaterialConsumption {
  constructor({ repository }) {
    if (!repository?.get || !repository?.save || !repository?.connection) throw new Error('Repositório operacional indisponível.')
    this.repository = repository
    this.db = repository.connection()
  }

  list(rdoId) {
    const rdo = this.repository.get('rdos', Number(rdoId))
    if (!rdo) throw new Error('RDO não encontrado.')
    const current = this.db.prepare('SELECT revisao FROM rdo_material_revisoes WHERE rdo_id=?').get(rdo.id)
    const items = this.db.prepare('SELECT linha_id AS id, material_id, servico, frente_id, descricao, unidade, quantidade FROM rdo_material_linhas WHERE rdo_id=? ORDER BY linha_id').all(rdo.id)
    return { rdoId: rdo.id, obraId: rdo.obra_id, revision: Number(current?.revisao || 0), items }
  }

  save(input = {}) {
    const rdoId = Number(input.rdoId)
    const requestId = clean(input.requestId)
    const expectedRevision = Number(input.expectedRevision)
    if (!Number.isSafeInteger(rdoId) || rdoId < 1) throw new Error('RDO inválido para consumo de materiais.')
    if (!requestId || requestId.length > 128) throw new Error('Identificador idempotente inválido.')
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('Revisão esperada inválida.')
    if (!Array.isArray(input.items) || input.items.length > 200) throw new Error('Lista de materiais inválida (máximo 200 itens).')

    const lines = input.items.map(row => ({
      id: clean(row.id),
      material_id: clean(row.material_id),
      servico: clean(row.servico),
      frente_id: row.frente_id == null || row.frente_id === '' ? null : Number(row.frente_id),
      descricao: clean(row.descricao),
      unidade: clean(row.unidade || 'un'),
      quantidade: quantity(row.quantidade)
    })).sort((a, b) => a.id.localeCompare(b.id))
    if (new Set(lines.map(row => row.id)).size !== lines.length) throw new Error('Identificador de material repetido.')
    for (const row of lines) {
      if (!row.id || row.id.length > 128 || row.material_id.length > 80 || row.servico.length > 120 || !row.descricao || row.descricao.length > 250 || !row.unidade || row.unidade.length > 24 || !Number.isFinite(row.quantidade) || row.quantidade <= 0 || row.quantidade > 1e9) {
        throw new Error('Material, unidade ou quantidade inválidos.')
      }
      if (row.frente_id !== null && (!Number.isSafeInteger(row.frente_id) || row.frente_id < 1)) throw new Error('Frente de serviço inválida.')
    }
    const fingerprint = signature({ rdoId, lines })
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const replay = this.db.prepare('SELECT * FROM rdo_material_requisicoes WHERE request_id=?').get(requestId)
      if (replay) {
        if (Number(replay.rdo_id) !== rdoId || replay.payload_hash !== fingerprint) throw new Error('Chave idempotente reutilizada com outros dados.')
        this.db.exec('COMMIT')
        return { rdoId, revision: Number(replay.revisao), replayed: true, ...this.list(rdoId) }
      }
      const rdo = this.repository.get('rdos', rdoId)
      if (!rdo || rdo.deleted_at) throw new Error('RDO não encontrado.')
      if (['fechado','finalizado','concluido'].includes(String(rdo.status))) throw new Error('Reabra o RDO antes de alterar o consumo de materiais.')
      const current = this.db.prepare('SELECT revisao FROM rdo_material_revisoes WHERE rdo_id=?').get(rdoId)
      const revision = Number(current?.revisao || 0)
      if (expectedRevision !== revision) throw new Error('Conflito de revisão: outro usuário atualizou os materiais deste RDO.')
      const work = this.repository.get('obras', Number(rdo.obra_id))
      if (!work || work.deleted_at) throw new Error('Obra do RDO indisponível.')

      for (const row of lines) {
        if (row.frente_id !== null) {
          const front = this.repository.get('frentes_obra', row.frente_id)
          if (!front || Number(front.obra_id) !== Number(rdo.obra_id) || front.deleted_at) throw new Error('Frente não pertence à obra do RDO.')
        }
      }

      const catalog=new FieldRdoCatalog({repository:this.repository})
      for(const row of lines){const m=catalog.requireMaterial(rdo.obra_id,row);row.material_id='mat_'+m.uid;row.descricao=m.descricao;row.unidade=m.unidade}
      const previous = this.db.prepare('SELECT linha_id AS id, frente_id, descricao, unidade, quantidade FROM rdo_material_linhas WHERE rdo_id=?').all(rdoId)
      const deltas = new Map()
      const add = (row, amount) => {
        const material=resolveStockMaterial(this.db,{obra_id:rdo.obra_id,descricao:row.descricao,unidade:row.unidade})
        if(!material)throw new Error('Material histórico não classificado; revise o catálogo antes de ajustar o RDO.')
        const key = JSON.stringify([material.id,row.frente_id??null])
        const existing = deltas.get(key) || { material_id:material.id,descricao:material.descricao,unidade:material.unidade,frente_id:row.frente_id??null,delta:0 }
        existing.delta = quantity(existing.delta + amount)
        deltas.set(key, existing)
      }
      for (const row of previous) add(row, -Number(row.quantidade))
      for (const row of lines) add(row, row.quantidade)

      const netByMaterial=new Map()
      for(const row of deltas.values()){const key=row.material_id;const total=netByMaterial.get(key)||{material_id:row.material_id,descricao:row.descricao,unidade:row.unidade,delta:0};total.delta=quantity(total.delta+row.delta);netByMaterial.set(key,total)}
      for (const row of netByMaterial.values()) {
        if (row.delta <= 0) continue
        const balance=stockBalance(this.db,{obra_id:rdo.obra_id,material_id:row.material_id,descricao:row.descricao,unidade:row.unidade},{allStages:true})
        if (balance + 1e-6 < row.delta) throw new Error(`Saldo insuficiente para ${row.descricao} (${row.unidade}). Disponível: ${balance}.`)
      }

      this.db.prepare('DELETE FROM rdo_material_linhas WHERE rdo_id=?').run(rdoId)
      const writeLine = this.db.prepare('INSERT INTO rdo_material_linhas(rdo_id,linha_id,material_id,servico,frente_id,descricao,unidade,quantidade) VALUES(?,?,?,?,?,?,?,?)')
      for (const row of lines) writeLine.run(rdoId, row.id, row.material_id||null, row.servico||null, row.frente_id, row.descricao, row.unidade, row.quantidade)
      if (current) this.db.prepare('UPDATE rdo_material_revisoes SET revisao=?,updated_at=CURRENT_TIMESTAMP WHERE rdo_id=?').run(revision + 1, rdoId)
      else this.db.prepare('INSERT INTO rdo_material_revisoes(rdo_id,revisao) VALUES(?,?)').run(rdoId, 1)
      this.db.prepare('INSERT INTO rdo_material_requisicoes(request_id,rdo_id,revisao,payload_hash) VALUES(?,?,?,?)').run(requestId, rdoId, revision + 1, fingerprint)
      for (const row of deltas.values()) {
        if (Math.abs(row.delta) < 1e-6) continue
        const type = row.delta > 0 ? 'saida' : 'entrada'
        const movement = this.repository.save('movimentacoes_estoque', {
          obra_id: rdo.obra_id, material_id:row.material_id, frente_id: row.frente_id, tipo: type,
          descricao: row.descricao, unidade: row.unidade, quantidade: Math.abs(row.delta),
          data: rdo.data, observacoes: `Ajuste de consumo RDO #${rdoId} (revisão ${revision + 1})`,
          request_id: `rdo:${requestId}:${signature(JSON.stringify([materialKey(row.descricao, row.unidade),row.frente_id])).slice(0,16)}`
        })
        this.db.prepare('INSERT INTO rdo_material_efeitos(rdo_id,request_id,movimentacao_id,descricao,unidade,delta_quantidade) VALUES(?,?,?,?,?,?)')
          .run(rdoId, requestId, movement.id, row.descricao, row.unidade, row.delta)
      }
      this.db.exec('COMMIT')
      return { ...this.list(rdoId), replayed: false }
    } catch (error) {
      try { this.db.exec('ROLLBACK') } catch {}
      throw error
    }
  }
}
