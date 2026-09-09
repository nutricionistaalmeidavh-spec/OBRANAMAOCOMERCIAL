import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { INTERNAL_TRASH_DIR, ManagedDirectoryService } from './managed-directory-service.cjs'

const created: string[] = []

function setup(options: { maxPreviewBytes?: number; onPathRemoved?: (target:string) => void } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-explorer-'))
  created.push(root)
  const openPath = vi.fn(async () => '')
  const service = new ManagedDirectoryService({ roots: { documents: () => root }, shell: { openPath }, maxPreviewBytes: options.maxPreviewBytes, onPathRemoved: options.onPathRemoved })
  return { root, openPath, service }
}

afterEach(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('ManagedDirectoryService', () => {
  it('lista somente metadados relativos e ordena pastas antes de arquivos', () => {
    const { root, service } = setup()
    fs.mkdirSync(path.join(root, 'Funcionários'))
    fs.mkdirSync(path.join(root, 'Obras'))
    fs.writeFileSync(path.join(root, 'recibo.pdf'), 'pdf', 'utf8')
    const result = service.list({ rootId: 'documents' })
    expect(result.relativePath).toBe('')
    expect(result.parentRelativePath).toBeNull()
    expect(result.items.map((item: any) => [item.kind, item.name])).toEqual([['folder', 'Funcionários'],['folder', 'Obras'],['file', 'recibo.pdf']])
    expect(result.items.every((item: any) => !path.isAbsolute(item.relativePath))).toBe(true)
    expect(result.items.find((item: any) => item.name === 'recibo.pdf')).toMatchObject({ extension: '.pdf', size: 3, canOpen: true })
  })
  it('navega em subpastas usando caminho relativo portátil', () => {
    const { root, service } = setup()
    const monthly = path.join(root, 'Empresa', 'Funcionários', 'Pessoa', 'Recibos', '2026', '09 - setembro', 'Não assinados')
    fs.mkdirSync(monthly, { recursive: true }); fs.writeFileSync(path.join(monthly, 'Ficha.pdf'), 'conteudo', 'utf8')
    const result = service.list({ rootId: 'documents', relativePath: 'Empresa/Funcionários/Pessoa/Recibos/2026/09 - setembro/Não assinados' })
    expect(result.name).toBe('Não assinados'); expect(result.parentRelativePath).toBe('Empresa/Funcionários/Pessoa/Recibos/2026/09 - setembro'); expect(result.items[0]).toMatchObject({ name: 'Ficha.pdf', kind: 'file' })
  })
  it('bloqueia travessia de diretório e caminhos absolutos', () => {
    const { root, service } = setup(); const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-explorer-outside-')); created.push(outside)
    expect(() => service.list({ rootId: 'documents', relativePath: '../' + path.basename(outside) })).toThrow('fora da área gerenciada')
    expect(() => service.list({ rootId: 'documents', relativePath: path.resolve(root) })).toThrow('Caminho inválido')
  })
  it('abre apenas caminhos existentes dentro da raiz autorizada', async () => {
    const { root, openPath, service } = setup(); const folder = path.join(root, 'Funcionários'); fs.mkdirSync(folder)
    await expect(service.open({ rootId: 'documents', relativePath: 'Funcionários' })).resolves.toBe(''); expect(openPath).toHaveBeenCalledWith(folder)
    await expect(service.open({ rootId: 'documents', relativePath: 'inexistente' })).rejects.toThrow('não encontrado')
    await expect(service.open({ rootId: 'unknown', relativePath: '' })).rejects.toThrow('não autorizada')
  })
  it('gera preview interno somente para PDF e imagens e retorna metadados relativos', () => {
    const { root, service } = setup(); fs.writeFileSync(path.join(root, 'contrato.pdf'), Buffer.from('%PDF-1.4\npreview')); fs.writeFileSync(path.join(root, 'foto.png'), Buffer.from([0x89,0x50,0x4e,0x47,1,2,3])); fs.writeFileSync(path.join(root, 'dados.csv'), 'a,b\n1,2', 'utf8')
    const pdf = service.preview({ rootId:'documents', relativePath:'contrato.pdf' }); const image=service.preview({rootId:'documents',relativePath:'foto.png'}); const unsupported=service.preview({rootId:'documents',relativePath:'dados.csv'})
    expect(pdf).toMatchObject({name:'contrato.pdf',relativePath:'contrato.pdf',extension:'.pdf',previewKind:'pdf',mimeType:'application/pdf'}); expect(pdf.dataUrl).toMatch(/^data:application\/pdf;base64,/)
    expect(image).toMatchObject({name:'foto.png',previewKind:'image',mimeType:'image/png'}); expect(image.dataUrl).toMatch(/^data:image\/png;base64,/); expect(unsupported).toMatchObject({name:'dados.csv',previewKind:'unsupported',dataUrl:null}); expect(pdf).not.toHaveProperty('absolutePath')
  })
  it('não carrega conteúdo de preview acima do limite configurado', () => {
    const { root, service }=setup({maxPreviewBytes:8}); fs.writeFileSync(path.join(root,'grande.pdf'),Buffer.from('%PDF-1.4-mais-que-oito')); expect(service.preview({rootId:'documents',relativePath:'grande.pdf'})).toMatchObject({previewKind:'unsupported',dataUrl:null,previewBlockedReason:'size'})
  })
  it('cria, renomeia e move pastas e arquivos sem sobrescrever destinos existentes', () => {
    const {root,service}=setup(); const createdFolder=service.createFolder({rootId:'documents',parentRelativePath:'',name:'Contratos'}); expect(createdFolder.relativePath).toBe('Contratos'); fs.writeFileSync(path.join(root,'Contratos','modelo.pdf'),'modelo','utf8')
    const renamed=service.rename({rootId:'documents',relativePath:'Contratos/modelo.pdf',newName:'contrato.pdf'}); expect(renamed.relativePath).toBe('Contratos/contrato.pdf'); fs.mkdirSync(path.join(root,'Arquivo')); const moved=service.move({rootId:'documents',relativePath:renamed.relativePath,destinationRelativePath:'Arquivo'}); expect(moved.relativePath).toBe('Arquivo/contrato.pdf'); expect(fs.readFileSync(path.join(root,'Arquivo','contrato.pdf'),'utf8')).toBe('modelo')
    fs.writeFileSync(path.join(root,'Arquivo','duplicado.pdf'),'x','utf8'); fs.writeFileSync(path.join(root,'duplicado.pdf'),'y','utf8'); expect(()=>service.move({rootId:'documents',relativePath:'duplicado.pdf',destinationRelativePath:'Arquivo'})).toThrow(/já existe/i)
  })
  it('remove arquivo e exige confirmação recursiva explícita para pasta não vazia', () => {
    const {root,service}=setup(); fs.mkdirSync(path.join(root,'Temporário')); fs.writeFileSync(path.join(root,'Temporário','item.txt'),'x','utf8'); fs.writeFileSync(path.join(root,'solto.txt'),'x','utf8'); expect(service.remove({rootId:'documents',relativePath:'solto.txt'})).toBe(true); expect(fs.existsSync(path.join(root,'solto.txt'))).toBe(false); expect(()=>service.remove({rootId:'documents',relativePath:'Temporário'})).toThrow('não está vazia'); expect(service.remove({rootId:'documents',relativePath:'Temporário',recursive:true})).toBe(true)
  })
  it('restaura o item físico quando a atualização de registros falha', () => {
    const onPathRemoved=vi.fn(()=>{throw new Error('Falha SQLite simulada')}); const {root,service}=setup({onPathRemoved}); const file=path.join(root,'contrato.pdf'); fs.writeFileSync(file,'conteúdo preservado','utf8'); expect(()=>service.remove({rootId:'documents',relativePath:'contrato.pdf'})).toThrow('Falha SQLite simulada'); expect(onPathRemoved).toHaveBeenCalledWith(file); expect(fs.readFileSync(file,'utf8')).toBe('conteúdo preservado'); expect(fs.existsSync(path.join(root,INTERNAL_TRASH_DIR))).toBe(false)
  })
  it('não expõe a área interna de staging no explorador', () => {
    const {root,service}=setup(); fs.mkdirSync(path.join(root,INTERNAL_TRASH_DIR)); fs.writeFileSync(path.join(root,INTERNAL_TRASH_DIR,'pendente.txt'),'x'); expect(service.list({rootId:'documents'}).items.some((item:any)=>item.name===INTERNAL_TRASH_DIR)).toBe(false); expect(()=>service.list({rootId:'documents',relativePath:INTERNAL_TRASH_DIR})).toThrow(/reservado/i)
  })
  it('importa arquivos externos para uma pasta autorizada sem sobrescrever e sem importar symlink', () => {
    const {root,service}=setup(); const outside=fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-import-source-')); created.push(outside); fs.mkdirSync(path.join(root,'Importados')); const source=path.join(outside,'nota.pdf'); fs.writeFileSync(source,'nota','utf8'); const result=service.importFiles({rootId:'documents',destinationRelativePath:'Importados',sourcePaths:[source]}); expect(result).toEqual([{name:'nota.pdf',relativePath:'Importados/nota.pdf'}]); expect(()=>service.importFiles({rootId:'documents',destinationRelativePath:'Importados',sourcePaths:[source]})).toThrow(/já existe/i); const link=path.join(outside,'atalho.pdf'); fs.symlinkSync(source,link); expect(()=>service.importFiles({rootId:'documents',destinationRelativePath:'Importados',sourcePaths:[link]})).toThrow(/atalhos simbólicos/i)
  })
  it('bloqueia nomes inválidos, raiz e symlink em operações mutáveis', () => {
    const {root,service}=setup(); fs.writeFileSync(path.join(root,'arquivo.txt'),'x','utf8'); const outside=fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-explorer-link-outside-')); created.push(outside); const outsideFile=path.join(outside,'fora.txt'); fs.writeFileSync(outsideFile,'fora','utf8'); fs.symlinkSync(outsideFile,path.join(root,'link.txt')); expect(()=>service.createFolder({rootId:'documents',parentRelativePath:'',name:'../escape'})).toThrow('Nome inválido'); expect(()=>service.createFolder({rootId:'documents',parentRelativePath:'',name:INTERNAL_TRASH_DIR})).toThrow('Nome inválido'); expect(()=>service.rename({rootId:'documents',relativePath:'arquivo.txt',newName:'A/B.txt'})).toThrow('Nome inválido'); expect(()=>service.remove({rootId:'documents',relativePath:''})).toThrow('pasta raiz'); expect(()=>service.rename({rootId:'documents',relativePath:'link.txt',newName:'novo.txt'})).toThrow(/Atalhos simbólicos|fora da área gerenciada/i)
  })
})
