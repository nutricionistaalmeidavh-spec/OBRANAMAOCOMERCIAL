import { describe, expect, it } from 'vitest'
import { restrictForemanSnapshot } from './field-snapshot-rules'

const canonical = () => ({
  _remote:{revision:7},
  project:{name:'Obra A'},
  settings:{start:'07:30'},
  employees:[{id:'emp-1',name:'Ana',cpf:'123',frontKey:'afaq:0',attendance:'unmarked'}],
  desktopBridge:{rdos:[{localId:10,sourceDeviceId:'desktop-1'}]},
  days:{'2026-11-15':{date:'2026-11-15',attendance:{'emp-1':'present'},presentCount:1,
    sessions:[],plans:[],rdoStatus:'draft',materials:[]}},
  floors:[],issues:[],history:[]
})

describe('Foreman field-only snapshot',()=>{
 it('allows operational RDO and materials without replacing administrative data',()=>{
   const original=canonical(),submitted=structuredClone(original)
   submitted.days['2026-11-15'].materials=[{id:'tube',descricao:'Tubo PVC',unidade:'m',quantidade:4}]
   submitted.days['2026-11-15'].rdoStatus='ready_for_desktop'
   const out=restrictForemanSnapshot(submitted,original)
   expect(out.days['2026-11-15'].materials).toHaveLength(1)
   expect(out.settings).toEqual(original.settings)
   expect(out.desktopBridge).toEqual(original.desktopBridge)
 })
 it('rejects forged attendance and employee data changes',()=>{
   const original=canonical(),submitted=structuredClone(original)
   submitted.days['2026-11-15'].attendance['emp-1']='absent'
   expect(()=>restrictForemanSnapshot(submitted,original)).toThrow(/presença|presenca|autorizad/i)
   submitted.days['2026-11-15'].attendance['emp-1']='present'
   submitted.employees[0].cpf='999'
   expect(()=>restrictForemanSnapshot(submitted,original)).toThrow(/colaborador|autorizad/i)
 })
 it('cannot forge attendance or compensation balances through the full snapshot',()=>{
   const original=canonical(), submitted=structuredClone(original)
   submitted.employees[0].attendance='absent'
   expect(()=>restrictForemanSnapshot(submitted,original)).toThrow(/colaborador|autorizad/i)
   submitted.employees[0].attendance='unmarked'
   submitted.employees[0].compensationDays=99
   expect(()=>restrictForemanSnapshot(submitted,original)).toThrow(/colaborador|autorizad/i)
 })
 it('cannot alter project, settings, or desktop bridge',()=>{
   const original=canonical(),submitted=structuredClone(original)
   submitted.project.name='Outra obra'
   expect(()=>restrictForemanSnapshot(submitted,original)).toThrow(/administra|permiss/i)
 })
})
