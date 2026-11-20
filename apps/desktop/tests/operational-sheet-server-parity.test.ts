import {describe,it,expect,vi} from 'vitest'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {OperationalSheetService}=require('../electron/services/operational-sheet-service.cjs')
const {OperationalSheetP1Service}=require('../electron/services/operational-sheet-p1-service.cjs')
const {OperationalSheetP2Service}=require('../electron/services/operational-sheet-p2-service.cjs')
const {ProcurementSourceService}=require('../electron/services/procurement-source-service.cjs')

const moduleStorage={state:()=>({state:'central-active'})}
const poisonedDb={db:{transaction(){throw Error('PROIBIDO ESCREVER NO SQLITE LOCAL')}},save(){throw Error('PROIBIDO ESCREVER NO SQLITE LOCAL')}}
describe('paridade das planilhas no Desktop LAN',()=>{
 it('orçamento/financeiro envia lote com revision e não acessa banco local',async()=>{
  const sent:any[]=[]
  const svc=new OperationalSheetService({db:poisonedDb,moduleStorage,dialog:{},
   lanClient:{operationalSheetCommit:async(payload:any)=>{sent.push(payload);return {updated:1}}}})
  const result=await svc.commit({area:'orcamento',obraId:10,rows:[{id:5,revision:3,quantidade:'0,5',valor_unitario_centavos:1000}]})
  expect(result.updated).toBe(1)
  expect(sent[0].rows[0]).toMatchObject({id:5,revision:3,quantidade:.5})
  expect(sent[0].obraId).toBe(10)
 })
 it('cronograma, etapas e subetapas são enviados para uma transação central',async()=>{
  const sent:any[]=[]
  const svc=new OperationalSheetP1Service({db:poisonedDb,moduleStorage,
   lanClient:{operationalSheetCommit:async(payload:any)=>{sent.push(payload);return {updated:payload.rows.length}}}})
  expect((await svc.commit({area:'cronograma',obraId:2,rows:[{id:7,revision:1,nome:'Execução'}]})).updated).toBe(1)
  expect((await svc.commit({area:'etapas',obraId:2,rows:[{id:null,nome:'Hidráulica'}]})).updated).toBe(1)
  expect(sent.map(x=>x.area)).toEqual(['cronograma','etapas'])
 })
 it('ponto e medições consultam exclusivamente API remota',async()=>{
  const called:string[]=[]
  const svc=new OperationalSheetP1Service({db:poisonedDb,moduleStorage,lanClient:{
   operationalSheetTimeMatrix:async()=>{called.push('matrix');return {rows:[{id:1}] }},
   operationalSheetMeasurements:async()=>{called.push('measure');return {items:[{id:2}] }},
   operationalSheetTimeCommit:async()=>{called.push('commit');return {updated:1}}
  }})
  expect((await svc.timeMatrix({competencia:'2026-11'})).rows).toHaveLength(1)
  expect((await svc.measurementOverview({obraId:2,competencia:'2026-11'})).items).toHaveLength(1)
  expect((await svc.commitTime({competencia:'2026-11',rows:[{}]})).updated).toBe(1)
  expect(called).toEqual(['matrix','measure','commit'])
 })
 it('tarefas e recebimentos em lote respeitam servidor e idempotência',async()=>{
  const tasks=new OperationalSheetP2Service({db:poisonedDb,moduleStorage,lanClient:{
   operationalSheetCommit:async(input:any)=>({area:input.area,updated:1})}})
  expect((await tasks.commitTasks({obraId:10,rows:[{id:1,revision:1,status:'concluida'}]})).area).toBe('tarefas')
  const submitted:any[]=[]
  const procurement=new ProcurementSourceService({local:{receiveMany(){throw Error('SQLite não permitido')}},lanClient:{
   procurementReceiveMany:async(p:any)=>{submitted.push(p);return {received:1}}},moduleStorage,notes:{},randomUUID:()=> 'batch-uuid'})
  const data={data:'2026-11-20',items:[{pedido_item_id:8,quantidade_recebida:2}]}
  expect((await procurement.receiveMany(data)).received).toBe(1)
  expect(submitted[0].requestId).toBe('batch-uuid')
 })
 it('servidor antigo ou sem endpoint falha explicitamente, sem fallback',()=>{
  const svc=new OperationalSheetService({db:poisonedDb,moduleStorage,dialog:{}})
  expect(()=>svc.commit({area:'orcamento',obraId:1,rows:[{id:1,revision:1,quantidade:1,valor_unitario_centavos:1}]})).toThrow(/atualize|servidor/i)
 })
})
