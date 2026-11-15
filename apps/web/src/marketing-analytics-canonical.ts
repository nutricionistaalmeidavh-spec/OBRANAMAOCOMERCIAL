/** Canonical consistency checks for three independent marketing data collections.
 * Home and product counters share the marketing collection but are never summed.
 * Links are sourced from the existing links endpoint, never copied into a new store.
 */
type Counts={views:number;productClicks:number;checkoutClicks:number;contactClicks:number;galleryClicks:number};
type Home={views:number;clicks:number;destinations:Array<{id:string;label:string;clicks:number}>};
type Marketing={
  days:number;timezone:string;summary:Counts;catalog:Counts;
  products:Array<{slug:string;name:string}&Counts>;
  daily:Array<{date:string}&Counts>;home:Home;homeDaily:Array<{date:string;views:number;clicks:number}>;
  whatsapp:{total:number;byButton:Array<{page:string;cta:string;clicks:number}>};
  whatsappDaily:Array<{date:string;clicks:number}>;
  diagnostic:{total:number;stages:Array<{step:string;count:number}>};
  diagnosticDaily:Array<{date:string;events:number}>;
};
type Links={
  days:number;timezone:string;views:number;clicks:number;interactionRate:number;
  links:Array<{id:string;label:string;clicks:number}>;
  daily:Array<{date:string;views:number;clicks:number}>;
};
const count=(value:unknown)=>typeof value==='number'&&Number.isInteger(value)&&value>=0;
const sum=(values:unknown[],key:string):number=>
  values.reduce<number>((total,row)=>{
    if(!row||typeof row!=='object')return total;
    const value=(row as Record<string,unknown>)[key];
    return total+(count(value)?value as number:0);
  },0);
