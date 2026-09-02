export type FirstTryResult=boolean|null|undefined;
export type LessonCheckpoint={
 block:'part1'|'part2'|'review'|'reinforcement';
 attempted:number;
 graded:number;
 firstTryCorrect:number;
 firstTryErrors:number;
 accuracy:number|null;
 reinforced:boolean;
};

type QuestionLike={kind:'choice'|'short-text'|'text';prompt:string};
const norm=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');

export function checkpointEvidence(block:LessonCheckpoint['block'],results:FirstTryResult[],reinforced=false):LessonCheckpoint{
 const attempted=results.filter(value=>value!==undefined).length;
 const gradedResults=results.filter((value):value is boolean=>typeof value==='boolean');
 const graded=gradedResults.length,firstTryCorrect=gradedResults.filter(Boolean).length,firstTryErrors=graded-firstTryCorrect;
 return{block,attempted,graded,firstTryCorrect,firstTryErrors,accuracy:graded?Math.round(firstTryCorrect/graded*100):null,reinforced};
}

export function shouldReinforce(checkpoint:LessonCheckpoint):boolean{
 return checkpoint.block==='part1'&&checkpoint.graded>=2&&checkpoint.firstTryCorrect/checkpoint.graded<2/3;
}

export function selectReinforcementQuestions<T extends QuestionLike>(core:T[],candidates:T[],count=3):T[]{
 const used=new Set(core.map(item=>norm(item.prompt))),selected:T[]=[];
 for(const item of candidates){const key=norm(item.prompt);if(item.kind==='text'||used.has(key))continue;selected.push(item);used.add(key);if(selected.length===count)break}
 return selected;
}

export function checkpointLabel(checkpoint:LessonCheckpoint):{title:string;body:string}{
 if(checkpoint.accuracy===null)return{title:'Etapa registrada',body:'Sua produção será considerada junto com as demais evidências da aula.'};
 if(checkpoint.accuracy>=80)return{title:'Boa base para continuar',body:'Você aplicou bem este bloco. Siga para a próxima etapa.'};
 if(checkpoint.accuracy>=60)return{title:'Conteúdo em construção',body:'Você já avançou. A próxima etapa vai ajudar a fixar o conteúdo.'};
 return{title:'Vamos manter este ponto em prática',body:'Esse conteúdo precisa de mais contato. O sistema registrou a dificuldade para orientar reforços e revisões.'};
}
