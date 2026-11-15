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
};
type Links={
  days:number;timezone:string;views:number;clicks:number;
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
function fields(obj:Record<string,unknown>|undefined,keys:string[],prefix:string,issues:string[]) {
  if(!obj) {issues.push(prefix+': ausente');return;}
  for(const key of keys)if(!count(obj[key]))issues.push(prefix+'.'+key+': contagem inválida');
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
