export type AttemptStatus='prepared'|'in_progress'|'completed';
export type AttemptMode='lesson'|'review';
export type AttemptSource='learner'|'tutor-paper';
export type AttemptResponse={questionId:string;response:string;correct:boolean|null;source:AttemptSource;attempts:number;errors:number;firstTryCorrect:boolean|null;recordedAt:string;updatedAt:string};
export type LessonAttempt={
 id:string;participantId:string;unit:string;competency:string;internalLevel:string;learningStage:'learning1'|'learning2'|'learning3';seed:number;selectionVersion?:number;
 questionIds:string[];reinforcementQuestionIds:string[];answeredQuestionIds:string[];responseCount:number;responses?:AttemptResponse[];mode?:AttemptMode;
 status:AttemptStatus;preparedBy:'learner'|'tutor';rerollCount:number;createdAt:string;updatedAt:string;completedAt?:string;
};
const stageFor=(level:string):LessonAttempt['learningStage']=>['N1','N2'].includes(level)?'learning1':['N3','N4'].includes(level)?'learning2':'learning3';
export const expectedCoreQuestions=(unit:string,mode:AttemptMode='lesson')=>mode==='review'?4:['N2','N4','N5'].some(level=>unit.endsWith('-'+level))?13:9;
const cleanIds=(ids:unknown,max:number)=>Array.isArray(ids)?Array.from(new Set(ids.map(String).filter(id=>/^q_[a-z0-9]+$/i.test(id)))).slice(0,max):[];
export const activeAttempt=(attempts:LessonAttempt[]|undefined,unit?:string)=>[...(attempts||[])].reverse().find(item=>item.status!=='completed'&&(!unit||item.unit===unit))||null;
export function createLessonAttempt(input:{id:string;participantId:string;unit:string;seed:number;createdAt:string;preparedBy:'learner'|'tutor';mode?:AttemptMode;selectionVersion?:number}):LessonAttempt{const level=input.unit.match(/N[1-5]$/)?.[0]||'N1';return{id:input.id,participantId:input.participantId,unit:input.unit,competency:input.unit.replace(/-N[1-5]$/,''),internalLevel:level,learningStage:stageFor(level),seed:input.seed>>>0,selectionVersion:Math.max(1,Math.floor(input.selectionVersion||2)),questionIds:[],reinforcementQuestionIds:[],answeredQuestionIds:[],responseCount:0,responses:[],mode:input.mode||'lesson',status:'prepared',preparedBy:input.preparedBy,rerollCount:0,createdAt:input.createdAt,updatedAt:input.createdAt}}
export function freezeLessonAttempt(attempt:LessonAttempt,questionIds:unknown,reinforcementIds:unknown,updatedAt:string):LessonAttempt{const core=cleanIds(questionIds,13),reinforcement=cleanIds(reinforcementIds,3),expected=expectedCoreQuestions(attempt.unit,attempt.mode||'lesson');if(core.length!==expected||((attempt.mode||'lesson')==='review'?reinforcement.length!==0:reinforcement.length!==3))throw new Error('Composição da aula inválida.');if(attempt.responseCount>0||attempt.answeredQuestionIds.length)throw new Error('A aula já recebeu respostas e não pode trocar questões.');if(attempt.questionIds.length){const same=attempt.questionIds.join('|')===core.join('|')&&attempt.reinforcementQuestionIds.join('|')===reinforcement.join('|');if(!same)throw new Error('A aula já foi congelada com outra composição.');return attempt}return{...attempt,questionIds:core,reinforcementQuestionIds:reinforcement,updatedAt}}
export function recordAttemptResponse(attempt:LessonAttempt,input:{questionId:string;response:string;correct:boolean|null;source:AttemptSource;updatedAt:string}):LessonAttempt{
 if(attempt.status==='completed')throw new Error('A aula já foi concluída.');
 const allowed=new Set([...attempt.questionIds,...attempt.reinforcementQuestionIds]);if(!allowed.has(input.questionId))throw new Error('Questão fora da aula preparada.');
 const responses=[...(attempt.responses||[])],index=responses.findIndex(item=>item.questionId===input.questionId),legacyAnswered=attempt.answeredQuestionIds.includes(input.questionId)&&index<0;
 if(input.source==='tutor-paper'&&(legacyAnswered||index>=0))throw new Error('Esta questão já possui resposta e não pode ser sobrescrita pelo Tutor.');
 if(index>=0&&responses[index].source==='tutor-paper'&&input.source==='learner')throw new Error('Esta questão já foi registrada pelo Tutor a partir do papel.');
 const answer=String(input.response||'').slice(0,2000),correct=typeof input.correct==='boolean'?input.correct:null;
 if(index>=0){const old=responses[index],attempts=old.attempts+1,errors=old.errors+(correct===false?1:0);responses[index]={...old,response:answer,correct,attempts,errors,updatedAt:input.updatedAt}}
 else responses.push({questionId:input.questionId,response:answer,correct,source:input.source,attempts:1,errors:correct===false?1:0,firstTryCorrect:correct,recordedAt:input.updatedAt,updatedAt:input.updatedAt});
 const answered=Array.from(new Set([...attempt.answeredQuestionIds,input.questionId]));
 return{...attempt,responses,answeredQuestionIds:answered,responseCount:answered.length,status:'in_progress',updatedAt:input.updatedAt}
}
export function markAttemptResponse(attempt:LessonAttempt,questionId:string,updatedAt:string):LessonAttempt{return recordAttemptResponse(attempt,{questionId,response:'',correct:null,source:'learner',updatedAt})}
export function rerollLessonAttempt(attempt:LessonAttempt,newSeed:number,updatedAt:string):LessonAttempt{if(attempt.responseCount>0||attempt.answeredQuestionIds.length)throw new Error('Não é possível sortear outra aula depois da primeira resposta.');if(attempt.status==='completed')throw new Error('A aula já foi concluída.');return{...attempt,seed:newSeed>>>0,questionIds:[],reinforcementQuestionIds:[],rerollCount:attempt.rerollCount+1,updatedAt}}
export function completeLessonAttempt(attempt:LessonAttempt,updatedAt:string):LessonAttempt{if(!attempt.questionIds.length)throw new Error('A aula ainda não possui composição congelada.');return{...attempt,status:'completed',completedAt:updatedAt,updatedAt}}
export function replaceAttempt(list:LessonAttempt[]|undefined,next:LessonAttempt,limit=40):LessonAttempt[]{const items=(list||[]).filter(item=>item.id!==next.id);return[...items,next].slice(-limit)}
