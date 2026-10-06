export function effectiveSalaryCents(employee:any,cargo:any){
  const individual=Number(employee?.salario_centavos||0)
  if(individual>0)return individual
  return Math.max(0,Number(cargo?.salario_base_centavos||0))
}

export function salarySourceLabel(employee:any,cargo:any){
  if(Number(employee?.salario_centavos||0)>0)return'Ajuste individual'
  if(Number(cargo?.salario_base_centavos||0)>0)return'Definido pelo cargo'
  return'Sem salário-base'
}
