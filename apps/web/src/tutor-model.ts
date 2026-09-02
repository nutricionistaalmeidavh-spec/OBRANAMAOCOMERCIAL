export type TutorUnit={id:string;competency:string;level:string;title:string};
export type TutorParticipant={completedUnits?:string[];skillLevels?:Record<string,string>;unitProgress?:Record<string,{status?:string;updatedAt?:string}>;preparedLesson?:{unit:string}|null};
export function nextTutorUnit(participant:TutorParticipant,units:TutorUnit[]):TutorUnit|undefined{
 const completed=new Set(participant.completedUnits||[]);
 if(participant.preparedLesson){const prepared=units.find(unit=>unit.id===participant.preparedLesson?.unit);if(prepared)return prepared}
 const inProgress=units.find(unit=>participant.unitProgress?.[unit.id]?.status==='practice');
 if(inProgress)return inProgress;
 return units.find(unit=>!completed.has(unit.id)&&unit.level===(participant.skillLevels?.[unit.competency]||'N1'))||units.find(unit=>!completed.has(unit.id));
}
export function tutorAttemptStatus(status:string,responseCount:number):string{return status==='completed'?'Concluída':responseCount>0||status==='in_progress'?'Em andamento':'Preparada'}
export function canTutorReroll(status:string,responseCount:number):boolean{return status!=='completed'&&responseCount===0}
