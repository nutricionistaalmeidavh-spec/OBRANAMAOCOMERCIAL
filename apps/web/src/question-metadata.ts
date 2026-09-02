export type QuestionPart='part1'|'part2';
export type QuestionUse='practice'|'review'|'reinforcement';
export type QuestionMetadata={
 id:string;
 competency:string;
 internalLevel:'N1'|'N2'|'N3'|'N4'|'N5';
 learningStage:'learning1'|'learning2'|'learning3';
 learningLabel:'Aprendizado 1'|'Aprendizado 2'|'Aprendizado 3';
 preferredPart:QuestionPart;
 responseMode:'objective'|'open';
 difficulty:1|2|3|4|5;
 topic:string;
 visual:'mapped-candidate'|'none';
 diagnostic:boolean;
 uses:QuestionUse[];
};

type QuestionLike={kind:'choice'|'short-text'|'text';prompt:string;topic?:string;meta?:QuestionMetadata};
const VISUAL_SKILLS=new Set(['leitura','compreensao','escrita','adicao','multiplicacao','divisao','porcentagem','medidas']);
const hash=(value:string)=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
const parsed=(unitId:string)=>{const match=unitId.match(/^(.*)-(N[1-5])$/),competency=match?.[1]||unitId,internalLevel=(match?.[2]||'N1') as QuestionMetadata['internalLevel'],difficulty=Number(internalLevel.slice(1)) as QuestionMetadata['difficulty'],learningStage=difficulty<=2?'learning1':difficulty<=4?'learning2':'learning3',learningLabel=difficulty<=2?'Aprendizado 1':difficulty<=4?'Aprendizado 2':'Aprendizado 3';return{competency,internalLevel,difficulty,learningStage,learningLabel} as const};

export function questionMetadata(unitId:string,item:QuestionLike,ordinal=0):QuestionMetadata{
 const p=parsed(unitId);
 return{
  id:'q_'+hash(unitId+'|'+item.prompt),
  competency:p.competency,
  internalLevel:p.internalLevel,
  learningStage:p.learningStage,
  learningLabel:p.learningLabel,
  preferredPart:ordinal%3===0?'part1':'part2',
  responseMode:item.kind==='text'?'open':'objective',
  difficulty:p.difficulty,
  topic:String(item.topic||p.competency),
  visual:VISUAL_SKILLS.has(p.competency)?'mapped-candidate':'none',
  diagnostic:false,
  uses:['practice','review','reinforcement']
 };
}

export function withQuestionMetadata<T extends QuestionLike>(unitId:string,item:T,ordinal=0):T&{meta:QuestionMetadata}{
 return{...item,meta:questionMetadata(unitId,item,ordinal)};
}

export function questionCoverage(items:QuestionLike[]){
 const unique=new Map<string,QuestionMetadata>();
 items.forEach((item,index)=>{const meta=item.meta||questionMetadata('unknown-N1',item,index);unique.set(meta.id,meta)});
 const metas=[...unique.values()];
 return{
  unique:metas.length,
  part1:metas.filter(meta=>meta.preferredPart==='part1').length,
  part2:metas.filter(meta=>meta.preferredPart==='part2').length,
  review:metas.filter(meta=>meta.uses.includes('review')).length,
  reinforcement:metas.filter(meta=>meta.uses.includes('reinforcement')).length
 };
}
