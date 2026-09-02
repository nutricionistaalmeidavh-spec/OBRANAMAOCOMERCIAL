export type PracticeLearningSignal = { source:'diagnostic'|'lesson'|'review'; unitId?:string; skillId?:string; score?:number; errors?:number; mistakes?:number };
export type DailyPracticeChallenge = { id:string; date:string; status:'planned'|'started'|'completed'; items:Array<{activityId:string;skillId:string;gameType:string;difficulty:number;completed?:boolean;score?:number}>; createdAt:string; frozenAt:string };
let cached:any;
import d01 from './learning-games-data/data-01';
import d02 from './learning-games-data/data-02';
import d03 from './learning-games-data/data-03';
import d04 from './learning-games-data/data-04';
import d05 from './learning-games-data/data-05';
import d06 from './learning-games-data/data-06';
import d07 from './learning-games-data/data-07';
import d08 from './learning-games-data/data-08';
import d09 from './learning-games-data/data-09';
import d10 from './learning-games-data/data-10';
const DATA=d01+d02+d03+d04+d05+d06+d07+d08+d09+d10;
async function inflateGzipBase64(value:string){const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return await new Response(stream).text();}
function generatedMeasureSvg(kind:string){const label=kind==='length'?'3 m':kind==='mass'?'3 kg':'1 h';const icon=kind==='length'?'<path d="M36 80h148M48 66v28M172 66v28"/>':kind==='mass'?'<path d="M72 48h76l22 84H50z"/><path d="M94 48a16 16 0 0 1 32 0"/>':'<circle cx="110" cy="88" r="48"/><path d="M110 88V56M110 88l24 16"/>';const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 150"><rect width="220" height="150" rx="18" fill="#f8fafc"/><g fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">'+icon+'</g><text x="110" y="138" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#0f172a">'+label+'</text></svg>';return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}
export async function getLearningGamesRuntime(){if(cached)return cached;const source=await inflateGzipBase64(DATA);cached=(new Function(source))();const imageActivity=cached.ALL_LEARNING_GAME_ACTIVITIES?.find((a:any)=>a.id==='image-discovery-measures-n1');const qs=imageActivity?.content?.questions;if(Array.isArray(qs)){const kinds=['length','mass','time'];qs.forEach((q:any,i:number)=>q.imageSrc=generatedMeasureSvg(kinds[i]||'time'));}return cached;}