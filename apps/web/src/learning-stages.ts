export const INTERNAL_LEVELS=['N1','N2','N3','N4','N5'] as const;
export type InternalLevel=(typeof INTERNAL_LEVELS)[number];
export const LEARNING_STAGES=[
{id:'learning1',order:1,label:'Aprendizado 1',subtitle:'Fundamentos',levels:['N1','N2'] as const,description:'Reconhecer fundamentos e compreender informações diretas.'},
{id:'learning2',order:2,label:'Aprendizado 2',subtitle:'Aplicação',levels:['N3','N4'] as const,description:'Aplicar o conteúdo em situações da rotina e comparar estratégias.'},
{id:'learning3',order:3,label:'Aprendizado 3',subtitle:'Autonomia',levels:['N5'] as const,description:'Resolver situações com mais autonomia e justificar decisões.'},
] as const;
export type LearningStage=(typeof LEARNING_STAGES)[number];
const asInternalLevel=(value?:string|null):InternalLevel|undefined=>INTERNAL_LEVELS.includes(String(value||'') as InternalLevel)?String(value) as InternalLevel:undefined;
export function learningStageForLevel(level?:string|null):LearningStage{const internal=asInternalLevel(level);return LEARNING_STAGES.find(stage=>internal&&(stage.levels as readonly string[]).includes(internal))||LEARNING_STAGES[0]}
export function completedLevelsForSkill(completedUnitIds:Iterable<string>,skill:string):InternalLevel[]{const done=new Set(completedUnitIds);return INTERNAL_LEVELS.filter(level=>done.has(skill+'-'+level))}
export function learningStageProgress(stage:LearningStage,completedLevels:Iterable<string>):number{const done=new Set(completedLevels),levels=stage.levels as readonly string[];return Math.round(levels.filter(level=>done.has(level)).length/levels.length*100)}
export function learningStageTargetLevel(stage:LearningStage,completedLevels:Iterable<string>,recommendedLevel?:string|null):InternalLevel{const done=new Set(completedLevels),levels=stage.levels as readonly InternalLevel[],recommended=asInternalLevel(recommendedLevel);if(recommended&&levels.includes(recommended)&&!done.has(recommended))return recommended;return levels.find(level=>!done.has(level))||levels[levels.length-1]}
