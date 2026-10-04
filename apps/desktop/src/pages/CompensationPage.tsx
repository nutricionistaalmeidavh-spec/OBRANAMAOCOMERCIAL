import { Edit3, HardHat, Plus, Trash2, WalletCards } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Button, Card, Confirm, Field, FormActions, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brl, toCents } from '../utils/format'

function moneyInput(value:number|undefined){
  return ((Number(value)||0)/100).toFixed(2).replace('.',',')
}

export default function CompensationPage(){
  const catalog=useAsync(()=>window.fluxoDre.catalogo.list(),[])
  const [cargo,setCargo]=useState<any>(null)
  const [benefit,setBenefit]=useState<any>(null)
  const [remove,setRemove]=useState<any>(null)
  const [message,setMessage]=useState('')
  const [saving,setSaving]=useState(false)

  const editCargo=(item:any={nome:'',cbo:'',salario:''})=>{
    const links=(catalog.data?.beneficios||[]).map((b:any)=>{
      const link=catalog.data?.links.find((x:any)=>x.cargo_id===item.id&&x.beneficio_id===b.id)
      return {
        id:link?.id,
        revision:link?.revision,
        beneficio_id:b.id,
        nome:b.nome,
        enabled:!!link?.ativo,
        valor:link?moneyInput(link.valor_centavos):moneyInput(b.valor_padrao_centavos),
        quinzena:link?.quinzena||1,
        natureza:link?.natureza||'credito',
      }
    })
    setCargo({...item,salario:item.id?moneyInput(item.salario_base_centavos):'',links})
  }

  const saveCargo=async(event:FormEvent)=>{
    event.preventDefault()
    if(saving)return
    setSaving(true);setMessage('')
    try{
      await window.fluxoDre.catalogo.saveCompensationPolicy({
        cargo:{...cargo,salario_base_centavos:toCents(cargo.salario)},
        links:(cargo.links||[]).map((link:any)=>({
          id:link.id,
          revision:link.revision,
          beneficio_id:link.beneficio_id,
          valor_centavos:toCents(link.valor),
          quinzena:link.quinzena,
          natureza:link.natureza,
          ativo:link.enabled?1:0,
        })),
      })
      setCargo(null)
      await catalog.reload()
      setMessage('Cargo, salário-base e benefícios salvos em uma única operação.')
    }catch(error:any){setMessage(error?.message||String(error))}
    finally{setSaving(false)}
  }

  const saveBenefit=async(event:FormEvent)=>{
    event.preventDefault()
    if(saving)return
    setSaving(true);setMessage('')
    try{
      await window.fluxoDre.catalogo.saveBenefit({...benefit,valor_padrao_centavos:toCents(benefit.valor)})
      setBenefit(null)
      await catalog.reload()
      setMessage('Tipo de benefício salvo.')
    }catch(error:any){setMessage(error?.message||String(error))}
    finally{setSaving(false)}
  }

  const benefitUsage=(benefitId:number)=>{
    const links=(catalog.data?.links||[]).filter((link:any)=>link.beneficio_id===benefitId&&link.ativo)
    if(!links.length)return{label:'Sem vínculo ativo',detail:'Defina o valor ao vincular o benefício a um cargo.'}
    const values=[...new Set(links.map((link:any)=>Number(link.valor_centavos)||0))].sort((a,b)=>a-b)
    if(values.length===1)return{label:`${links.length} cargo${links.length===1?'':'s'} · ${brl(values[0])}`,detail:'Valor efetivo usado pela folha para esses cargos.'}
    return{label:`${links.length} cargos · ${brl(values[0])} a ${brl(values[values.length-1])}`,detail:'O valor efetivo varia conforme o cargo.'}
  }

  return <>
    <PageHeader title="Cargos e remuneração" description="Defina funções, salário-base e benefícios. A Folha e pagamentos consome estes valores; ela não é o cadastro mestre."/>

    <Card className="compensation-owner-note">
      <strong>Owner canônico do RH</strong>
      <p>O catálogo de benefícios define o tipo. O valor efetivo é definido no vínculo com cada cargo e pode ter exceção individual no cadastro do funcionário.</p>
    </Card>

    <section className="compensation-section">
      <div className="section-heading"><div><HardHat size={20}/><div><h2>Cargos e valores efetivos</h2><p>Salário-base e benefícios usados automaticamente na folha.</p></div></div><Button icon={<Plus size={16}/>} onClick={()=>editCargo()}>Novo cargo</Button></div>
      <Card>{catalog.loading?<Loading/>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Cargo</th><th>CBO</th><th className="number">Salário-base</th><th>Benefícios vinculados</th><th>Status</th><th></th></tr></thead><tbody>{catalog.data?.cargos.map((item:any)=>{const links=catalog.data.links.filter((x:any)=>x.cargo_id===item.id&&x.ativo);return <tr key={item.id}><td><strong>{item.nome}</strong></td><td>{item.cbo||'—'}</td><td className="number">{brl(item.salario_base_centavos)}</td><td>{links.length?links.map((link:any)=>{const b=catalog.data.beneficios.find((x:any)=>x.id===link.beneficio_id);return <span className="benefit-chip" key={link.id}>{b?.nome}: {brl(link.valor_centavos)}</span>}):<span className="muted-text">Sem benefícios</span>}</td><td><Status value={item.ativo?'ativo':'inativo'}/></td><td><div className="row-actions"><button className="icon-button" aria-label={`Editar cargo ${item.nome}`} onClick={()=>editCargo(item)}><Edit3 size={15}/></button>{item.ativo===1&&<button className="icon-button danger-icon" aria-label={`Inativar cargo ${item.nome}`} onClick={()=>setRemove({type:'cargo',...item})}><Trash2 size={15}/></button>}</div></td></tr>})}</tbody></table></div>}</Card>
    </section>

    <section className="compensation-section">
      <div className="section-heading"><div><WalletCards size={20}/><div><h2>Catálogo de benefícios</h2><p>O catálogo identifica o benefício; os valores atuais pertencem aos cargos.</p></div></div><Button variant="secondary" icon={<Plus size={16}/>} onClick={()=>setBenefit({nome:'',tipo:'alimentacao',valor:''})}>Novo benefício</Button></div>
      <Card>{catalog.loading?<Loading/>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Benefício</th><th>Tipo</th><th>Valores efetivos por cargo</th><th>Status</th><th></th></tr></thead><tbody>{catalog.data?.beneficios.map((item:any)=>{const usage=benefitUsage(item.id);return <tr key={item.id}><td><strong>{item.nome}</strong></td><td>{item.tipo}</td><td><strong>{usage.label}</strong><small className="compensation-cell-note">{usage.detail}</small></td><td><Status value={item.ativo?'ativo':'inativo'}/></td><td><div className="row-actions"><button className="icon-button" aria-label={`Editar benefício ${item.nome}`} onClick={()=>setBenefit({...item,valor:moneyInput(item.valor_padrao_centavos)})}><Edit3 size={15}/></button>{item.ativo===1&&<button className="icon-button danger-icon" aria-label={`Inativar benefício ${item.nome}`} onClick={()=>setRemove({type:'beneficio',...item})}><Trash2 size={15}/></button>}</div></td></tr>})}</tbody></table></div>}</Card>
    </section>

    {message&&<div className="success-box" role="status" style={{marginTop:14}}>{message}</div>}

    <Modal open={!!cargo} title={cargo?.id?'Editar cargo':'Novo cargo'} onClose={()=>!saving&&setCargo(null)} size="lg"><form onSubmit={saveCargo} noValidate><div className="modal-body"><div className="form-grid form-grid-3"><Field label="Nome" required><input required value={cargo?.nome||''} onChange={e=>setCargo({...cargo,nome:e.target.value})}/></Field><Field label="CBO"><input value={cargo?.cbo||''} onChange={e=>setCargo({...cargo,cbo:e.target.value})}/></Field><Field label="Salário-base" required><input required value={cargo?.salario||''} onChange={e=>setCargo({...cargo,salario:e.target.value})} placeholder="0,00"/></Field></div><h3 className="section-title" style={{marginTop:22}}>Benefícios fixos da função</h3><p className="muted-text">Estes são os valores efetivos que a folha usará para funcionários deste cargo, salvo exceção individual.</p><div className="benefit-config-list">{cargo?.links?.map((link:any,index:number)=><div className={`benefit-config ${link.enabled?'enabled':''}`} key={link.beneficio_id}><label className="benefit-toggle"><input type="checkbox" checked={link.enabled} onChange={e=>{const links=[...cargo.links];links[index]={...link,enabled:e.target.checked};setCargo({...cargo,links})}}/><strong>{link.nome}</strong></label><input aria-label={`Valor de ${link.nome}`} disabled={!link.enabled} value={link.valor} onChange={e=>{const links=[...cargo.links];links[index]={...link,valor:e.target.value};setCargo({...cargo,links})}} placeholder="0,00"/><select aria-label={`Quinzena de ${link.nome}`} disabled={!link.enabled} value={link.quinzena} onChange={e=>{const links=[...cargo.links];links[index]={...link,quinzena:Number(e.target.value)};setCargo({...cargo,links})}}><option value="1">1ª quinzena</option><option value="2">2ª quinzena</option></select></div>)}</div></div><FormActions onCancel={()=>setCargo(null)} submitLabel="Salvar cargo e remuneração" loading={saving}/></form></Modal>

    <Modal open={!!benefit} title={benefit?.id?'Editar benefício':'Novo benefício'} onClose={()=>!saving&&setBenefit(null)}><form onSubmit={saveBenefit} noValidate><div className="modal-body form-grid"><Field label="Nome" required wide><input required value={benefit?.nome||''} onChange={e=>setBenefit({...benefit,nome:e.target.value})}/></Field><Field label="Tipo"><select value={benefit?.tipo||'alimentacao'} onChange={e=>setBenefit({...benefit,tipo:e.target.value})}><option value="alimentacao">Alimentação</option><option value="transporte">Transporte</option><option value="premio">Prêmio</option><option value="outro">Outro</option></select></Field><Field label="Valor padrão para novos cargos"><input value={benefit?.valor||''} onChange={e=>setBenefit({...benefit,valor:e.target.value})} placeholder="0,00"/></Field><p className="muted-text" style={{gridColumn:'1/-1',margin:0}}>Opcional. Este valor apenas preenche novos vínculos; alterar aqui não muda silenciosamente os valores já definidos nos cargos.</p></div><FormActions onCancel={()=>setBenefit(null)} loading={saving}/></form></Modal>

    <Confirm open={!!remove} title={`Inativar ${remove?.type==='cargo'?'cargo':'benefício'}`} description="O cadastro deixará de aparecer nas novas seleções. Históricos existentes serão preservados." danger onCancel={()=>setRemove(null)} onConfirm={async()=>{await window.fluxoDre.catalogo.deactivate(remove.type,remove.id);setRemove(null);await catalog.reload()}}/>
  </>
}