function fields(obj:unknown,keys:string[],prefix:string,issues:string[]) {
  if(!obj || typeof obj!=='object'){issues.push(prefix+': ausente');return;}
  const data=obj as Record<string,unknown>;
  for(const key of keys)if(!count(data[key]))issues.push(prefix+'.'+key+': contagem inválida');
}
export function validateConsolidatedSources(marketing:Marketing,links:Links):{valid:boolean;issues:string[]} {
  const issues:string[]=[];
  const sameDay=(array:Array<{date:string}>,days:number,label:string)=>
    Array.isArray(array)&&array.length===days&&
    array.every((row,i)=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&(!i||row.date>array[i-1].date));
  if(!marketing||!links)return {valid:false,issues:['Fonte indisponível']};
  if(![7,30,90].includes(marketing.days)||marketing.days!==links.days)issues.push('Períodos divergentes');
  if(marketing.timezone!=='America/Sao_Paulo'||links.timezone!=='America/Sao_Paulo')issues.push('Fusos divergentes');
  if(!Array.isArray(marketing.products)||!Array.isArray(marketing.daily)||!Array.isArray(marketing.homeDaily)||
     !Array.isArray(links.links)||!Array.isArray(links.daily)||!Array.isArray(marketing.home?.destinations))
     return {valid:false,issues:[...issues,'Listas obrigatórias ausentes']};
  for(const [array,days,label] of [
    [marketing.daily,marketing.days,'Páginas comerciais'],
    [marketing.homeDaily,marketing.days,'Página inicial'],
    [links.daily,links.days,'Links']
  ] as const)if(!sameDay(array as Array<{date:string}>,days,label))issues.push(label+': série diária inválida');
  const keys=['views','productClicks','checkoutClicks','contactClicks','galleryClicks'];
  fields(marketing.summary,keys,'summary',issues);
  fields(marketing.catalog,keys,'catalog',issues);
  for(const row of marketing.products)fields(row,keys,'produto '+row.slug,issues);
  for(const row of marketing.daily)fields(row,keys,'dia comercial '+row.date,issues);
  for(const row of marketing.homeDaily)fields(row,['views','clicks'],'dia home '+row.date,issues);
  for(const row of links.daily)fields(row,['views','clicks'],'dia links '+row.date,issues);
  for(const row of marketing.home.destinations)fields(row,['clicks'],'destino home '+row.id,issues);
  for(const row of links.links)fields(row,['clicks'],'destino links '+row.id,issues);
  const rate=links.views ? Math.round(links.clicks / links.views * 1000)/10 : 0;
  if(!count(links.interactionRate) && !(typeof links.interactionRate==='number'&&links.interactionRate>=0))
    issues.push('Links: taxa inválida');
  else if(links.interactionRate!==rate)issues.push('Links: cliques por abertura divergentes');
  fields(marketing.home,['views','clicks'],'home',issues);
  fields(links,['views','clicks'],'links',issues);
  for(const key of keys){
    const total=marketing.catalog[key as keyof Counts]+sum(marketing.products,key);
    if(marketing.summary[key as keyof Counts]!==total)issues.push(key+': soma catálogo/produtos divergente');
    if(marketing.summary[key as keyof Counts]!==sum(marketing.daily,key))issues.push(key+': série comercial divergente');
  }
  if(marketing.home.views!==sum(marketing.homeDaily,'views'))issues.push('Home: aberturas divergentes');
  if(marketing.home.clicks!==sum(marketing.homeDaily,'clicks')||
      marketing.home.clicks!==sum(marketing.home.destinations,'clicks'))issues.push('Home: cliques divergentes');
  if(!Array.isArray(marketing.whatsapp?.byButton)||!Array.isArray(marketing.whatsappDaily)||
     !Array.isArray(marketing.diagnostic?.stages)||!Array.isArray(marketing.diagnosticDaily))
    issues.push('WhatsApp ou funil: campos obrigatórios ausentes');
  else {
    fields(marketing.whatsapp,['total'],'WhatsApp',issues);
    fields(marketing.diagnostic,['total'],'Diagnóstico',issues);
    for(const row of marketing.whatsapp.byButton)fields(row,['clicks'],'CTA WhatsApp '+row.cta,issues);
    for(const row of marketing.whatsappDaily)fields(row,['clicks'],'WhatsApp diário',issues);
    for(const row of marketing.diagnostic.stages)fields(row,['count'],'Etapa diagnóstico '+row.step,issues);
    for(const row of marketing.diagnosticDaily)fields(row,['events'],'Diagnóstico diário',issues);
    if(marketing.whatsapp.total!==sum(marketing.whatsapp.byButton,'clicks')||
       marketing.whatsapp.total!==sum(marketing.whatsappDaily,'clicks'))
      issues.push('WhatsApp: totais por botão e dia divergentes');
    if(marketing.diagnostic.total!==sum(marketing.diagnostic.stages,'count')||
       marketing.diagnostic.total!==sum(marketing.diagnosticDaily,'events'))
      issues.push('Diagnóstico: totais por etapa e dia divergentes');
    if(!sameDay(marketing.whatsappDaily,marketing.days,'WhatsApp')||
       !sameDay(marketing.diagnosticDaily,marketing.days,'Diagnóstico'))
      issues.push('WhatsApp ou diagnóstico: série diária inválida');
    for(let i=0;i<marketing.days;i++){
      if(marketing.whatsappDaily[i]?.date!==marketing.daily[i]?.date||
         marketing.diagnosticDaily[i]?.date!==marketing.daily[i]?.date){
        issues.push('WhatsApp/diagnóstico: datas fora da janela canônica');break;
      }
    }
  }
  if(links.views!==sum(links.daily,'views'))issues.push('Links: aberturas divergentes');
  if(links.clicks!==sum(links.daily,'clicks')||links.clicks!==sum(links.links,'clicks'))issues.push('Links: cliques divergentes');
  for(let i=0;i<marketing.days;i++){
    const day=marketing.daily[i]?.date;
    if(marketing.homeDaily[i]?.date!==day||links.daily[i]?.date!==day){
      issues.push('Datas não alinhadas nas fontes');break;
    }
  }
  return {valid:issues.length===0,issues};
}
