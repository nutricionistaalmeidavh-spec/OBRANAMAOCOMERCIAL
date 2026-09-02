import { db, error, json, requireAuth, withScopes } from '@appdeploy/sdk';
import { evaluateObjectiveConsolidation } from './unit-policy';
import { buildAdminOverview, canAccessAdminOverview } from './admin-overview';
import { canClearDiagnosticDraftAfterFinalization, createDiagnosticDraft, sanitizeDiagnosticDraft } from './diagnostic-draft';
import { clearDiagnosticDraft, readDiagnosticDraft, saveDiagnosticDraft, type DiagnosticDraftStore, type StoredDiagnosticDraftRecord } from './diagnostic-draft-store';
import { canManageEducationRoles, educationJobRole, educationRoleChangeDecision, effectiveEducationRole, isAdministrationRole, isEducationRole, type EduRole } from './access-control';
import { hasActivePendingReview, normalizeOpenResponses } from './open-response-policy';
import { updateContinuousLevel } from './continuous-leveling';
import { activeAttempt, completeLessonAttempt, createLessonAttempt, freezeLessonAttempt, recordAttemptResponse, replaceAttempt, rerollLessonAttempt, type LessonAttempt } from './lesson-attempt';
import { buildSpacedReviewPlan } from './spaced-review';
type LearningCheckpoint = {
    block: 'part1' | 'part2' | 'review' | 'reinforcement';
    attempted: number;
    graded: number;
    firstTryCorrect: number;
    firstTryErrors: number;
    accuracy: number | null;
    reinforced: boolean;
};
type UnitProgress = {
    status: 'practice' | 'consolidated' | 'review' | 'pending_review';
    attempts: number;
    correct: number;
    errors?: number;
    hints?: number;
    durationSec?: number;
    questionStats?: Array<{
        attempts: number;
        errors: number;
    }>;
    checkpoints?: LearningCheckpoint[];
    reinforcement?: { attempts: number; errors: number; completed: boolean };
    reviewQuestionIds?: string[];
    reviewPoolIds?: string[];
    reviewHistoryIds?: string[];
    reviewSeed?: number;
    reviewSelectionVersion?: number;
    reviewStage?: number;
    reviewCount?: number;
    intervalDays?: number;
    completedAt?: string;
    nextReviewAt?: string;
    updatedAt?: string;
};
type EduParticipant = {
    name: string;
    phone: string;
    email?: string;
    employeeId?: string;
    companyId?: string;
    companyName?: string;
    jobRole: string;
    role?: EduRole;
    status: 'active' | 'inactive';
    passwordHash: string;
    passwordSalt: string;
    mustChangePassword: boolean;
    level?: string;
    skillLevels?: Record<string, string>;
    skillConfidence?: Record<string, number>;
    progress?: number;
    completedModules?: string[];
    completedUnits?: string[];
    readingScore?: number;
    writingScore?: number;
    numeracyScore?: number;
    diagnosticCompletedAt?: string;
    lastActivityAt?: string;
    unitProgress?: Record<string, UnitProgress>;
    skillScores?: Record<string, number>;
    createdAt: string;
    updatedAt: string;
    pendingReviews?: ReviewRecord[];
    lessonAttempts?: LessonAttempt[];
};
type EduSession = {
    participantId: string;
    expiresAt: string;
    createdAt: string;
};
type DiagnosticRecord = {
    participantId: string;
    context: Record<string, string>;
    answers: Record<string, string>;
    readingScore: number;
    writingScore: number;
    numeracyScore: number;
    overallScore: number;
    level: string;
    createdAt: string;
};
type ReviewRecord = {
    id: string;
    participantId: string;
    unit: string;
    skill: string;
    level: string;
    question: string;
    response: string;
    submittedAt: string;
    attempts: number;
    correct: number;
    errors: number;
    questionStats?: Array<{ attempts: number; errors: number }>;
    expectedItems?: number;
    checkpoints?: LearningCheckpoint[];
    reinforcement?: { attempts: number; errors: number; completed: boolean };
};
const MODULES = ['leitura', 'compreensao', 'escrita', 'adicao-subtracao', 'multiplicacao', 'divisao', 'porcentagem', 'medidas', 'seguranca', 'direitos', 'saude', 'tecnologia'];
const enc = new TextEncoder(), now = () => new Date().toISOString(), rec = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const strMap = (v: unknown) => Object.fromEntries(Object.entries(rec(v)).map(([k, x]) => [k, String(x ?? '')]));
const diagnosticDraftStore: DiagnosticDraftStore = {
    list: async table => (await db.list<StoredDiagnosticDraftRecord>(table, { limit: 1 })).items,
    add: async (table, record) => { await db.add(table, [record]); },
    update: async (table, id, record) => { await db.update(table, [{ id, record }]); },
    delete: async (table, id) => { await db.delete(table, [id]); },
};
const keyHash = (v: string) => { let h = 2166136261; for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = Math.imul(h, 16777619);
} return (h >>> 0).toString(16); };
const phoneTable = (p: string) => 'edu_phone_' + keyHash(p), emailTable = (e: string) => 'edu_email_' + keyHash(e), centralGrantTable = (e: string) => 'edu_central_grant_' + keyHash(e), sessionTable = (t: string) => 'edu_session_' + keyHash(t), diagnosticTable = (id: string) => 'edu_diagnostic_' + id.replace(/[^a-zA-Z0-9_-]/g, '_');
const SUPERADMIN_EMAILS = new Set(['vmnutri.tech@gmail.com']);
const REVOKED_SUPERADMIN_EMAILS = new Set(['marcosvr.lima96@gmail.com']);
function phone(v: string) { let d = v.replace(/\D/g, ''); if (d.length === 10 || d.length === 11)
    d = '55' + d; return d.length >= 12 && d.length <= 13 ? d : ''; }
