import { describe, expect, it } from 'vitest'
import { COMMERCIAL_PLANS, featuresForPlan } from '../backend/commercial-plan-catalog'

describe('commercial billing plans',()=>{
  it('keeps the approved monthly and yearly prices',()=>{
    expect(COMMERCIAL_PLANS.map(p=>[p.code,p.priceCents])).toEqual([
      ['essencial_monthly',14900],['essencial_yearly',149000],
      ['pro_monthly',29900],['pro_yearly',299000],
      ['empresa_monthly',49900],['empresa_yearly',499000]
    ])
  })

  it('includes desktop and mobile on every plan',()=>{
    for(const plan of COMMERCIAL_PLANS)expect(plan.channels).toEqual(['desktop','mobile'])
  })

  it('keeps Essencial focused on core field operations',()=>{
    const plan=COMMERCIAL_PLANS.find(p=>p.code==='essencial_monthly')!
    expect(plan.modules).toEqual(['obra360','rdo','documents','universidade'])
    expect(plan.limits).toEqual({users:5,projects:3,devices:2})
  })

  it('gives Pro all product modules',()=>{
    const plan=COMMERCIAL_PLANS.find(p=>p.code==='pro_monthly')!
    expect(plan.modules).toEqual(['finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai'])
    expect(plan.limits).toEqual({users:20,projects:10,devices:5})
  })

  it('keeps Empresa feature-complete with larger limits',()=>{
    const plan=COMMERCIAL_PLANS.find(p=>p.code==='empresa_monthly')!
    expect(plan.modules).toEqual(COMMERCIAL_PLANS.find(p=>p.code==='pro_monthly')!.modules)
    expect(plan.limits).toEqual({users:60,projects:30,devices:15})
  })

  it('exposes stable customer-facing feature labels',()=>{
    expect(featuresForPlan('essencial_monthly')).toContain('RDO e operação de campo')
    expect(featuresForPlan('pro_monthly')).toContain('Financeiro, DRE e medições')
    expect(featuresForPlan('empresa_monthly')).toContain('IA do ArtiSys')
  })
})
