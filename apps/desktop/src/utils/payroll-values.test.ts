import { describe, expect, it } from 'vitest'
import { effectiveSalaryCents, salarySourceLabel } from './payroll-values'

describe('salário efetivo canônico do funcionário',()=>{
  it('usa salário individual quando informado',()=>{
    const employee={salario_centavos:320000,cargo_id:1}
    const cargo={id:1,salario_base_centavos:300000}
    expect(effectiveSalaryCents(employee,cargo)).toBe(320000)
    expect(salarySourceLabel(employee,cargo)).toBe('Ajuste individual')
  })

  it('herda salário-base do cargo quando o individual é zero',()=>{
    const employee={salario_centavos:0,cargo_id:1}
    const cargo={id:1,salario_base_centavos:300000}
    expect(effectiveSalaryCents(employee,cargo)).toBe(300000)
    expect(salarySourceLabel(employee,cargo)).toBe('Definido pelo cargo')
  })
})
