import {CONTENT,selectQuestions,type EduItem} from './curriculum';
import {withQuestionMetadata} from './question-metadata';
import {hasQuestionVisual} from './question-visual-index';
export type LessonComposition={seed:number;levelNumber:number;closesStage:boolean;mainQuestions:EduItem[];reviewQuestions:EduItem[];reinforcementQuestions:EduItem[];questionIds:string[];reinforcementQuestionIds:string[]};
export function questionsByIds(composition:LessonComposition,ids:string[]):EduItem[]{const map=new Map([...composition.mainQuestions,...composition.reviewQuestions,...composition.reinforcementQuestions].map(item=>[item.meta?.id||'',item]));return ids.map(id=>map.get(id)).filter((item):item is EduItem=>!!item)}
const norm=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
const qid=(item:EduItem)=>item.meta?.id||'';
export function buildLessonComposition(id:string,seed:number,selectionVersion=1):LessonComposition{
 const base=CONTENT[id];if(!base)throw new Error('Unidade sem conteúdo.');
 const match=id.match(/^(.*)-N([1-5])$/);if(!match)throw new Error('Unidade inválida.');
 const skill=match[1],levelNumber=Number(match[2]),closesStage=[2,4,5].includes(levelNumber),preferVisual=selectionVersion>=2;
 const attach=(unitId:string,items:EduItem[])=>items.map((item,index)=>withQuestionMetadata(unitId,item,index));
 const prioritizeVisual=(items:EduItem[])=>preferVisual?[...items].sort((a,b)=>Number(hasQuestionVisual(b.prompt))-Number(hasQuestionVisual(a.prompt))):items;
 const mainQuestions=prioritizeVisual(attach(id,selectQuestions(id,base.items,seed,9))),used=new Set(mainQuestions.map(item=>norm(item.prompt))),reviewQuestions:EduItem[]=[];
 if(closesStage){const previousLevel=levelNumber===2?'N1':levelNumber===4?'N3':'N4',previousId=skill+'-'+previousLevel,previousBase=CONTENT[previousId]?.items||[],candidates=[...prioritizeVisual(attach(previousId,selectQuestions(previousId,previousBase,seed+41,12))),...prioritizeVisual(attach(id,selectQuestions(id,base.items,seed+79,20)))];for(const item of candidates){const key=norm(item.prompt);if(used.has(key))continue;reviewQuestions.push(item);used.add(key);if(reviewQuestions.length===4)break}}
 const core=[...mainQuestions,...reviewQuestions],reinforcementCandidates=prioritizeVisual(attach(id,selectQuestions(id,base.items,seed+211,20))),reinforcementQuestions:EduItem[]=[];
 for(const item of reinforcementCandidates){const key=norm(item.prompt);if(item.kind==='text'||used.has(key))continue;reinforcementQuestions.push(item);used.add(key);if(reinforcementQuestions.length===3)break}
 const questionIds=core.map(qid),reinforcementQuestionIds=reinforcementQuestions.map(qid),expected=closesStage?13:9;
 if(core.length!==expected||reinforcementQuestions.length!==3||questionIds.some(id=>!id)||reinforcementQuestionIds.some(id=>!id))throw new Error('Não foi possível congelar a composição desta aula.');
 return{seed:seed>>>0,levelNumber,closesStage,mainQuestions,reviewQuestions,reinforcementQuestions,questionIds,reinforcementQuestionIds};
}