function email(v: string) { const e = v.trim().toLowerCase(); return /^\S+@\S+\.\S+$/.test(e) ? e : ''; }
async function hash(p: string, s: string) { const b = await crypto.subtle.importKey('raw', enc.encode(p), 'PBKDF2', false, ['deriveBits']), bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(s), iterations: 120000, hash: 'SHA-256' }, b, 256); return Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2, '0')).join(''); }
async function find(table: string) { const rows = (await db.list<Record<string, unknown>>(table, { limit: 1 })).items, id = String(rows[0]?.participantId || ''); if (!id)
    return null; const [p] = await db.get<EduParticipant>('edu_participants', [id]); return p ? { ...p, id } : null; }
async function issue(id: string) { const t = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''), stamp = now(); await db.add(sessionTable(t), [{ participantId: id, createdAt: stamp, expiresAt: new Date(Date.now() + 2592000000).toISOString() }]); return t; }
async function participant(t: string) { if (t.length < 40)
    return null; const s = (await db.list<EduSession>(sessionTable(t), { limit: 1 })).items[0]; if (!s || s.expiresAt < now())
    return null; const [p] = await db.get<EduParticipant>('edu_participants', [s.participantId]); return p?.status === 'active' ? { ...p, id: s.participantId } : null; }
export async function educationParticipantBySession(token: string) { return participant(token); }
const effectiveRole = (p: EduParticipant): EduRole => {
    const em = email(p.email || '');
    if (SUPERADMIN_EMAILS.has(em)) return 'superadmin';
    if (REVOKED_SUPERADMIN_EMAILS.has(em)) return 'colaborador';
    return effectiveEducationRole(p.role, p.jobRole);
};
const attemptSeed = () => Number.parseInt(crypto.randomUUID().replace(/-/g, '').slice(0, 8), 16) >>> 0;
const validUnit = (unit: string) => /^(leitura|compreensao|escrita|adicao|multiplicacao|divisao|porcentagem|medidas|seguranca|direitos|saude|tecnologia)-N[1-5]$/.test(unit);
function pub(p: EduParticipant & {
    id: string;
}) { return { id: p.id, name: p.name, phone: p.phone, email: p.email || null, employeeId: p.employeeId || null, companyId: p.companyId || null, companyName: p.companyName || null, jobRole: p.jobRole, role: effectiveRole(p), mustChangePassword: p.mustChangePassword, level: p.level || null, skillLevels: p.skillLevels || {}, skillConfidence: p.skillConfidence || {}, skillScores: p.skillScores || {}, unitProgress: p.unitProgress || {}, progress: p.progress || 0, completedModules: p.completedModules || [], completedUnits: p.completedUnits || [], readingScore: p.readingScore ?? null, writingScore: p.writingScore ?? null, numeracyScore: p.numeracyScore ?? null, diagnosticCompletedAt: p.diagnosticCompletedAt || null, lastActivityAt: p.lastActivityAt || null, preparedLesson: activeAttempt(p.lessonAttempts) ? { id: activeAttempt(p.lessonAttempts)!.id, unit: activeAttempt(p.lessonAttempts)!.unit, status: activeAttempt(p.lessonAttempts)!.status, preparedBy: activeAttempt(p.lessonAttempts)!.preparedBy } : null }; }
function score(a: Record<string, string>) { const skills = ['leitura', 'compreensao', 'escrita', 'adicao', 'multiplicacao', 'divisao', 'porcentagem', 'medidas', 'seguranca', 'direitos', 'saude', 'tecnologia']; const pct = (v: string) => { const lm = v.match(/^level:N([1-5])$/); if (lm)
    return (Number(lm[1]) - 1) * 25; const parts = v.split('/'), num = Number(parts[0]), den = Number(parts[1]); return parts.length === 2 && Number.isFinite(num) && Number.isFinite(den) && den > 0 ? Math.max(0, Math.min(100, Math.round(num / den * 100))) : 0; }; const toLevel = (x: number) => x < 12.5 ? 'N1' : x < 37.5 ? 'N2' : x < 62.5 ? 'N3' : x < 87.5 ? 'N4' : 'N5'; const skillScores = Object.fromEntries(skills.map(k => [k, pct(String(a[k] || ''))])); const reviewSkills = Object.entries(skillScores).filter(([, v]) => v < 50).map(([k]) => k); const skillLevels = Object.fromEntries(Object.entries(skillScores).map(([k, v]) => [k, toLevel(v)])); const readingScore = Math.round((skillScores.leitura + skillScores.compreensao) / 2), writingScore = skillScores.escrita, numeracyScore = Math.round((skillScores.adicao + skillScores.multiplicacao + skillScores.divisao + skillScores.porcentagem + skillScores.medidas) / 5), overallScore = Math.round(Object.values(skillScores).reduce((s, v) => s + v, 0) / skills.length), level = toLevel(overallScore); return { readingScore, numeracyScore, writingScore, overallScore, level, skillScores, skillLevels, reviewSkills }; }
