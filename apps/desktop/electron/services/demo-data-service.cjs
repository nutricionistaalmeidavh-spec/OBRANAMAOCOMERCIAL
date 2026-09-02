class DemoDataService {
  constructor({ db, product }) {
    this.db = db
    this.product = product
  }

  getOrCreate(table, whereSql, params, data) {
    const existing = this.db.db.prepare(`SELECT * FROM ${table} WHERE ${whereSql} LIMIT 1`).get(...params)
    if (existing) return existing
    return this.db.save(table, data)
  }

  seed() {
    return this.db.db.transaction(() => {
      try { this.product.setEdition('empreiteira') } catch {}
      const empresa = this.getOrCreate('empresas', 'cnpj=? AND deleted_at IS NULL', ['00.000.000/0001-00'], {
        razao_social: 'Demo Engenharia e Instalacoes Ltda',
        nome_fantasia: 'Demo Obras',
        cnpj: '00.000.000/0001-00',
        status: 'ativa'
      })
      const cliente = this.getOrCreate('clientes', 'nome=? AND deleted_at IS NULL', ['Condominio Jardim das Aguas'], {
        empresa_id: empresa.id,
        nome: 'Condominio Jardim das Aguas',
        documento: '11.111.111/0001-11'
      })
      const fornecedor = this.getOrCreate('fornecedores', 'nome=? AND deleted_at IS NULL', ['HidroFort Materiais'], {
        empresa_id: empresa.id,
        nome: 'HidroFort Materiais',
        documento: '22.222.222/0001-22'
      })
      const obra = this.getOrCreate('obras', 'nome=? AND deleted_at IS NULL', ['Obra Demo - Torre A'], {
        empresa_id: empresa.id,
        cliente_id: cliente.id,
        nome: 'Obra Demo - Torre A',
        codigo: 'DEMO-TA',
        endereco: 'Rua das Instalacoes, 100',
        responsavel: 'Eng. Marina Costa',
        valor_contratado_centavos: 42000000,
        data_inicio: '2026-08-01',
        previsao_termino: '2026-12-20',
        status: 'em_execucao',
        status_operacional: 'em_execucao',
        percentual_fisico: 38
      })
      const hidraulica = this.getOrCreate('frentes_obra', 'obra_id=? AND nome=? AND deleted_at IS NULL', [obra.id, 'Hidraulica'], {
        obra_id: obra.id,
        nome: 'Hidraulica',
        codigo: 'HID',
        ordem: 1,
        status: 'ativa',
        observacoes: 'Instalacoes hidrossanitarias da Torre A.'
      })
      const eletrica = this.getOrCreate('frentes_obra', 'obra_id=? AND nome=? AND deleted_at IS NULL', [obra.id, 'Eletrica'], {
        obra_id: obra.id,
        nome: 'Eletrica',
        codigo: 'ELE',
        ordem: 2,
        status: 'ativa'
      })
      const prumadas = this.getOrCreate('subfrentes_obra', "frente_id=? AND nome=? AND COALESCE(pavimento,'')=? AND deleted_at IS NULL", [hidraulica.id, 'Prumadas', 'Geral'], {
        obra_id: obra.id,
        frente_id: hidraulica.id,
        nome: 'Prumadas',
        codigo: 'HID-PRU',
        pavimento: 'Geral',
        escopo: 'Prumadas de agua fria, agua quente, esgoto e ventilacao.',
        ordem: 1,
        status: 'ativa'
      })
      const barrilete = this.getOrCreate('subfrentes_obra', "frente_id=? AND nome=? AND COALESCE(pavimento,'')=? AND deleted_at IS NULL", [hidraulica.id, 'Barrilete', 'Cobertura'], {
        obra_id: obra.id,
        frente_id: hidraulica.id,
        nome: 'Barrilete',
        codigo: 'HID-BAR',
        pavimento: 'Cobertura',
        escopo: 'Distribuicao superior e registros principais.',
        ordem: 2,
        status: 'ativa'
      })
      const checklist = [
        ['1o pavimento', 'Conferir shafts liberados', 'concluido'],
        ['1o pavimento', 'Fixar tubulacao PPR agua quente', 'em_andamento'],
        ['2o pavimento', 'Executar coluna de esgoto DN100', 'pendente'],
        ['3o pavimento', 'Teste de estanqueidade por trecho', 'pendente'],
        ['Geral', 'Registrar fotos antes do fechamento', 'pendente']
      ]
      for (const [pavimento, descricao, status] of checklist) {
        this.getOrCreate('checklist_frente_itens', 'subfrente_id=? AND pavimento=? AND descricao=? AND deleted_at IS NULL', [prumadas.id, pavimento, descricao], {
          obra_id: obra.id,
          frente_id: hidraulica.id,
          subfrente_id: prumadas.id,
          pavimento,
          descricao,
          tipo: 'execucao',
          status,
          responsavel: 'Carlos Lima',
          prazo: status === 'concluido' ? '2026-08-08' : '2026-08-20',
          concluido_em: status === 'concluido' ? '2026-08-08' : null
        })
      }
      const etapa = this.getOrCreate('etapas_obra', 'obra_id=? AND nome=?', [obra.id, 'Instalacoes hidraulicas'], {
        obra_id: obra.id,
        nome: 'Instalacoes hidraulicas',
        ordem: 1,
        status: 'em_andamento',
        frente_id: hidraulica.id
      })
      const itemBudget = this.getOrCreate('itens_orcamentarios', 'obra_id=? AND codigo=? AND deleted_at IS NULL', [obra.id, 'HID-001'], {
        obra_id: obra.id,
        frente_id: hidraulica.id,
        etapa_id: etapa.id,
        codigo: 'HID-001',
        descricao: 'Execucao de prumadas hidraulicas por pavimento',
        unidade: 'pav',
        quantidade: 12,
        valor_unitario_centavos: 1850000,
        tipo: 'servico',
        observacoes: 'Modelo ficticio para demonstracao.'
      })
      this.getOrCreate('cronograma_etapas', 'obra_id=? AND nome=? AND deleted_at IS NULL', [obra.id, 'Prumadas hidraulicas'], {
        obra_id: obra.id,
        etapa_id: etapa.id,
        frente_id: hidraulica.id,
        nome: 'Prumadas hidraulicas',
        responsavel: 'Carlos Lima',
        previsto_inicio: '2026-08-01',
        previsto_fim: '2026-09-15',
        percentual_previsto: 45,
        percentual_realizado: 38,
        custo_planejado_centavos: 22200000,
        custo_realizado_centavos: 8200000,
        status: 'em_andamento'
      })
      const contrato = this.getOrCreate('contratos_obra', 'obra_id=? AND numero=? AND deleted_at IS NULL', [obra.id, 'CT-HID-001'], {
        obra_id: obra.id,
        frente_id: hidraulica.id,
        cliente_id: cliente.id,
        numero: 'CT-HID-001',
        tipo: 'subempreitada',
        descricao: 'Contrato hidraulica Torre A',
        valor_centavos: 42000000,
        retencao_centavos: 2100000,
        garantia: '5% retido ate aceite final',
        reajuste: 'Sem reajuste na demo',
        data_inicio: '2026-08-01',
        data_fim: '2026-12-20',
        status: 'ativo'
      })
      const medicao = this.getOrCreate('medicoes', 'obra_id=? AND numero=? AND deleted_at IS NULL', [obra.id, 'MED-HID-001'], {
        obra_id: obra.id,
        frente_id: hidraulica.id,
        contrato_id: contrato.id,
        numero: 'MED-HID-001',
        competencia: '2026-08',
        data: '2026-08-10',
        periodo_inicio: '2026-08-01',
        periodo_fim: '2026-08-10',
        status: 'faturada',
        descricao: 'Medicao ficticia das prumadas 1o ao 3o pavimento',
        valor_bruto_centavos: 8200000,
        retencoes_centavos: 410000,
        descontos_centavos: 0,
        valor_liquido_centavos: 7790000
      })
      this.getOrCreate('medicao_itens', 'medicao_id=? AND item_orcamentario_id=?', [medicao.id, itemBudget.id], {
        medicao_id: medicao.id,
        item_orcamentario_id: itemBudget.id,
        etapa_id: etapa.id,
        descricao: itemBudget.descricao,
        unidade: 'pav',
        quantidade_total: 12,
        quantidade_periodo: 3,
        quantidade_acumulada: 3,
        valor_periodo_centavos: 8200000
      })
      const categoriaReceita = this.getOrCreate('categorias_financeiras', 'nome=?', ['Receita de medicao'], {
        nome: 'Receita de medicao',
        natureza: 'receita',
        grupo_dre: 'receita_operacional',
        ativa: 1
      })
      this.getOrCreate('contas', 'origem_tipo=? AND origem_id=? AND deleted_at IS NULL', ['medicao_demo', medicao.id], {
        tipo: 'receber',
        empresa_id: empresa.id,
        obra_id: obra.id,
        frente_id: hidraulica.id,
        cliente_id: cliente.id,
        categoria_id: categoriaReceita.id,
        medicao_id: medicao.id,
        descricao: 'Recebimento medicao demo hidraulica',
        competencia: '2026-08',
        vencimento: '2026-08-20',
        valor_bruto_centavos: 8200000,
        retencoes_centavos: 410000,
        valor_centavos: 7790000,
        status: 'pendente',
        origem_tipo: 'medicao_demo',
        origem_id: medicao.id
      })
      const pedido = this.getOrCreate('pedidos_compra', 'obra_id=? AND numero=? AND deleted_at IS NULL', [obra.id, 'PC-HID-001'], {
        obra_id: obra.id,
        frente_id: hidraulica.id,
        fornecedor_id: fornecedor.id,
        numero: 'PC-HID-001',
        descricao: 'Tubos e conexoes PPR para prumadas',
        valor_centavos: 1850000,
        entrega_prevista: '2026-08-12',
        status: 'recebido_parcial'
      })
      const pedidoItem = this.getOrCreate('pedido_compra_itens', 'pedido_compra_id=? AND descricao=?', [pedido.id, 'Tubos e conexoes PPR'], {
        pedido_compra_id: pedido.id,
        descricao: 'Tubos e conexoes PPR',
        unidade: 'lote',
        quantidade_pedida: 1,
        quantidade_recebida: 0.6,
        valor_centavos: 1850000
      })
      this.getOrCreate('movimentacoes_estoque', 'obra_id=? AND pedido_item_id=? AND tipo=?', [obra.id, pedidoItem.id, 'entrada'], {
        obra_id: obra.id,
        frente_id: hidraulica.id,
        pedido_item_id: pedidoItem.id,
        tipo: 'entrada',
        descricao: pedidoItem.descricao,
        unidade: 'lote',
        quantidade: 0.6,
        data: '2026-08-11',
        observacoes: 'Entrada ficticia parcial.'
      })
      const rdo = this.getOrCreate('rdos', 'obra_id=? AND data=? AND deleted_at IS NULL', [obra.id, '2026-08-11'], {
        obra_id: obra.id,
        frente_id: hidraulica.id,
        data: '2026-08-11',
        clima: 'ensolarado',
        status: 'concluido',
        atividades: 'Execucao de prumadas no 1o pavimento e conferencia de shafts.',
        observacoes: 'Demo criada automaticamente.'
      })
      this.getOrCreate('rdo_ocorrencias', 'rdo_id=? AND descricao=?', [rdo.id, 'Falta liberar shaft do 2o pavimento'], {
        rdo_id: rdo.id,
        frente_id: hidraulica.id,
        tipo: 'atraso',
        descricao: 'Falta liberar shaft do 2o pavimento',
        status: 'aberta',
        prioridade: 'alta',
        responsavel: 'Cliente',
        prazo: '2026-08-15'
      })
      this.getOrCreate('tarefas_obra', 'obra_id=? AND titulo=? AND deleted_at IS NULL', [obra.id, 'Liberar shaft do 2o pavimento'], {
        obra_id: obra.id,
        frente_id: hidraulica.id,
        origem_tipo: 'demo',
        titulo: 'Liberar shaft do 2o pavimento',
        descricao: 'Pendencia ficticia gerada para demonstrar acompanhamento por frente.',
        responsavel: 'Cliente',
        prazo: '2026-08-15',
        prioridade: 'alta',
        status: 'aberta'
      })
      this.db.db.prepare('INSERT INTO configuracoes(chave,valor,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP').run('demo_seeded_at', new Date().toISOString())
      return { obra_id: obra.id, frente_id: hidraulica.id, subfrente_id: prumadas.id, medicao_id: medicao.id }
    })()
  }
}

module.exports = { DemoDataService }
