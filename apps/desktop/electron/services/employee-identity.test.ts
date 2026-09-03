import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const { employeeIdentityIssues, formatCpf, formatCnpj, resolveImportedEmployee }=require('./employee-identity.cjs')

describe('identidade canônica de funcionário',()=>{
  it('formata CPF e CNPJ sem mudar a identidade',()=>{
    expect(formatCpf('12345678901')).toBe('123.456.789-01')
    expect(formatCnpj('50733669000160')).toBe('50.733.669/0001-60')
  })

  it('exige nome completo e documentos antes de gerar documentos oficiais',()=>{
    expect(employeeIdentityIssues({nome:'Maicon',cpf:''},{razao_social:'MH HIDRAULICA RP LTDA',cnpj:'50.733.669/0001-60'})).toEqual(['nome completo','CPF'])
    expect(employeeIdentityIssues({nome:'Maicon da Silva',cpf:'123.456.789-01'},{razao_social:'MH HIDRAULICA RP LTDA',cnpj:'50.733.669/0001-60'})).toEqual([])
  })

  it('nunca decide entre dois Maicons usando apenas o primeiro nome',()=>{
    const employees=[
      {id:1,nome:'Maicon da Silva Santos',cpf:'111.111.111-11',cargo_id:1},
      {id:2,nome:'Maicon Pereira Souza',cpf:'222.222.222-22',cargo_id:2}
    ]
    const resolution=resolveImportedEmployee(employees,'Maicon')
    expect(resolution.kind).toBe('ambiguous')
    expect(resolution.candidates.map((item:any)=>item.id)).toEqual([1,2])
  })

  it('usa o nome completo exato para escolher a pessoa correta',()=>{
    const employees=[
      {id:1,nome:'Maicon da Silva Santos',cpf:'111.111.111-11'},
      {id:2,nome:'Maicon Pereira Souza',cpf:'222.222.222-22'}
    ]
    const resolution=resolveImportedEmployee(employees,'Maicon Pereira Souza')
    expect(resolution.kind).toBe('match')
    expect(resolution.employee.id).toBe(2)
    expect(resolution.employee.cpf).toBe('222.222.222-22')
  })

  it('aceita primeiro nome apenas quando existe um único candidato e preserva o cadastro mestre',()=>{
    const employees=[{id:7,nome:'Wesley Oliveira Costa',cpf:'333.333.333-33'}]
    const resolution=resolveImportedEmployee(employees,'Wesley')
    expect(resolution.kind).toBe('match')
    expect(resolution.reason).toBe('unique-first-name')
    expect(resolution.employee.nome).toBe('Wesley Oliveira Costa')
  })
})
