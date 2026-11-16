import {describe,expect,it} from 'vitest'
import {materialLine, rdoSourceFingerprint, reconcileRdoStatus, materialReviewSummary} from '../public/field-rdo-utils.js'

describe('RDO field materials and closure',()=>{
 it('normalizes quantities and rejects invalid materials before any write',()=>{
  expect(materialLine({id:'m1',descricao:' Tubo PVC ',unidade:' m ',quantidade:'12,5'})).toMatchObject({id:'m1',descricao:'Tubo PVC',unidade:'m',quantidade:12.5})
  expect(()=>materialLine({descricao:'Tubo',quantidade:0})).toThrow(/quantidade/i)
  expect(()=>materialLine({descricao:'',quantidade:1})).toThrow(/material/i)
 })
 it('material review must explicitly acknowledge zero consumption',()=>{
  expect(materialReviewSummary({materials:[],materialsReviewed:false}).ready).toBe(false)
  expect(materialReviewSummary({materials:[],materialsReviewed:true}).ready).toBe(true)
  expect(materialReviewSummary({materials:[{id:'tubo',descricao:'Tubo',quantidade:3,unidade:'m'}],materialsReviewed:true}).count).toBe(1)
 })
 it('reopens an already submitted day if material quantity or production changes',()=>{
  const day={attendance:{a:'present'},sessions:[{id:'s1',state:'finished'}],materials:[{id:'tubo',quantidade:4}],materialsReviewed:true}
  const closed={...day,rdoStatus:'ready_for_desktop',rdoClosedFingerprint:rdoSourceFingerprint(day)}
  expect(reconcileRdoStatus(closed).rdoStatus).toBe('ready_for_desktop')
  closed.materials=[{id:'tubo',quantidade:2}]
  expect(reconcileRdoStatus(closed).rdoStatus).toBe('draft')
 })
})
