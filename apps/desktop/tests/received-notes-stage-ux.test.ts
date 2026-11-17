import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root=path.resolve(import.meta.dirname,'..')
const read=(filename:string)=>fs.readFileSync(path.resolve(root,filename),'utf8')

describe('UX canônica de etapas, subetapas e notas recebidas',()=>{
  it('usa a mesma terminologia para construtora e empreiteira',()=>{
    const fronts=read('src/pages/FrontsPage.tsx')
    const routes=read('src/routes/registry.ts')
    const works=read('src/pages/WorksPage.tsx')
    const procurement=read('src/pages/ProcurementPage.tsx')
    for(const text of [fronts,routes,works,procurement]) {
      expect(text).not.toContain('Frentes de servico')
      expect(text).not.toContain('Frentes de serviço')
    }
    expect(fronts).toContain('Etapas e subetapas')
    expect(fronts).toContain('Adicionar subetapa')
    expect(fronts).toContain('Criar primeira subetapa')
    expect(fronts).toContain('Salvar subetapa')
    expect(works).toContain("novaEtapa=1")
    expect(fronts).toContain("if (newFront) setSubForm")
    expect(fronts).not.toContain('setSelectedFront(String(fronts.data[0].id))\n      setSelectedSub')
  })
  it('trata cronograma como programação ligada à etapa, incluindo atraso calculado',()=>{
    const schedule=read('src/pages/SchedulePage.tsx')
    const fronts=read('src/pages/FrontsPage.tsx')
    expect(schedule).toContain('Cronograma e planejamento')
    expect(schedule).toContain('Etapa da obra')
    expect(schedule).toContain('isLate(item)')
    expect(schedule).toContain("frente_id: form.frente_id ? Number(form.frente_id) : null")
    expect(fronts).toContain('Atrasada no cronograma')
    expect(fronts).toContain('Programar etapa no cronograma')
  })
  it('cadastra notas recebidas com vários itens, subetapa e referência opcional a pedido/conta/documento',()=>{
    const notes=read('src/components/ReceivedNotesSection.tsx')
    const preload=read('electron/preload.cjs')
    const source=read('electron/services/procurement-source-service.cjs')
    expect(notes).toContain('Adicionar item')
    expect(notes).toContain('Subetapa')
    expect(notes).toContain('Item do pedido já cadastrado')
    expect(notes).toContain('Vincular conta existente')
    expect(notes).toContain('Anexar PDF ou imagem')
    expect(notes).toContain('importReceivedNote')
    expect(notes).toContain('Novo fornecedor')
    expect(notes).toContain('Salvar alterações')
    expect(notes).toContain('Sem gerar contas ou estoque')
    expect(preload).toContain("received-notes:create")
    expect(source).toContain("listReceivedNotes")
    expect(source).toContain("receivedNotesSummary")
  })
})
