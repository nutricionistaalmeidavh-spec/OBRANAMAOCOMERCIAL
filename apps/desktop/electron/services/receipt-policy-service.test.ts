import { createRequire } from 'node:module'
import { describe,it,expect,vi } from 'vitest'
const require=createRequire(import.meta.url)
const {ReceiptPolicyService,filterBenefitsByPolicy,receiptDocumentSelection}=require('./receipt-policy-service.cjs')
const benefits=[{id:2,beneficio_id:2,descricao:'Vale-alimentação',nome:'Vale-alimentação',ativo:1,empresa_id:1},{id:3,beneficio_id:3,descricao:'Café',nome:'Café',ativo:1,empresa_id:1},{id:1,beneficio_id:1,descricao:'Vale-transporte',nome:'Vale-transporte',ativo:1,empresa_id:1}]
describe('seleção canônica de documentos e recibos',()=>{
 it('persiste escolhas da empresa para qualquer competência e respeita a seleção vazia',async()=>{
  let company={id:1,razao_social:'Empresa',revision:4,politica_recibos:''}
  const dataAccess={list:vi.fn(async(t:string)=>t==='empresas'?[company]:benefits),get:vi.fn(async()=>company),save:vi.fn(async(_t:string,row:any)=>{company={...row,revision:5};return company})}
  const service=new ReceiptPolicyService({dataAccess})
  await service.save({companyId:1,revision:4,benefitIds:[2,3],point:true,receipts:true})
  const reopened=new ReceiptPolicyService({dataAccess})
  expect((await reopened.get())[0].benefitIds).toEqual([2,3])
  expect(filterBenefitsByPolicy(benefits,company.politica_recibos).map((x:any)=>x.id)).toEqual([2,3])
  expect(dataAccess.save).toHaveBeenCalledWith('empresas',expect.objectContaining({revision:4}))
  await reopened.save({companyId:1,benefitIds:[],point:true,receipts:false})
  expect(filterBenefitsByPolicy(benefits,company.politica_recibos)).toEqual([])
  expect(receiptDocumentSelection({},company.politica_recibos)).toEqual({point:true,receipts:false})
 })
 it('identifica benefícios por ID mesmo após mudar o nome e mantém política legada',()=>{
  expect(filterBenefitsByPolicy([{...benefits[0],descricao:'Nome novo'}],'{"version":1,"benefitIds":[2]}')).toHaveLength(1)
  expect(filterBenefitsByPolicy(benefits,'Café, Vale-alimentação')).toHaveLength(2)
  expect(filterBenefitsByPolicy(benefits,'')).toHaveLength(3)
 })
 it('não grava benefícios de outra empresa e não converte preferências corrompidas em imprimir tudo',async()=>{
  const dataAccess={get:async()=>({id:9}),list:async()=>benefits,save:vi.fn()}
  await expect(new ReceiptPolicyService({dataAccess}).save({companyId:9,benefitIds:[2],point:true,receipts:true})).rejects.toThrow('inválido')
  expect(dataAccess.save).not.toHaveBeenCalled()
  expect(()=>filterBenefitsByPolicy(benefits,'{inválido')).toThrow('inválida')
 })
})
