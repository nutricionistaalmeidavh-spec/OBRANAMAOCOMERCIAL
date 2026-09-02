import { db, error, json } from '@appdeploy/sdk';
import { isEducationUnitId, isPracticeSkillId } from './game-progress-model';
import { listPracticeRuns, savePracticeRun } from './education-practice-store';

type DailyPracticeChallengeItem = { activityId:string; skillId:string; gameType:string; difficulty:number; completed?:boolean; score?:number };
type DailyPracticeChallenge = { id:string; date:string; status:'planned'|'started'|'completed'; items:DailyPracticeChallengeItem[]; createdAt:string; frozenAt:string };
const ACTIVITY_ROWS = [["crossword-leitura-N1","reading.alphabet","crossword",1],["crossword-compreensao-N2","comprehension.fact-opinion-consequence","crossword",2],["crossword-medidas-N2","math.measurements","crossword",2],["crossword-porcentagem-N1","math.percentage","crossword",1],["domino-adicao-n2","math.addition","domino-math",2],["domino-multiplicacao-n2","math.multiplication","domino-math",2],["domino-divisao-n2","math.division","domino-math",2],["domino-porcentagem-n2","math.percentage","domino-math",2],["domino-porcentagem-n3","math.percentage","domino-math",3],["domino-porcentagem-n5","math.percentage","domino-math",5],["domino-medidas-n2","math.measurements","domino-math",2],["word-search-reading-n1","reading.alphabet","word-search",1],["matching-comprehension-n2","comprehension.fact-opinion-consequence","matching",2],["ordering-reading-n3","reading.messages","ordering",3],["memory-percent-n1","math.percentage","memory",1],["fill-blank-reading-n2","reading.instructions","fill-blank",2],["true-false-comprehension-n2","comprehension.fact-opinion-consequence","true-false",2],["quick-quiz-percent-n2","math.percentage","quick-quiz",2],["classification-comprehension-n2","comprehension.fact-opinion-consequence","classification",2],["decision-comprehension-n5","comprehension.critical-reading","decision",5],["simulation-comprehension-n3","comprehension.instructions-responsibility","simulation",3],["calculation-adicao-n3","math.addition","calculation",3],["budget-percent-n3","math.percentage","budget",3],["stock-flow-adicao-n2","math.addition","cash-classification",2],["word-map-comprehension-n3","comprehension.instructions-responsibility","word-map",3],["sentence-puzzle-reading-n3","reading.messages","sentence-puzzle",3],["dictation-reading-n1","reading.alphabet","dictation",1],["image-discovery-measures-n1","math.measurements","image-discovery",1],["daily-problem-measures-n2","math.measurements","daily-problem",2],["mission-multiplication-n3","math.multiplication","mission",3]] as const;
const ACTIVITY_CONTRACT = new Map<string,{skillId:string;gameType:string;difficulty:number}>(ACTIVITY_ROWS.map(row => [row[0], {skillId:row[1],gameType:row[2],difficulty:row[3]}]));
function normalizeDailyPracticeChallenge(input:unknown):DailyPracticeChallenge|null{if(!input||typeof input!=='object'||Array.isArray(input))return null;const value=input as Record<string,unknown>,id=String(value.id||'').trim().slice(0,180),date=String(value.date||'').trim(),createdAt=String(value.createdAt||'').trim(),frozenAt=String(value.frozenAt||createdAt).trim();if(!id||!/^(\d{4})-(\d{2})-(\d{2})$/.test(date)||!Number.isFinite(Date.parse(createdAt))||!Number.isFinite(Date.parse(frozenAt))||!Array.isArray(value.items)||value.items.length<1||value.items.length>5)return null;const items:DailyPracticeChallengeItem[]=[];for(const raw of value.items){if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const item=raw as Record<string,unknown>,activityId=String(item.activityId||'').trim().slice(0,120),skillId=String(item.skillId||'').trim(),gameType=String(item.gameType||'').trim(),difficulty=Number(item.difficulty);if(!activityId||!isPracticeSkillId(skillId)||!Number.isInteger(difficulty)||difficulty<1||difficulty>5||!gameType)return null;items.push({activityId,skillId,gameType,difficulty,completed:!!item.completed,score:item.score==null?undefined:Math.max(0,Math.min(100,Math.round(Number(item.score))))});}const completed=items.filter(item=>item.completed).length;return{id,date,status:completed===items.length?'completed':completed?'started':'planned',items,createdAt,frozenAt};}

