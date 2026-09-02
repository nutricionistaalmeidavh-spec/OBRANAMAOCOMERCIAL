export type InternalLevel='N1'|'N2'|'N3'|'N4'|'N5';
export type LevelingCheckpoint={block:string;graded:number;firstTryCorrect:number;accuracy:number|null;reinforced?:boolean};
export type ContinuousLevelResult={level:InternalLevel;confidence:number;evidenceScore:number;action:'advance'|'reinforce'|'hold';score:number};

const LEVELS:InternalLevel[]=['N1','N2','N3','N4','N5'];
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const indexOf=(level:string)=>Math.max(0,LEVELS.indexOf(level as InternalLevel));

export function evidenceFromCheckpoints(checkpoints:LevelingCheckpoint[]):{score:number;graded:number}{
 const usable=checkpoints.filter(item=>item.block!=='reinforcement'&&item.graded>0&&item.accuracy!==null);
 if(!usable.length)return{score:50,graded:0};
 const graded=usable.reduce((sum,item)=>sum+item.graded,0);
 const weighted=usable.reduce((sum,item)=>sum+Number(item.accuracy||0)*item.graded,0);
 return{score:Math.round(weighted/graded),graded};
}

export function updateContinuousLevel(input:{currentLevel?:string;unitLevel:string;previousConfidence?:number;previousScore?:number;checkpoints:LevelingCheckpoint[];consolidated:boolean;reinforcementCompleted?:boolean}):ContinuousLevelResult{
 const current=(LEVELS.includes(input.currentLevel as InternalLevel)?input.currentLevel:'N1') as InternalLevel,unit=(LEVELS.includes(input.unitLevel as InternalLevel)?input.unitLevel:current) as InternalLevel;
 const evidence=evidenceFromCheckpoints(input.checkpoints),currentIndex=indexOf(current),unitIndex=indexOf(unit);
 let nextIndex=currentIndex,action:ContinuousLevelResult['action']='hold';
 if(evidence.graded>=3&&input.consolidated&&evidence.score>=80&&unitIndex>=currentIndex){nextIndex=Math.min(4,currentIndex+1);if(nextIndex>currentIndex)action='advance'}
 else if(evidence.graded>=3&&!input.consolidated&&evidence.score<45&&currentIndex>0){nextIndex=currentIndex-1;action='reinforce'}
 const level=LEVELS[nextIndex],levelChanged=level!==current;
 const baseConfidence=clamp(Number(input.previousConfidence??0.55),0.35,0.95),gain=Math.min(0.16,evidence.graded*0.012)+(input.consolidated?0.03:0.01);
 const confidence=Number((levelChanged?0.62:clamp(baseConfidence+gain,0.35,0.95)).toFixed(2));
 const oldScore=clamp(Number(input.previousScore??((currentIndex)*25)),0,100),score=Math.round(oldScore*0.55+evidence.score*0.45);
 return{level,confidence,evidenceScore:evidence.score,action,score};
}

export function learnerLevelingMessage(result:ContinuousLevelResult):string{
 if(result.action==='advance')return'Seu próximo conteúdo foi ajustado automaticamente com base no seu desempenho.';
 if(result.action==='reinforce')return'O sistema vai reforçar fundamentos antes de avançar, sem alterar seu Aprendizado visível.';
 return'Seu ponto de partida continua sendo refinado pelas atividades.';
}
