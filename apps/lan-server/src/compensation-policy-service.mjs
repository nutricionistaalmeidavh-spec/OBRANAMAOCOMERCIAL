import { ConcurrencyService } from './concurrency-service.mjs'

export class CompensationPolicyService {
  constructor({ repository }) {
    const db=repository?.connection?.()
    if(!repository||!db?.exec||!db?.prepare)throw new Error('Repositório LAN inválido para remuneração.')
    this.repository=repository
    this.db=db
    this.concurrency=new ConcurrencyService({db})
  }

  decorate(table,row,revision){
    return row?{...row,revision:revision||this.concurrency.current(table,row.id)||this.concurrency.initialize(table,row.id)}:null
  }

  save(payload={}){
    const cargoInput=payload.cargo&&typeof payload.cargo==='object'?payload.cargo:{}
    const links=Array.isArray(payload.links)?payload.links:[]
    const nome=String(cargoInput.nome||'').trim()
    if(!nome)throw new Error('Informe o nome do cargo.')

    this.db.exec('BEGIN IMMEDIATE')
    try{
      let cargo
      if(cargoInput.id){
        const id=Number(cargoInput.id)
        const current=this.repository.get('cargos',id)
        if(!current)throw new Error('Cargo não encontrado no RH central.')
        const observed=this.concurrency.current('cargos',id)||this.concurrency.initialize('cargos',id)
        this.concurrency.assertExpected('cargos',id,cargoInput.revision,{...current,revision:observed})
        const saved=this.repository.save('cargos',{...cargoInput,id,nome})
        cargo=this.decorate('cargos',saved,this.concurrency.bump('cargos',id))
      }else{
        const saved=this.repository.save('cargos',{...cargoInput,nome})
        cargo=this.decorate('cargos',saved,this.concurrency.initialize('cargos',saved.id))
      }

      const empresaId=Number(cargo.empresa_id)
      const savedLinks=[]
      for(const input of links){
        const beneficioId=Number(input.beneficio_id)
        if(!Number.isSafeInteger(beneficioId)||beneficioId<=0)throw new Error('Benefício inválido na política de remuneração.')
        let existing=input.id?this.repository.get('cargo_beneficios',Number(input.id)):null
        if(!existing)existing=this.repository.list('cargo_beneficios',{empresa_id:empresaId,cargo_id:cargo.id,beneficio_id:beneficioId})[0]||null
        const data={
          empresa_id:empresaId,
          cargo_id:cargo.id,
          beneficio_id:beneficioId,
          valor_centavos:Math.max(0,Number(input.valor_centavos)||0),
          quinzena:Number(input.quinzena)===2?2:1,
          natureza:input.natureza==='desconto'?'desconto':'credito',
          ativo:input.ativo===0?0:1,
        }
        if(existing){
          const id=Number(existing.id)
          const observed=this.concurrency.current('cargo_beneficios',id)||this.concurrency.initialize('cargo_beneficios',id)
          this.concurrency.assertExpected('cargo_beneficios',id,input.revision,{...existing,revision:observed})
          const saved=this.repository.save('cargo_beneficios',{...data,id})
          savedLinks.push(this.decorate('cargo_beneficios',saved,this.concurrency.bump('cargo_beneficios',id)))
        }else{
          const saved=this.repository.save('cargo_beneficios',data)
          savedLinks.push(this.decorate('cargo_beneficios',saved,this.concurrency.initialize('cargo_beneficios',saved.id)))
        }
      }
      this.db.exec('COMMIT')
      return{cargo,links:savedLinks}
    }catch(error){
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}
