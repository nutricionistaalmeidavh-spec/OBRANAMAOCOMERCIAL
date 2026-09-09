import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DatabaseService } from './database.cjs'
import { pathMappingsForRoot, syncRegisteredPaths } from './file-registry-paths.cjs'

const created: Array<{ dir: string; db: any }> = []
function setup() { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-registry-paths-')); const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')}); db.open(); created.push({dir,db}); return {dir,db} }
afterEach(()=>{ for(const item of created.splice(0)){ item.db.close(); fs.rmSync(item.dir,{recursive:true,force:true}) } })

describe('file registry path synchronization',()=>{
  it('renomeia caminho físico sem perder nome_original',()=>{
    const {dir,db}=setup(); const previous=path.join(dir,'docs','contrato-interno.pdf'); const next=path.join(dir,'docs','contrato-assinado.pdf')
    const file=db.save('arquivos',{nome_original:'Contrato enviado pelo cliente.pdf',nome_armazenado:path.basename(previous),caminho:previous,tamanho:10,extensao:'.pdf',mime_type:'application/pdf',origem:'importado'})
    syncRegisteredPaths(db,previous,next)
    const updated=db.get('arquivos',file.id); expect(updated.caminho).toBe(next); expect(updated.nome_armazenado).toBe('contrato-assinado.pdf'); expect(updated.nome_original).toBe('Contrato enviado pelo cliente.pdf')
  })
  it('planeja remapeamento de raiz preservando o caminho relativo',()=>{
    const {dir,db}=setup(); const previousRoot=path.join(dir,'origem'); const nextRoot=path.join(dir,'destino'); const previous=path.join(previousRoot,'Empresa','Funcionários','Pessoa','arquivo.pdf')
    db.save('arquivos',{nome_original:'original.pdf',nome_armazenado:'arquivo.pdf',caminho:previous,tamanho:10,extensao:'.pdf',mime_type:'application/pdf',origem:'importado'})
    const mappings=pathMappingsForRoot(db,previousRoot,nextRoot); expect(mappings).toHaveLength(1); expect(mappings[0].previousPath).toBe(previous); expect(mappings[0].nextPath).toBe(path.join(nextRoot,'Empresa','Funcionários','Pessoa','arquivo.pdf')); expect(mappings[0].nome_original).toBe('original.pdf')
  })
})