type EduSession = { participantId: string; expiresAt: string; createdAt: string };
type Participant = { status?: string; mustChangePassword?: boolean };
type StoredChallenge = DailyPracticeChallenge & { id?: string };

const now = () => new Date().toISOString();
const rec = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const keyHash = (v: string) => { let h = 2166136261; for (let i = 0; i < v.length; i++) { h ^= v.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
const sessionTable = (token: string) => 'edu_session_' + keyHash(token);
const challengeTable = (participantId: string) => 'edu_practice_challenges_' + participantId.replace(/[^a-zA-Z0-9_-]/g, '_');

function challengeMatchesCatalog(challenge: DailyPracticeChallenge) {
  return challenge.items.every(item => {
    const expected = ACTIVITY_CONTRACT.get(item.activityId);
    return !!expected && expected.skillId === item.skillId && expected.gameType === item.gameType && expected.difficulty === item.difficulty;
  });
}

async function participant(token: string) {
  if (token.length < 40) return null;
  const session = (await db.list<EduSession>(sessionTable(token), { limit: 1 })).items[0];
  if (!session || session.expiresAt < now()) return null;
  const [record] = await db.get<Participant>('edu_participants', [session.participantId]);
  return record?.status === 'active' ? { ...record, id: session.participantId } : null;
}

async function requireParticipant(body: Record<string, unknown>) {
  const actor = await participant(String(body.token || ''));
  if (!actor) return { response: error('Sessão expirada.', 401) } as const;
  if (actor.mustChangePassword) return { response: error('Altere a senha provisória para continuar.', 403) } as const;
  return { actor } as const;
}

export const EDUCATION_PRACTICE_ROUTES = {
  'POST /api/edu/practice/run': [async (ctx: { body?: unknown }) => {
    const body = rec(ctx.body), gate = await requireParticipant(body);
    if ('response' in gate) return gate.response;
    const record = await savePracticeRun(gate.actor.id, body.record);
    if (!record) return error('Resultado de prática inválido.', 400);
    return json({ ok: true, record });
  }],
  'POST /api/edu/practice/runs': [async (ctx: { body?: unknown }) => {
    const body = rec(ctx.body), gate = await requireParticipant(body);
    if ('response' in gate) return gate.response;
    const unitId = String(body.unitId || '').trim();
    const skillId = String(body.skillId || '').trim();
    if (unitId && !isEducationUnitId(unitId)) return error('Unidade inválida.', 400);
    if (skillId && !isPracticeSkillId(skillId)) return error('Habilidade inválida.', 400);
    const records = await listPracticeRuns(gate.actor.id, { unitId: unitId || undefined, skillId: skillId || undefined, limit: Number(body.limit || 200) });
    return json({ records, source: 'practice-v2' });
  }],
  'POST /api/edu/practice/challenge/read': [async (ctx: { body?: unknown }) => {
    const body = rec(ctx.body), gate = await requireParticipant(body);
    if ('response' in gate) return gate.response;
    const date = String(body.date || '').trim();
    if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(date)) return error('Data inválida.', 400);
    const items = (await db.list<StoredChallenge>(challengeTable(gate.actor.id), { limit: 40 })).items;
    const challenge = items.map(item => normalizeDailyPracticeChallenge(item)).find(item => item?.date === date) || null;
    return json({ challenge });
  }],
  'POST /api/edu/practice/challenge/save': [async (ctx: { body?: unknown }) => {
    const body = rec(ctx.body), gate = await requireParticipant(body);
    if ('response' in gate) return gate.response;
    const challenge = normalizeDailyPracticeChallenge(body.challenge);
    if (!challenge) return error('Desafio inválido.', 400);
    const table = challengeTable(gate.actor.id);
    const current = (await db.list<StoredChallenge>(table, { limit: 40 })).items;
    const sameDate = current.find(item => item.date === challenge.date);
    if (sameDate?.id) {
      const frozen = normalizeDailyPracticeChallenge(sameDate);
      if (!frozen) return error('Desafio salvo está inválido.', 409);
      const sameStructure = frozen.items.map(item => item.activityId).join('|') === challenge.items.map(item => item.activityId).join('|');
      if (!sameStructure) return json({ challenge: frozen, frozen: true });
      if (!challengeMatchesCatalog(challenge)) return error('Desafio inválido.', 400);
      await db.update(table, [{ id: sameDate.id, record: challenge }]);
      return json({ challenge, frozen: true });
    }
    if (!challengeMatchesCatalog(challenge)) return error('Desafio inválido.', 400);
    await db.add(table, [challenge]);
    return json({ challenge, frozen: true }, 201);
  }],
};