export async function createCentralEducationSession(input: {
    email: string;
    name?: string;
    role?: EduRole;
}) { const em = email(input.email); if (!em)
    throw new Error('E-mail corporativo inválido.'); const desired = input.role && isEducationRole(input.role) ? input.role : 'colaborador'; let p = await find(emailTable(em)); if (!p) {
    const s = crypto.randomUUID().replace(/-/g, ''), stamp = now(), x: EduParticipant = { name: input.name || em.split('@')[0], phone: '', email: em, jobRole: educationJobRole(desired), role: desired, status: 'active', passwordSalt: s, passwordHash: await hash(crypto.randomUUID(), s), mustChangePassword: false, createdAt: stamp, updatedAt: stamp }, [id] = await db.add('edu_participants', [x]);
    if (!id)
        throw new Error('Não foi possível preparar o acesso à Universidade.');
    await db.add(emailTable(em), [{ participantId: id, createdAt: stamp }]);
    p = { ...x, id };
}
else if (input.role && p.role !== desired) {
    await db.update('edu_participants', [{ id: p.id, record: { ...p, role: desired, jobRole: educationJobRole(desired, p.jobRole), updatedAt: now() } }]);
    p = { ...p, role: desired, jobRole: educationJobRole(desired, p.jobRole) };
} return { token: await issue(p.id), participant: pub(p) }; }
export async function ensureEducationPhoneParticipant(input: { phone: string; name: string; employeeId?: string; companyId?: string; companyName?: string; jobRole?: string }) {
    const ph = phone(input.phone); if (!ph) throw new Error('Celular inválido.');
    let p = await find(phoneTable(ph));
    const stamp = now();
    if (!p) {
        const s = crypto.randomUUID().replace(/-/g, ''), x: EduParticipant = {
            name: input.name || 'Colaborador', phone: ph, employeeId: input.employeeId, companyId: input.companyId, companyName: input.companyName,
            jobRole: input.jobRole || educationJobRole('colaborador'), role: 'colaborador', status: 'active',
            passwordSalt: s, passwordHash: await hash(crypto.randomUUID(), s), mustChangePassword: true, createdAt: stamp, updatedAt: stamp
        }, [id] = await db.add('edu_participants', [x]);
        if (!id) throw new Error('Não foi possível preparar o acesso por celular.');
        await db.add(phoneTable(ph), [{ participantId: id, createdAt: stamp }]);
        p = { ...x, id };
    } else {
        const next = {
            ...p, phone: ph, name: input.name || p.name, employeeId: input.employeeId || p.employeeId,
            companyId: input.companyId || p.companyId, companyName: input.companyName || p.companyName,
            jobRole: input.jobRole || p.jobRole, role: 'colaborador' as EduRole, status: 'active' as const, updatedAt: stamp
        };
        await db.update('edu_participants', [{ id: p.id, record: next as unknown as Record<string, unknown> }]);
        p = next;
    }
    return { participant: pub(p) };
}
export async function educationPhoneAccessState(inputPhone: string) {
    const ph = phone(inputPhone); if (!ph) return null; const p = await find(phoneTable(ph)); if (!p || p.status !== 'active') return null;
    return { exists: true, needsPasswordSetup: p.mustChangePassword === true, participant: pub(p) };
}
export async function claimEducationPhonePassword(inputPhone: string, nextPassword: string) {
    const ph = phone(inputPhone); if (!ph || nextPassword.length < 8) return null; const p = await find(phoneTable(ph));
    if (!p || p.status !== 'active' || p.mustChangePassword !== true) return null;
    const s = crypto.randomUUID().replace(/-/g, ''), next = { ...p, passwordSalt: s, passwordHash: await hash(nextPassword, s), mustChangePassword: false, updatedAt: now() };
    await db.update('edu_participants', [{ id: p.id, record: next as unknown as Record<string, unknown> }]);
    return { token: await issue(p.id), participant: pub(next) };
}
export async function syncEducationIdentityByEmail(input: { email: string; employeeId?: string; companyId?: string; companyName?: string; name?: string; phone?: string; jobRole?: string }) { const em = email(input.email); if (!em) return false; const p = await find(emailTable(em)); if (!p) return false; const next = { ...p, employeeId: input.employeeId || p.employeeId, companyId: input.companyId || p.companyId, companyName: input.companyName || p.companyName, name: input.name || p.name, phone: input.phone || p.phone, jobRole: input.jobRole || p.jobRole, updatedAt: now() }; await db.update('edu_participants', [{ id: p.id, record: next as unknown as Record<string, unknown> }]); return true; }
export async function setEducationParticipantStatusByEmail(inputEmail: string, active: boolean) { const em = email(inputEmail); if (!em) return false; const p = await find(emailTable(em)); if (!p) return false; await db.update('edu_participants', [{ id: p.id, record: { ...p, status: active ? 'active' : 'inactive', updatedAt: now() } as unknown as Record<string, unknown> }]); return true; }
export const EDUCATION_ROUTES = { 'POST /api/edu/login': [async (c) => { const b = rec(c.body), id = String(b.identifier || '').trim(), ph = phone(id), em = email(id), pass = String(b.password || ''); if ((!ph && !em) || pass.length < 6)
            return error('E-mail/celular ou senha inválidos.', 400); const p = await find(em ? emailTable(em) : phoneTable(ph)); if (!p || await hash(pass, p.passwordSalt) !== p.passwordHash)
            return error('E-mail/celular ou senha inválidos.', 401); return json({ token: await issue(p.id), participant: pub(p) }); }], 'GET /api/edu/email/session': [requireAuth(), withScopes('email', 'profile'), async (c) => { const em = email(c.user!.email || ''); let p = await find(emailTable(em)); const grant = (await db.list<Record<string, unknown>>(centralGrantTable(em), { limit: 1 })).items[0], configuredSuperadmin = SUPERADMIN_EMAILS.has(em), validGrant = configuredSuperadmin || (!!grant && String(grant.email || '') === em && String(grant.expiresAt || '') > now()), grantRole = configuredSuperadmin ? 'superadmin' : (isEducationRole(String(grant?.role || '')) ? String(grant!.role) as EduRole : 'colaborador'); if (!p && !validGrant)
            return error('Este e-mail não foi liberado.', 403); if (!p) {
            const s = crypto.randomUUID().replace(/-/g, ''), stamp = now(), x: EduParticipant = { name: c.user!.name || em.split('@')[0], phone: '', email: em, jobRole: educationJobRole(grantRole), role: grantRole, status: 'active', passwordSalt: s, passwordHash: await hash(crypto.randomUUID(), s), mustChangePassword: false, createdAt: stamp, updatedAt: stamp }, [id] = await db.add('edu_participants', [x]);
            if (!id)
                return error('Não foi possível preparar o acesso.', 500);
            await db.add(emailTable(em), [{ participantId: id, createdAt: stamp }]);
            p = { ...x, id };
        }
        else if (REVOKED_SUPERADMIN_EMAILS.has(em) && p.role === 'superadmin') {
            await db.update('edu_participants', [{ id: p.id, record: { ...p, role: 'colaborador', jobRole: educationJobRole('colaborador', p.jobRole), updatedAt: now() } }]);
            p = { ...p, role: 'colaborador', jobRole: educationJobRole('colaborador', p.jobRole) };
        }
        else if (validGrant && p.role !== grantRole) {
            await db.update('edu_participants', [{ id: p.id, record: { ...p, role: grantRole, updatedAt: now() } }]);
            p = { ...p, role: grantRole };
        } return json({ token: await issue(p.id), participant: pub(p) }); }], 'POST /api/edu/me': [async (c) => { const p = await participant(String(rec(c.body).token || '')); if (!p)
            return error('Sessão expirada.', 401); return json({ participant: pub(p) }); }], 'POST /api/edu/password': [async (c) => { const b = rec(c.body), p = await participant(String(b.token || '')), next = String(b.password || ''); if (!p)
            return error('Sessão expirada.', 401); if (next.length < 8)
            return error('Use ao menos 8 caracteres.', 400); const s = crypto.randomUUID().replace(/-/g, ''); await db.update('edu_participants', [{ id: p.id, record: { ...p, passwordSalt: s, passwordHash: await hash(next, s), mustChangePassword: false, updatedAt: now() } }]); return json({ ok: true }); }], 'POST /api/edu/diagnostic': [async (c) => { const b = rec(c.body), p = await participant(String(b.token || '')); if (!p)
            return error('Sessão expirada.', 401); if (p.mustChangePassword)
            return error('Altere a senha provisória para continuar.', 403); const answers = strMap(b.answers), result = score(answers), stamp = now(), table = diagnosticTable(p.id), old = (await db.list<DiagnosticRecord>(table, { limit: 1 })).items[0], record: DiagnosticRecord = { participantId: p.id, context: strMap(b.context), answers, ...result, createdAt: stamp }; if (old)
            await db.update(table, [{ id: old.id, record }]);
        else
            await db.add(table, [record]); const finalDiagnosticSaved = true; await db.update('edu_participants', [{ id: p.id, record: { ...p, ...result, skillLevels: result.skillLevels, skillConfidence: Object.fromEntries(Object.keys(result.skillLevels).map(skill => [skill, 0.55])), skillScores: result.skillScores, progress: Math.max(p.progress || 0, 10), diagnosticCompletedAt: stamp, lastActivityAt: stamp, updatedAt: stamp } }]); const participantUpdated = true; if (canClearDiagnosticDraftAfterFinalization(finalDiagnosticSaved, participantUpdated))
            await clearDiagnosticDraft(diagnosticDraftStore, p.id); return json({ result }); }], 'POST /api/edu/progress': [async (c) => { const b = rec(c.body), p = await participant(String(b.token || '')), m = String(b.module || ''); if (!p)
            return error('Sessão expirada.', 401); if (p.mustChangePassword)
            return error('Altere a senha provisória para continuar.', 403); if (!MODULES.includes(m))
            return error('Módulo inválido.', 400); const completed = Array.from(new Set([...(p.completedModules || []), m])); await db.update('edu_participants', [{ id: p.id, record: { ...p, completedModules: completed, progress: Math.round(completed.length / MODULES.length * 100), updatedAt: now() } }]); return json({ ok: true, completedModules: completed }); }], 'POST /api/edu/attempt/open': [async (c) => { const body=rec(c.body),p=await participant(String(body.token||'')),unit=String(body.unit||''); if(!p)return error('Sessão expirada.',401); if(!validUnit(unit))return error('Unidade inválida.',400); let attempt=activeAttempt(p.lessonAttempts,unit),changed=false; if(attempt&&!attempt.selectionVersion&&attempt.responseCount===0){attempt={...attempt,selectionVersion:2,questionIds:[],reinforcementQuestionIds:[],updatedAt:now()};changed=true} if(!attempt){const stamp=now(),progress=p.unitProgress?.[unit],dueReview=!!progress?.reviewQuestionIds?.length&&(progress.status==='review'||!!progress.nextReviewAt&&Date.parse(progress.nextReviewAt)<=Date.now()),mode=dueReview?'review':'lesson',seed=mode==='review'?Number(progress?.reviewSeed||attemptSeed()):attemptSeed(),selectionVersion=mode==='review'?Number(progress?.reviewSelectionVersion||1):2; attempt=createLessonAttempt({id:crypto.randomUUID(),participantId:p.id,unit,seed,createdAt:stamp,preparedBy:'learner',mode,selectionVersion}); if(mode==='review')attempt=freezeLessonAttempt(attempt,progress!.reviewQuestionIds,[],stamp);changed=true} if(changed){const lessonAttempts=replaceAttempt(p.lessonAttempts,attempt);await db.update('edu_participants',[{id:p.id,record:{...p,lessonAttempts,updatedAt:attempt.updatedAt}}])} return json({attempt}); }], 'POST /api/edu/attempt/freeze': [async (c) => { const body = rec(c.body), p = await participant(String(body.token || '')), attemptId = String(body.attemptId || ''); if (!p) return error('Sessão expirada.', 401); const attempt = (p.lessonAttempts || []).find(item => item.id === attemptId); if (!attempt) return error('Tentativa não encontrada.', 404); try { const next = freezeLessonAttempt(attempt, body.questionIds, body.reinforcementQuestionIds, now()), lessonAttempts = replaceAttempt(p.lessonAttempts, next); await db.update('edu_participants', [{ id: p.id, record: { ...p, lessonAttempts, updatedAt: next.updatedAt } }]); return json({ attempt: next }); } catch (e) { return error(e instanceof Error ? e.message : 'Composição inválida.', 409); } }],
'POST /api/edu/attempt/respond': [async (c) => { const body = rec(c.body), p = await participant(String(body.token || '')), attemptId = String(body.attemptId || ''), questionId = String(body.questionId || ''), response = String(body.response || ''), correct = typeof body.correct === 'boolean' ? body.correct : null; if (!p) return error('Sessão expirada.', 401); const attempt = (p.lessonAttempts || []).find(item => item.id === attemptId); if (!attempt) return error('Tentativa não encontrada.', 404); try { const next = recordAttemptResponse(attempt, { questionId, response, correct, source: 'learner', updatedAt: now() }), lessonAttempts = replaceAttempt(p.lessonAttempts, next); await db.update('edu_participants', [{ id: p.id, record: { ...p, lessonAttempts, updatedAt: next.updatedAt } }]); return json({ attempt: next }); } catch (e) { return error(e instanceof Error ? e.message : 'Resposta inválida.', 409); } }],
'POST /api/edu/unit': [async (c) => { const b = rec(c.body), p = await participant(String(b.token || '')), u = String(b.unit || ''); if (!p)
            return error('Sessão expirada.', 401); if (p.mustChangePassword)
            return error('Altere a senha provisória para continuar.', 403); if (!validUnit(u))
            return error('Unidade inválida.', 400); if (hasActivePendingReview(p.unitProgress?.[u]?.status, p.pendingReviews, u))
            return error('Esta unidade aguarda correção do RH.', 409); const attemptId = String(b.attemptId || ''), lessonAttempt = attemptId ? (p.lessonAttempts || []).find(item => item.id === attemptId) : null; if (attemptId && (!lessonAttempt || lessonAttempt.unit !== u)) return error('Tentativa de aula inválida.', 409); const attempts = Math.max(1, Math.min(99, Math.floor(Number(b.attempts || 1)))), errors = Math.max(0, Math.min(attempts, Math.floor(Number(b.errors || 0)))), hints = Math.max(0, Math.min(errors, Math.floor(Number(b.hints || errors)))), durationSec = Math.max(1, Math.min(7200, Math.floor(Number(b.durationSec || 1)))), expectedItems = Math.max(3, Math.min(13, Math.floor(Number(b.expectedItems || 3)))), rawStats = Array.isArray(b.questionStats) ? b.questionStats.slice(0, expectedItems) : [], questionStats = rawStats.map(x => { const q = rec(x); return { attempts: Math.max(0, Math.min(20, Math.floor(Number(q.attempts || 0)))), errors: Math.max(0, Math.min(20, Math.floor(Number(q.errors || 0)))) }; }), rawCheckpoints = Array.isArray(b.checkpoints) ? b.checkpoints.slice(0, 4) : [], checkpoints = rawCheckpoints.map(value => { const x = rec(value), rawBlock = String(x.block || 'part1'), block = (['part1','part2','review','reinforcement'].includes(rawBlock) ? rawBlock : 'part1') as LearningCheckpoint['block'], graded = Math.max(0, Math.min(13, Math.floor(Number(x.graded || 0)))), firstTryCorrect = Math.max(0, Math.min(graded, Math.floor(Number(x.firstTryCorrect || 0)))), firstTryErrors = Math.max(0, Math.min(graded, Math.floor(Number(x.firstTryErrors || 0)))), attempted = Math.max(0, Math.min(13, Math.floor(Number(x.attempted || 0)))), accuracy = x.accuracy == null ? null : Math.max(0, Math.min(100, Math.round(Number(x.accuracy || 0)))); return { block, attempted, graded, firstTryCorrect, firstTryErrors, accuracy, reinforced: !!x.reinforced }; }), reinforcementInput = rec(b.reinforcement), reinforcement = { attempts: Math.max(0, Math.min(20, Math.floor(Number(reinforcementInput.attempts || 0)))), errors: Math.max(0, Math.min(20, Math.floor(Number(reinforcementInput.errors || 0)))), completed: !!reinforcementInput.completed }, consolidation = evaluateObjectiveConsolidation(questionStats, expectedItems), correct = consolidation.correctItems, consolidated = consolidation.consolidated, openResponses = normalizeOpenResponses(b.openResponses), hasOpenAnswer = openResponses.length > 0, previous = p.unitProgress?.[u], first = !previous?.completedAt, due = !!previous && (previous.status === 'review' || previous.status === 'pending_review' || !previous.nextReviewAt || Date.parse(previous.nextReviewAt) <= Date.now()), previousStage = Math.max(0, Math.min(4, Math.floor(Number(previous?.reviewStage ?? 0)))), reviewStage = first ? 0 : due ? (errors === 0 ? Math.min(4, previousStage + 1) : Math.max(0, previousStage - 1)) : previousStage, intervals = [1, 3, 7, 14, 30], intervalDays = intervals[reviewStage], reviewCount = Math.max(0, Math.floor(Number(previous?.reviewCount || 0))) + (first ? 0 : due ? 1 : 0), stamp = now(), nextReviewAt = new Date(Date.now() + intervalDays * 86400000).toISOString(), reviewPoolIds = lessonAttempt?.mode === 'review' ? (previous?.reviewPoolIds || lessonAttempt.questionIds) : lessonAttempt ? Array.from(new Set([...lessonAttempt.questionIds, ...lessonAttempt.reinforcementQuestionIds])) : (previous?.reviewPoolIds || []), reviewEvidence = (lessonAttempt?.responses || []).map(response => ({ questionId: response.questionId, firstTryCorrect: response.firstTryCorrect })), reviewPlan = buildSpacedReviewPlan({ poolIds: reviewPoolIds, previousPlan: lessonAttempt?.mode === 'review' ? lessonAttempt.questionIds : previous?.reviewQuestionIds, historyIds: previous?.reviewHistoryIds, evidence: reviewEvidence, count: 4 }), reviewQuestionIds = reviewPlan.plan, reviewHistoryIds = reviewPlan.historyIds, reviewSeed = Number(previous?.reviewSeed || lessonAttempt?.seed || attemptSeed()), reviewSelectionVersion = Number(lessonAttempt?.selectionVersion || previous?.reviewSelectionVersion || 1), pendingId = crypto.randomUUID(), pendingReviews = (p.pendingReviews || []).filter(x => x.unit !== u), pending = hasOpenAnswer ? { id: pendingId, participantId: p.id, unit: u, skill: u.replace(/-N[1-5]$/, ''), level: u.match(/N[1-5]$/)?.[0] || 'N1', question: openResponses.map(x => x.question).filter(Boolean).join(' | ').slice(0, 1000) || 'Resposta aberta da unidade', response: openResponses.map(x => x.response).filter(Boolean).join(' | ').slice(0, 4000), submittedAt: stamp, attempts, correct, errors, questionStats, expectedItems, checkpoints, reinforcement } : null, entry = hasOpenAnswer ? { status: 'pending_review', attempts, correct, errors, hints, durationSec, questionStats, checkpoints, reinforcement, reviewQuestionIds, reviewPoolIds: reviewPlan.poolIds, reviewHistoryIds, reviewSeed, reviewSelectionVersion, reviewStage, reviewCount, intervalDays, updatedAt: stamp } : consolidated ? { status: 'consolidated', attempts, correct, errors, hints, durationSec, questionStats, checkpoints, reinforcement, reviewQuestionIds, reviewPoolIds: reviewPlan.poolIds, reviewHistoryIds, reviewSeed, reviewSelectionVersion, reviewStage, reviewCount, intervalDays, completedAt: stamp, nextReviewAt, updatedAt: stamp } : { status: 'practice', attempts, correct, errors, hints, durationSec, questionStats, checkpoints, reinforcement, reviewQuestionIds, reviewPoolIds: reviewPlan.poolIds, reviewHistoryIds, reviewSeed, reviewSelectionVersion, reviewStage: previous?.reviewStage ?? 0, reviewCount: previous?.reviewCount ?? 0, intervalDays: previous?.intervalDays, updatedAt: stamp }, progress = { ...(p.unitProgress || {}), [u]: entry }, nextPendingReviews = pending ? [...pendingReviews, pending] : pendingReviews, done = consolidated && !hasOpenAnswer ? Array.from(new Set([...(p.completedUnits || []), u])) : (p.completedUnits || []).filter(x => x !== u), skill = u.replace(/-N[1-5]$/, ''), unitLevel = u.match(/N[1-5]$/)?.[0] || 'N1', leveling = updateContinuousLevel({ currentLevel: p.skillLevels?.[skill] || unitLevel, unitLevel, previousConfidence: p.skillConfidence?.[skill], previousScore: p.skillScores?.[skill], checkpoints, consolidated: consolidated && !hasOpenAnswer, reinforcementCompleted: reinforcement.completed }), nextSkillLevels = { ...(p.skillLevels || {}), [skill]: leveling.level }, nextSkillConfidence = { ...(p.skillConfidence || {}), [skill]: leveling.confidence }, nextSkillScores = { ...(p.skillScores || {}), [skill]: leveling.score }, finishedAttempt = lessonAttempt ? completeLessonAttempt(lessonAttempt, stamp) : null, lessonAttempts = finishedAttempt ? replaceAttempt(p.lessonAttempts, finishedAttempt) : p.lessonAttempts; await db.update('edu_participants', [{ id: p.id, record: { ...p, pendingReviews: nextPendingReviews, completedUnits: done, unitProgress: progress, skillLevels: nextSkillLevels, skillConfidence: nextSkillConfidence, skillScores: nextSkillScores, lessonAttempts, progress: Math.round(done.length / 60 * 100), lastActivityAt: stamp, updatedAt: stamp } }]); return json({ ok: true, consolidated: consolidated && !hasOpenAnswer, status: entry.status, pendingReview: pending, completedUnits: done, unitProgress: progress, leveling, skillLevels: nextSkillLevels, skillConfidence: nextSkillConfidence, preparedLesson: activeAttempt(lessonAttempts) ? { id: activeAttempt(lessonAttempts)!.id, unit: activeAttempt(lessonAttempts)!.unit, status: activeAttempt(lessonAttempts)!.status, preparedBy: activeAttempt(lessonAttempts)!.preparedBy } : null, review: consolidated && !hasOpenAnswer ? { reviewStage, reviewCount, intervalDays, nextReviewAt } : null }); }], 'POST /api/edu/admin/attempt/paper-response': [async (c) => { const body=rec(c.body),actor=await participant(String(body.token||'')); if(!actor)return error('Sessão expirada.',401); if(!canAccessAdminOverview(effectiveRole(actor)))return error('Acesso restrito ao Tutor.',403); const targetId=String(body.participantId||''),attemptId=String(body.attemptId||''),questionId=String(body.questionId||''),response=String(body.response||''),correct=typeof body.correct==='boolean'?body.correct:null,[target]=await db.get<EduParticipant>('edu_participants',[targetId]); if(!target)return error('Colaborador não encontrado.',404); const attempt=(target.lessonAttempts||[]).find(item=>item.id===attemptId); if(!attempt)return error('Aula preparada não encontrada.',404); try{const next=recordAttemptResponse(attempt,{questionId,response,correct,source:'tutor-paper',updatedAt:now()}),lessonAttempts=replaceAttempt(target.lessonAttempts,next); await db.update('edu_participants',[{id:targetId,record:{...target,lessonAttempts,updatedAt:next.updatedAt}}]); return json({attempt:next})}catch(e){return error(e instanceof Error?e.message:'Resposta do papel inválida.',409)} }],
'POST /api/edu/admin/participant': [async (c) => { const body=rec(c.body),actor=await participant(String(body.token||'')); if(!actor)return error('Sessão expirada.',401); if(!canAccessAdminOverview(effectiveRole(actor)))return error('Acesso restrito ao Tutor.',403); const targetId=String(body.participantId||''),[target]=await db.get<EduParticipant>('edu_participants',[targetId]); if(!target)return error('Colaborador não encontrado.',404); return json({participant:pub({...target,id:targetId}),lessonAttempts:[...(target.lessonAttempts||[])].reverse().slice(0,20),pendingReviews:target.pendingReviews||[]}); }],
'POST /api/edu/admin/attempt/prepare': [async (c) => { const body=rec(c.body),actor=await participant(String(body.token||'')); if(!actor)return error('Sessão expirada.',401); if(!canAccessAdminOverview(effectiveRole(actor)))return error('Acesso restrito ao Tutor.',403); const targetId=String(body.participantId||''),unit=String(body.unit||''); if(!validUnit(unit))return error('Unidade inválida.',400); const [target]=await db.get<EduParticipant>('edu_participants',[targetId]); if(!target)return error('Colaborador não encontrado.',404); const active=activeAttempt(target.lessonAttempts); if(active?.responseCount)return error('O colaborador já iniciou uma aula. Conclua essa tentativa antes de preparar outra.',409); if(active&&active.unit===unit&&active.preparedBy==='tutor')return json({attempt:active}); const stamp=now(),attempt=createLessonAttempt({id:crypto.randomUUID(),participantId:targetId,unit,seed:attemptSeed(),createdAt:stamp,preparedBy:'tutor'}),withoutUnused=(target.lessonAttempts||[]).filter(item=>!(item.status==='prepared'&&item.responseCount===0)),lessonAttempts=replaceAttempt(withoutUnused,attempt); await db.update('edu_participants',[{id:targetId,record:{...target,lessonAttempts,updatedAt:stamp}}]); return json({attempt}); }],
'POST /api/edu/admin/attempt/freeze': [async (c) => { const body=rec(c.body),actor=await participant(String(body.token||'')); if(!actor)return error('Sessão expirada.',401); if(!canAccessAdminOverview(effectiveRole(actor)))return error('Acesso restrito ao Tutor.',403); const targetId=String(body.participantId||''),attemptId=String(body.attemptId||''),[target]=await db.get<EduParticipant>('edu_participants',[targetId]); if(!target)return error('Colaborador não encontrado.',404); const attempt=(target.lessonAttempts||[]).find(item=>item.id===attemptId); if(!attempt)return error('Aula preparada não encontrada.',404); try{const next=freezeLessonAttempt(attempt,body.questionIds,body.reinforcementQuestionIds,now()),lessonAttempts=replaceAttempt(target.lessonAttempts,next); await db.update('edu_participants',[{id:targetId,record:{...target,lessonAttempts,updatedAt:next.updatedAt}}]); return json({attempt:next})}catch(e){return error(e instanceof Error?e.message:'Composição inválida.',409)} }],
'POST /api/edu/admin/attempt/reroll': [async (c) => { const body=rec(c.body),actor=await participant(String(body.token||'')); if(!actor)return error('Sessão expirada.',401); if(!canAccessAdminOverview(effectiveRole(actor)))return error('Acesso restrito ao Tutor.',403); const targetId=String(body.participantId||''),attemptId=String(body.attemptId||''),[target]=await db.get<EduParticipant>('edu_participants',[targetId]); if(!target)return error('Colaborador não encontrado.',404); const attempt=(target.lessonAttempts||[]).find(item=>item.id===attemptId); if(!attempt)return error('Aula preparada não encontrada.',404); try{const next=rerollLessonAttempt(attempt,attemptSeed(),now()),lessonAttempts=replaceAttempt(target.lessonAttempts,next); await db.update('edu_participants',[{id:targetId,record:{...target,lessonAttempts,updatedAt:next.updatedAt}}]); return json({attempt:next})}catch(e){return error(e instanceof Error?e.message:'Não foi possível sortear outra aula.',409)} }],
'POST /api/edu/admin/overview': [async (c) => { const actor = await participant(String(rec(c.body).token || '')); if (!actor)
            return error('Sessão expirada.', 401); if (!canAccessAdminOverview(effectiveRole(actor)))
            return error('Acesso restrito à Administração/RH.', 403); const items = (await db.list<EduParticipant>('edu_participants', { limit: 200 })).items; return json(buildAdminOverview(items, p => pub({ ...(p as EduParticipant), id: p.id }))); }], 'POST /api/edu/admin/review': [async (c) => { const b = rec(c.body), actor = await participant(String(b.token || '')), reviewId = String(b.reviewId || ''), action = String(b.action || ''); if (!actor)
            return error('Sessão expirada.', 401); if (!isAdministrationRole(effectiveRole(actor)))
            return error('Acesso restrito à Administração/RH.', 403); if (!reviewId || !['approve', 'needs_revision'].includes(action))
            return error('Revisão inválida.', 400); const items = (await db.list<EduParticipant>('edu_participants', { limit: 200 })).items, target = items.find(x => (x.pendingReviews || []).some(r => r.id === reviewId)); if (!target)
            return error('Resposta pendente não encontrada.', 404); const pending = (target.pendingReviews || []).find(r => r.id === reviewId)!, remaining = (target.pendingReviews || []).filter(r => r.id !== reviewId), sameUnit = remaining.some(r => r.unit === pending.unit), previous = target.unitProgress?.[pending.unit], stamp = now(), expectedItems = Math.max(1, Math.min(20, Math.floor(Number(pending.expectedItems || pending.questionStats?.length || 3)))), canConsolidate = action === 'approve' && !sameUnit && evaluateObjectiveConsolidation(pending.questionStats || [], expectedItems).consolidated, reviewStage = Math.max(0, Math.min(4, Math.floor(Number(previous?.reviewStage ?? 0)))), intervalDays = [1, 3, 7, 14, 30][reviewStage], nextReviewAt = new Date(Date.now() + intervalDays * 86400000).toISOString(), entry = canConsolidate ? { status: 'consolidated', attempts: pending.attempts, correct: pending.correct, errors: pending.errors, questionStats: pending.questionStats || [], checkpoints: pending.checkpoints || previous?.checkpoints || [], reinforcement: pending.reinforcement || previous?.reinforcement, reviewQuestionIds: previous?.reviewQuestionIds || [], reviewPoolIds: previous?.reviewPoolIds || [], reviewHistoryIds: previous?.reviewHistoryIds || [], reviewSeed: previous?.reviewSeed, reviewSelectionVersion: previous?.reviewSelectionVersion, reviewStage, reviewCount: previous?.reviewCount || 0, intervalDays, completedAt: stamp, nextReviewAt } : { status: 'practice', attempts: pending.attempts, correct: pending.correct, errors: pending.errors, questionStats: pending.questionStats || [], checkpoints: pending.checkpoints || previous?.checkpoints || [], reinforcement: pending.reinforcement || previous?.reinforcement, reviewStage, reviewCount: previous?.reviewCount || 0, intervalDays }, completedUnits = canConsolidate ? Array.from(new Set([...(target.completedUnits || []), pending.unit])) : (target.completedUnits || []).filter(x => x !== pending.unit); await db.update('edu_participants', [{ id: target.id, record: { ...target, pendingReviews: remaining, completedUnits, unitProgress: { ...(target.unitProgress || {}), [pending.unit]: entry }, progress: Math.round(completedUnits.length / 60 * 100), updatedAt: stamp } }]); return json({ ok: true, status: entry.status, completedUnits }); }], 'POST /api/edu/admin/role': [async (c) => { const b = rec(c.body), actor = await participant(String(b.token || '')); if (!actor)
            return error('Sessão expirada.', 401); const actorRole = effectiveRole(actor); if (!canManageEducationRoles(actorRole))
            return error('Apenas Superadmin ou Admin pode alterar perfis.', 403); const targetId = String(b.participantId || ''), rawRole = String(b.role || ''); if (!targetId || !isEducationRole(rawRole))
            return error('Perfil inválido.', 400); const nextRole = rawRole as EduRole, [target] = await db.get<EduParticipant>('edu_participants', [targetId]); if (!target)
            return error('Participante não encontrado.', 404); const targetRole = effectiveRole(target), decision = educationRoleChangeDecision({ actorRole, targetRole, nextRole, isSelf: targetId === actor.id }); if (decision === 'admin-boundary')
            return error('Admin pode gerenciar apenas RH, Gestor e Colaborador.', 403); if (decision === 'self-superadmin-demotion')
            return error('O Superadmin não pode remover o próprio acesso.', 409); await db.update('edu_participants', [{ id: targetId, record: { ...target, role: nextRole, jobRole: educationJobRole(nextRole, target.jobRole), updatedAt: now() } }]); return json({ participant: pub({ ...target, id: targetId, role: nextRole, jobRole: educationJobRole(nextRole, target.jobRole) }) }); }] };
