import { describe, expect, it } from 'vitest'
import { isWorkAreaAvailable } from '../src/utils/workAvailability'

describe('WorkDetail capability gates',()=>{
  it('keeps every area available in local mode',()=>{
    expect(isWorkAreaAvailable(false,{},'operation')).toBe(true)
    expect(isWorkAreaAvailable(false,{},'documents')).toBe(true)
  })

  it('in partial server mode enables only canonical-active areas',()=>{
    const availability={operation:true,planning:true,finance:true,medicoes:true,contratos:true,compras:true,documents:false}
    expect(isWorkAreaAvailable(true,availability,'operation')).toBe(true)
    expect(isWorkAreaAvailable(true,availability,'planning')).toBe(true)
    expect(isWorkAreaAvailable(true,availability,'medicoes')).toBe(true)
    expect(isWorkAreaAvailable(true,availability,'contratos')).toBe(true)
    expect(isWorkAreaAvailable(true,availability,'compras')).toBe(true)
    expect(isWorkAreaAvailable(true,availability,'documentos')).toBe(false)
  })

  it('fails closed for an unknown/missing server capability',()=>{
    expect(isWorkAreaAvailable(true,undefined,'operation')).toBe(false)
    expect(isWorkAreaAvailable(true,{operation:false},'operation')).toBe(false)
  })
})
