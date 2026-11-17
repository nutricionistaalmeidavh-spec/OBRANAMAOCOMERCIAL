import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require=createRequire(import.meta.url);
const { DatabaseService }=require('./database.cjs');
const { LocalSyncDataProvider, BRIDGE }=require('./sync-data-provider.cjs');

it('sincroniza subetapas canônicas e impede aplicação em outra obra',()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'obn-subfront-sync-'));
  const database=new DatabaseService({dataDir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')});
  database.open();
  try{
    const company=database.save('empresas',{razao_social:'Empresa A',status:'ativa'});
    const work=database.save('obras',{empresa_id:company.id,nome:'Obra A'});
    const other=database.save('obras',{empresa_id:company.id,nome:'Obra B'});
    const stage=database.save('frentes_obra',{obra_id:work.id,nome:'Hidráulica'});
    const sub=database.save('subfrentes_obra',{obra_id:work.id,frente_id:stage.id,nome:'Prumadas',status:'ativa'});
    const outside=database.save('subfrentes_obra',{obra_id:other.id,frente_id:stage.id,nome:'Outra'});
    const scope={companyId:company.id,workId:work.id};
    const source=new LocalSyncDataProvider({database});
    expect(BRIDGE.subfrentes_obra).toBe('subfronts');
    expect(source.listBridge('subfrentes_obra',scope).map((row:any)=>row.id)).toEqual([sub.id]);
    expect(source.applyRemote('subfrentes_obra',sub.id,{nome:'Prumadas revisadas',observacoes:'Conferido'},scope)).toBe(true);
    expect(database.get('subfrentes_obra',sub.id).nome).toBe('Prumadas revisadas');
    expect(source.applyRemote('subfrentes_obra',outside.id,{nome:'Não pode'},scope)).toBe(false);
    expect(database.get('subfrentes_obra',outside.id).nome).toBe('Outra');
  }finally{database.close();fs.rmSync(dataDir,{recursive:true,force:true})}
});