export const EDUCATION_PHONE_ACCESS_ROUTES = {
    'POST /api/edu/access-status': [async (c) => {
        const state = await educationPhoneAccessState(String(rec(c.body).identifier || ''));
        if (!state) return error('Celular ainda não liberado pelo RH.', 404);
        return json({ exists: true, needsPasswordSetup: state.needsPasswordSetup, participant: state.participant });
    }],
    'POST /api/edu/first-access': [async (c) => {
        const b = rec(c.body), password = String(b.password || '');
        if (password.length < 8) return error('Use ao menos 8 caracteres.', 400);
        const session = await claimEducationPhonePassword(String(b.identifier || ''), password);
        if (!session) return error('Primeiro acesso indisponível para este celular.', 409);
        return json(session);
    }],
};
export const EDUCATION_DRAFT_ROUTES = {
    'POST /api/edu/diagnostic/draft/read': [async (c) => {
            const p = await participant(String(rec(c.body).token || ''));
            if (!p)
                return error('Sessão expirada.', 401);
            return json({ draft: sanitizeDiagnosticDraft(await readDiagnosticDraft(diagnosticDraftStore, p.id)) });
        }],
    'POST /api/edu/diagnostic/draft/save': [async (c) => {
            const b = rec(c.body), p = await participant(String(b.token || ''));
            if (!p)
                return error('Sessão expirada.', 401);
            if (p.mustChangePassword)
                return error('Altere a senha provisória para continuar.', 403);
            const draft = createDiagnosticDraft(b.draft, now());
            if (!draft)
                return error('Rascunho da sondagem inválido.', 400);
            await saveDiagnosticDraft(diagnosticDraftStore, p.id, draft);
            return json({ draft });
        }],
    'POST /api/edu/diagnostic/draft/clear': [async (c) => {
            const p = await participant(String(rec(c.body).token || ''));
            if (!p)
                return error('Sessão expirada.', 401);
            await clearDiagnosticDraft(diagnosticDraftStore, p.id);
            return json({ ok: true });
        }],
};

