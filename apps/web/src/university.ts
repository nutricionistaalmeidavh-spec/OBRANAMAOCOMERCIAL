import { api, auth } from '@appdeploy/client';
import './university.css';
import { hydrateQuestionVisuals } from './question-image-loader-v2';
import { hasQuestionVisual } from './question-visual-index';
import { evaluateLessonAnswer, lessonAccessViewModel, lessonAttemptFeedback, lessonFeedbackViewModel } from './lesson-feedback';
import { T, AREAS, MATERIAL_SOURCES, sourceRefs, AUDIT_ROWS, CONTENT, CALIBRATION_BANK, LEVEL_GUIDE, selectQuestions } from './curriculum';
import { LEARNING_STAGES, completedLevelsForSkill, learningStageForLevel, learningStageProgress, learningStageTargetLevel } from './learning-stages';
import { buildTeachingSequence } from './lesson-teaching';
import { buildLessonComposition, questionsByIds } from './lesson-composition';
import { canTutorReroll, nextTutorUnit, tutorAttemptStatus } from './tutor-model';
import { journeyHeadline, journeyStageViews, sessionEstimate } from './journey-view';
import { checkpointEvidence, checkpointLabel, selectReinforcementQuestions, shouldReinforce, type FirstTryResult, type LessonCheckpoint } from './lesson-adaptation';
import { accountMismatchMessage, destinationAfterAuthentication, googleLoginError, loginMethod, shouldRecoverWithGoogle } from './auth-flow';
import { competencySummary, getNextLearningAction, getProgressLabel, type LearningUnit } from './learning-state';
import { navigationItems } from './navigation-model';
import { selectSupportExcerpt } from './support-selector';
import { progressMetrics } from './progress-metrics';
import { canAccessAdmin as canAccessAdminRole, canManageRoles as canManageRolesRule } from './rules';
import { SUPPORT_MATERIALS } from './support-materials';
import { adminFailureDetail, adminGroupLabel, educationRoleLabel } from './admin-rh-model';
import { createPracticeUi } from './practice-ui';
// Mantém identificadores pedagógicos legados no banco, mas neutraliza nomenclatura
// técnica antes de qualquer renderização para o colaborador.
for (const area of AREAS as Array<{ name: string }>) {
    if (/alfabetiza/i.test(area.name)) area.name = 'Comunicação';
}
type UnitState = {
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
    checkpoints?: LessonCheckpoint[];
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
type P = {
    name: string;
    email?: string | null;
    jobRole: string;
    role?: 'superadmin' | 'admin' | 'rh' | 'gestor' | 'colaborador';
    level: string | null;
    skillLevels?: Record<string, string>;
    skillConfidence?: Record<string, number>;
    progress: number;
    completedUnits?: string[];
    unitProgress?: Record<string, UnitState>;
    diagnosticCompletedAt: string | null;
    lastActivityAt?: string | null;
    mustChangePassword: boolean;
    preparedLesson?: { id: string; unit: string; status: string; preparedBy: string } | null;
};
let me: {
    participant: P;
} | null = null;
const S = 'mh-edu-session', L = ['N1', 'N2', 'N3', 'N4', 'N5'];
const tok = () => localStorage.getItem(S) || '', done = () => new Set(me?.participant.completedUnits || []), admin = () => canAccessAdminRole(me?.participant.role), canManageRoles = () => canManageRolesRule(me?.participant.role), all = () => T.flatMap(t => L.map((l, i) => ({ id: t[0] + '-' + l, t: t[0], n: t[1], i: t[2], l, k: i + 1 })));
const practiceUi = createPracticeUi({ token: tok, participant: () => me?.participant || null, render: (title, html, nav) => ui(title, html, nav), notify: say, errorMessage: message });
function say(x: string) { let e = document.getElementById('eduToast'); if (!e) {
    e = document.createElement('div');
    e.id = 'eduToast';
    document.body.append(e);
} e.textContent = x; e.className = 'edu-toast show'; setTimeout(() => e?.classList.remove('show'), 2500); }
function message(x: unknown) { const q = x as {
    response?: {
        data?: {
            error?: string;
            message?: string;
        };
    };
    message?: string;
    code?: string;
}; return q.response?.data?.error || q.response?.data?.message || q.message || q.code || 'Não foi possível concluir o acesso.'; }
type GuideContext = 'home' | 'tracks' | 'lesson' | 'diagnostic' | 'development' | 'tasks';
function guideCopy(context: GuideContext) {
    return ({
        home: ['Um passo de cada vez', 'Sua próxima atividade já está pronta.'],
        tracks: ['Escolha seu próximo passo', 'A recomendação fica em destaque.'],
        lesson: ['Você consegue', 'Leia o apoio e tente no seu ritmo.'],
        diagnostic: ['Vamos começar', 'Não é prova: é só um ponto de partida.'],
        development: ['Seu caminho aparece aqui', 'Cada atividade fortalece uma habilidade.'],
        tasks: ['Tarefa de hoje', 'Poucos minutos já contam.']
    } as Record<GuideContext, [string, string]>)[context];
}
function guideHtml(context: GuideContext, compact = false) { const [title, text] = guideCopy(context); return '<aside class="edu-mh-guide ' + (compact ? 'edu-mh-guide--compact' : '') + '" data-guide-context="' + context + '"><div class="edu-mh-avatar" aria-hidden="true"><img class="edu-mh-frame" src="./guide/mh-neutral.webp" alt=""></div><div class="edu-mh-bubble"><small>GUIA MH</small><strong>' + title + '</strong><p>' + text + '</p></div></aside>'; }
function inferredGuide(a: string, h: string): GuideContext | undefined { if (a === 'tarefas') return 'tasks'; if (a === 'diagnostico') return 'diagnostic'; if (a === 'evolucao') return 'development'; if (a === 'trilhas' && !h.includes('edu-area-hero')) return h.includes('edu-lesson') || h.includes('edu-question-support') ? 'lesson' : 'tracks'; return undefined; }
function upgradeLegacyGuide(root: ParentNode = document) { root.querySelectorAll<HTMLElement>('.edu-mh-mascot').forEach(node => { node.className = 'edu-mh-avatar'; node.innerHTML = '<img class="edu-mh-frame" src="./guide/mh-neutral.webp" alt="">'; }); }
function addPortalLink(root: ParentNode = document) { const header = root.querySelector('.edu-top'); if (header && !header.querySelector('.edu-portal-link')) header.insertAdjacentHTML('beforeend', '<a class="edu-portal-link" href="./index.html#portal" aria-label="Voltar ao Portal MH">Portal MH</a>'); }
function pageContent(h: string, guide?: GuideContext) { if (guide === 'home') { const marker = '<section class="edu-home-journey">'; const end = '</section>'; const start = h.indexOf(marker); if (start >= 0) { const close = h.indexOf(end, start) + end.length; return h.slice(0, start) + '<div class="edu-home-overview">' + h.slice(start, close) + guideHtml('home') + '</div>' + h.slice(close); } } return (guide ? guideHtml(guide, true) : '') + h; }
function arrangeHomeGuide(root: ParentNode = document) { const guide = root.querySelector<HTMLElement>('.edu-mh-guide[data-guide-context="home"]'); const journey = root.querySelector<HTMLElement>('.edu-home-journey'); if (!guide || !journey || journey.parentElement?.classList.contains('edu-home-overview')) return; const wrap = document.createElement('div'); wrap.className = 'edu-home-overview'; journey.parentNode?.insertBefore(wrap, journey); wrap.append(journey, guide); }
function bindGuideAnimation(root: ParentNode = document) { const img = root.querySelector<HTMLImageElement>('.edu-mh-frame'); if (!img || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; const frames = ['./guide/mh-neutral.webp', './guide/mh-blink.webp', './guide/mh-wave.webp', './guide/mh-breathe.webp']; frames.slice(1).forEach(src => { const preload = new Image(); preload.src = src; }); let index = 0; window.setInterval(() => { if (!document.body.contains(img)) return; index = (index + 1) % frames.length; img.src = frames[index]; }, 1800); }
function ui(title: string, h: string, a = 'inicio', guide?: GuideContext) { const nav = navigationItems({ diagnosticCompleted: !!me?.participant.diagnosticCompletedAt, role: me?.participant.role }); const pageGuide = guide || inferredGuide(a, h); document.body.className = 'edu-body'; document.body.innerHTML = '<div class="edu-app"><aside class="edu-side"><div class="edu-brand"><b>MH</b><span>INSTALAÇÕES<br>HIDRÁULICAS</span></div><nav aria-label="Navegação principal">' + nav.map(x => '<button data-nav="' + x.id + '" class="' + (a === x.id ? 'active' : '') + '" ' + (a === x.id ? 'aria-current="page"' : '') + '>' + x.label + '</button>').join('') + '</nav></aside><main><header class="edu-top"><strong>' + title + '</strong><span>' + me?.participant.name + '<small>' + me?.participant.jobRole + '</small></span></header><section class="edu-content">' + pageContent(h, pageGuide) + '</section></main></div><div id="eduToast" class="edu-toast" role="status" aria-live="polite"></div>'; upgradeLegacyGuide(document); arrangeHomeGuide(document); addPortalLink(document); document.querySelectorAll<HTMLElement>('[data-nav]').forEach(x => x.onclick = () => go(x.dataset.nav || 'inicio')); bindGuideAnimation(document); void hydrateQuestionVisuals(document); }
function afterAuth() { if (!me)
    return login(); const destination = destinationAfterAuthentication(me.participant); if (destination === 'password-change')
    return passwordChange(); if (destination === 'welcome')
    return welcome(); if (destination === 'journey')
    return journey(); home(); }
async function googleSession() { const r = await api.get('/api/edu/email/session'); localStorage.setItem(S, r.data.token); me = { participant: r.data.participant }; afterAuth(); }
async function mount() { let expired = false; if (tok()) {
    try {
        me = (await api.post('/api/edu/me', { token: tok() })).data;
        return afterAuth();
    }
    catch {
        localStorage.removeItem(S);
        expired = true;
    }
} if (shouldRecoverWithGoogle(auth.isSignedIn())) {
    try {
        return await googleSession();
    }
    catch (x) {
        return login(googleLoginError(x));
    }
} login(expired ? 'Sua sessão expirou. Entre novamente para continuar de onde parou.' : ''); }
function passwordChange() { document.body.className = 'edu-body'; document.body.innerHTML = '<div class="edu-login"><div><h1>Crie sua nova senha</h1><p>Por segurança, a senha provisória precisa ser alterada antes de acessar a Universidade.</p><label>Nova senha<input id="newPw" type="password" autocomplete="new-password"></label><label>Confirmar nova senha<input id="confirmPw" type="password" autocomplete="new-password"></label><button id="savePw" class="edu-primary">Salvar e continuar</button></div></div><div id="eduToast" class="edu-toast"></div>'; document.getElementById('savePw')?.addEventListener('click', async () => { const next = (document.getElementById('newPw') as HTMLInputElement).value, confirm = (document.getElementById('confirmPw') as HTMLInputElement).value; if (next.length < 8)
    return say('Use ao menos 8 caracteres.'); if (next !== confirm)
    return say('As senhas não coincidem.'); try {
    await api.post('/api/edu/password', { token: tok(), password: next });
    if (me)
        me.participant.mustChangePassword = false;
    afterAuth();
}
catch (x) {
    say(message(x));
} }); }
function login(errorText = '') { document.body.className = 'edu-body'; document.body.innerHTML = '<div class="edu-login"><div><h1>Universidade Empresarial</h1><p id="loginFeedback" class="edu-login-feedback" role="alert"></p><p id="loginHint">Use seu celular e senha ou escolha o acesso pelo Google.</p><label>E-mail ou celular<input id="id" autocomplete="username"></label><label id="pwRow">Senha<input id="pw" type="password" autocomplete="current-password"></label><button id="go" class="edu-primary">Entrar</button><button id="ad" class="edu-secondary">Entrar com Google</button></div></div>'; const input = document.getElementById('id') as HTMLInputElement, pwRow = document.getElementById('pwRow') as HTMLElement, goBtn = document.getElementById('go') as HTMLButtonElement, hint = document.getElementById('loginHint') as HTMLElement, feedback = document.getElementById('loginFeedback') as HTMLElement; const showError = (value: string) => { feedback.textContent = value; feedback.style.display = value ? 'block' : 'none'; }; showError(errorText); const update = () => { const method = loginMethod(input.value); pwRow.style.display = method === 'google' ? 'none' : 'grid'; goBtn.textContent = method === 'google' ? 'Continuar com Google' : 'Entrar'; hint.textContent = method === 'google' ? 'Use a mesma conta Google do e-mail informado.' : 'Use seu celular e a senha provisória ou pessoal enviada pelo RH.'; }; input.addEventListener('input', update); update(); let busy = false; const emailLogin = async () => { if (busy)
    return; busy = true; showError(''); const expected = input.value.trim().toLowerCase(); try {
    const signed = auth.isSignedIn() ? { user: await auth.getUser() } : await auth.signIn({ scope: 'openid email profile offline_access' });
    const selected = String(signed.user?.email || '').toLowerCase(), mismatch = expected ? accountMismatchMessage(expected, selected) : '';
    if (mismatch) {
        busy = false;
        return showError(mismatch);
    }
    await googleSession();
}
catch (x) {
    busy = false;
    showError(googleLoginError(x));
} }; goBtn.addEventListener('click', async () => { const i = input.value.trim(); if (loginMethod(i) === 'google')
    return void emailLogin(); if (busy)
    return; busy = true; showError(''); try {
    const r = await api.post('/api/edu/login', { identifier: i, password: (document.getElementById('pw') as HTMLInputElement).value });
    localStorage.setItem(S, r.data.token);
    me = { participant: r.data.participant };
    afterAuth();
}
catch (x) {
    busy = false;
    showError(message(x));
} }); document.getElementById('ad')?.addEventListener('click', emailLogin); }
async function go(x: string) { if (x === 'trilhas')
    return trilhas(); if (x === 'tarefas')
    return tarefas(); if (x === 'diagnostico')
    return diagnostico(); if (x === 'evolucao')
    return trilhas(); if (x === 'pratica')
    return practiceUi.open(); if (x === 'admin')
    return showRh(); home(); }
function learningUnits(): LearningUnit[] { return all().filter(u => CONTENT[u.id]).map(u => ({ id: u.id, title: String(u.n), competency: String(u.t), level: String(u.l) })); }
function currentAction(includePending = true) { const prepared = me?.participant.preparedLesson, preparedUnit = prepared ? learningUnits().find(unit => unit.id === prepared.unit) : undefined; if (preparedUnit) return { kind: 'continue' as const, unit: preparedUnit, label: prepared?.preparedBy === 'tutor' ? 'Aula preparada pelo tutor' : 'Continuar aula preparada', mode: 'Praticar' as const }; return getNextLearningAction({ diagnosticCompleted: !!me?.participant.diagnosticCompletedAt, units: learningUnits(), progress: me?.participant.unitProgress, recommendedLevel: me?.participant.level || undefined, completedUnits: me?.participant.completedUnits, includePending }); }
function welcome() { ui('Boas-vindas', '<section class="edu-onboarding edu-card"><small>UNIVERSIDADE EMPRESARIAL</small><h1>Aprender para trabalhar com mais segurança e autonomia</h1><p>Aqui você encontra atividades curtas de comunicação e matemática ligadas à rotina de trabalho.</p><div class="edu-callout"><b>Primeiro, vamos conhecer seu ponto de partida</b><p>A sondagem não é prova e não dá nota. São cerca de 15 perguntas, normalmente em 8 a 12 minutos, com no máximo 18 quando uma confirmação rápida for útil. Você pode pausar e continuar depois.</p></div><button id="welcomeStart" class="edu-primary">Começar sondagem</button></section>'); const button = document.getElementById('welcomeStart') as HTMLButtonElement | null; button?.addEventListener('click', diagnostico); void api.post('/api/edu/diagnostic/draft/read', { token: tok() }).then(r => { if (r.data.draft && button)
    button.textContent = 'Retomar sondagem'; }).catch(() => undefined); }
function journey() { const action = currentAction(false), levels = Object.entries(me?.participant.skillLevels || {}).slice(0, 4).map(([skill, level]) => { const stage = learningStageForLevel(level); return '<li><span>' + String(T.find(t => t[0] === skill)?.[1] || skill) + '</span><b>' + stage.label + '</b></li>'; }).join(''), estimate = sessionEstimate(action.kind); ui('Minha jornada', '<section class="edu-onboarding edu-card"><small>SEU PONTO DE PARTIDA</small><h1>Sua jornada está pronta</h1><p>Você verá três Aprendizados. O sistema faz os ajustes internos automaticamente conforme você pratica.</p>' + (levels ? '<ul class="edu-level-summary">' + levels + '</ul>' : '') + '<div class="edu-callout"><b>' + journeyHeadline({ preparedBy: me?.participant.preparedLesson?.preparedBy, kind: action.kind }) + '</b><p>' + (action.unit ? action.unit.title + ' · ' + learningStageForLevel(action.unit.level).label : 'Explore as trilhas disponíveis') + ' · ' + estimate + '</p></div><button id="journeyStart" class="edu-primary">Começar</button></section>'); document.getElementById('journeyStart')?.addEventListener('click', () => action.unit ? lesson(action.unit.id) : trilhas()); }
function home() {
    const pending = currentAction(true), action = pending.kind === 'pending_review' ? currentAction(false) : pending, target = action.unit, metrics = progressMetrics(me?.participant.unitProgress || {}), estimate = sessionEstimate(action.kind), headline = journeyHeadline({ preparedBy: me?.participant.preparedLesson?.preparedBy, kind: action.kind }), currentLevel = target?.level || me?.participant.level || 'N1', stageViews = journeyStageViews({ completedUnits: me?.participant.completedUnits, currentLevel, competencyCount: T.length });
    const pendingHtml = pending.kind === 'pending_review' ? '<p class="edu-pending-note"><b>Resposta em correção:</b> você pode continuar aprendendo normalmente enquanto o Tutor avalia sua resposta.</p>' : '';
    const stages = stageViews.map(stage => '<article class="edu-home-stage ' + stage.state + '"><div><small>' + stage.subtitle.toUpperCase() + '</small><h3>' + stage.label + '</h3></div><b>' + stage.percent + '%</b><div class="edu-progress"><i style="width:' + stage.percent + '%"></i></div></article>').join('');
    ui('Universidade Empresarial',
        '<section class="edu-hero edu-continue"><small>CONTINUE DAQUI</small><h1>Olá, ' + me?.participant.name.split(' ')[0] + '</h1><div class="edu-next-action"><span>' + action.mode + '</span><small class="edu-next-headline">' + headline + '</small><h2>' + (target ? target.title + ' · ' + learningStageForLevel(target.level).label : 'Trilhas disponíveis') + '</h2><p>' + action.label + ' · ' + estimate + '</p><button id="continueNow" class="edu-primary">' + (action.kind === 'review' ? 'Fazer revisão curta' : action.label) + '</button></div>' + pendingHtml + '</section>' +
        '<section class="edu-home-journey"><div class="edu-section-title"><h2>Sua jornada</h2><p>Três etapas, com progresso contínuo.</p></div><div class="edu-home-stages">' + stages + '</div></section>' +
        '<div class="edu-signal-grid"><article class="edu-card"><b>' + metrics.completedThisWeek + ' atividades nesta semana</b></article><article class="edu-card"><b>' + metrics.strengthened + ' competências fortalecidas</b></article><article class="edu-card"><b>' + metrics.minutes + ' minutos de aprendizagem</b></article></div>' +
        '<div class="edu-home-links"><button id="explore" class="edu-secondary">Ver trilhas e progresso</button></div>', 'inicio', 'home');
    document.getElementById('continueNow')?.addEventListener('click', () => target ? lesson(target.id) : action.kind === 'diagnostic' ? diagnostico() : trilhas());
    document.getElementById('explore')?.addEventListener('click', trilhas);
}
function trilhas() { const d = done(), next = currentAction(false), target = next.unit, currentStage = learningStageForLevel(target?.level || me?.participant.level), estimate = sessionEstimate(next.kind), stages = LEARNING_STAGES.map((stage, i) => { const completed = T.reduce((sum, track) => sum + stage.levels.filter(level => d.has(String(track[0]) + '-' + level)).length, 0), total = T.length * stage.levels.length, pct = total ? Math.round(completed / total * 100) : 0, current = currentStage.id === stage.id; return '<article class="track-level ' + (current ? 'current' : '') + '"><b>' + (i + 1) + '</b><strong>' + stage.label + '</strong><small>' + stage.subtitle + ' · ' + pct + '%</small>' + (current ? '<em>RECOMENDADO AGORA</em>' : '') + '</article>'; }).join(''), areas = AREAS.map(a => { const completed = a.skills.reduce((sum, skill) => sum + L.filter(level => d.has(skill + '-' + level)).length, 0), max = a.skills.length * 5, pct = max ? Math.round(completed / max * 100) : 0, areaTarget = target && a.skills.includes(target.competency) ? target : undefined, fallbackSkill = a.skills.find(skill => L.some(level => !d.has(skill + '-' + level))), nextSkill = areaTarget?.competency || fallbackSkill, nextTrack = T.find(track => track[0] === nextSkill), strengthened = a.skills.filter(skill => L.every(level => d.has(skill + '-' + level))).length, reviewCount = a.skills.reduce((sum, skill) => sum + L.filter(level => me?.participant.unitProgress?.[skill + '-' + level]?.status === 'review').length, 0), detail = [strengthened ? strengthened + ' fortalecida(s)' : '', reviewCount ? reviewCount + ' revisão(ões) disponível(is)' : '', nextTrack ? 'Próxima: ' + nextTrack[1] : 'Área concluída'].filter(Boolean).join(' · '); return '<button data-area="' + a.id + '" class="edu-area-card"><span class="edu-area-icon">' + a.icon + '</span><div><h2>' + a.name + '</h2><p>' + a.desc + '</p><b>' + pct + '% concluído</b><small>' + detail + '</small><div class="edu-progress"><i style="width:' + pct + '%"></i></div></div></button>'; }).join(''), nextHtml = target ? '<section class="edu-card edu-trails-next"><div><small>CONTINUE DAQUI</small><h2>' + target.title + ' · ' + learningStageForLevel(target.level).label + '</h2><p>' + next.label + ' · ' + estimate + '</p></div><button id="trailsContinue" class="edu-primary">Continuar</button></section>' : ''; ui('Trilhas e progresso', '<section class="track-levels"><div class="edu-section-title"><div><small>VISÃO GERAL</small><h2>Sua jornada em 3 aprendizados</h2></div><p>Os percentuais mostram seu avanço; o destaque indica o ponto recomendado agora.</p></div><div class="track-level-row">' + stages + '</div></section>' + nextHtml + '<h2 class="track-heading">Áreas de aprendizagem</h2><div class="edu-areas">' + areas + '</div>', 'trilhas', 'tracks'); document.getElementById('trailsContinue')?.addEventListener('click', () => target ? lesson(target.id) : home()); document.querySelectorAll<HTMLElement>('[data-area]').forEach(x => x.onclick = () => area(x.dataset.area || '')); void practiceUi.decorateProgress(); }
function area(id: string) { const a = AREAS.find(x => x.id === id) || AREAS[0], d = done(), next = currentAction(false), cards = a.skills.map(k => { const t = T.find(x => x[0] === k); if (!t) return ''; const completed = completedLevelsForSkill(d, k), pct = Math.round(completed.length / 5 * 100), recommended = me?.participant.skillLevels?.[k] || me?.participant.level || 'N1', stage = learningStageForLevel(recommended), progresses = L.map(level => me?.participant.unitProgress?.[k + '-' + level]).filter(Boolean) as UnitState[], active = progresses.find(progress => progress.status === 'pending_review') || progresses.find(progress => progress.status === 'review') || progresses.find(progress => progress.status === 'practice'), isNext = next.unit?.competency === k, state = active?.status === 'pending_review' ? 'Em correção' : active?.status === 'review' ? 'Revisão disponível' : active?.status === 'practice' ? 'Em prática' : pct >= 100 ? 'Fortalecida' : pct > 0 ? 'Em andamento' : isNext ? 'Recomendada agora' : 'Não iniciada', action = active?.status === 'pending_review' ? 'Ver percurso' : active?.status === 'review' ? 'Revisar' : pct >= 100 ? 'Revisar' : 'Continuar'; return '<article class="edu-card track-card ' + (isNext ? 'recommended' : '') + '"><i>' + t[2] + '</i><small>' + state.toUpperCase() + '</small><h3>' + t[1] + '</h3><p>' + stage.label + ' · ' + stage.subtitle + '</p><b>' + pct + '% concluído</b><div class="edu-progress"><i style="width:' + pct + '%"></i></div><button data-track="' + k + '" class="' + (isNext ? 'edu-primary' : 'edu-secondary') + '">' + action + '</button></article>'; }).join(''), completed = a.skills.reduce((sum, skill) => sum + completedLevelsForSkill(d, skill).length, 0), max = a.skills.length * 5, pct = max ? Math.round(completed / max * 100) : 0, nextTrack = next.unit && a.skills.includes(next.unit.competency) ? T.find(track => track[0] === next.unit?.competency) : undefined, guideTitle = nextTrack ? 'Seu próximo passo está definido' : pct >= 100 ? 'Área fortalecida' : 'Avance no seu ritmo', guideText = nextTrack ? 'Continue por ' + nextTrack[1] + '. Sessões curtas ajudam a manter a continuidade sem sobrecarregar.' : pct >= 100 ? 'Você concluiu as etapas previstas nesta área. As revisões aparecerão no momento adequado.' : 'Escolha uma capacitação abaixo. O sistema recomenda o melhor ponto de entrada para você.'; ui(a.name + ' · Progresso', '<section class="edu-area-hero"><div class="edu-area-hero-main"><button id="backAreas" class="edu-back">← Trilhas e progresso</button><small>ÁREA DE CAPACITAÇÃO</small><h1>' + a.icon + ' ' + a.name + '</h1><p>' + a.desc + '</p><div class="edu-area-summary"><b>Progresso da área: ' + pct + '%</b><div class="edu-progress"><i style="width:' + pct + '%"></i></div></div></div><aside class="edu-mh-guide"><div class="edu-mh-mascot" aria-hidden="true"><span class="edu-mh-helmet"></span><span class="edu-mh-face"></span><b>MH</b></div><div class="edu-mh-bubble"><small>GUIA MH</small><strong>' + guideTitle + '</strong><p>' + guideText + '</p></div></aside></section><div class="edu-area-competencies">' + cards + '</div>', 'trilhas'); document.getElementById('backAreas')?.addEventListener('click', trilhas); document.querySelectorAll<HTMLElement>('[data-track]').forEach(x => x.onclick = () => trackPicker(x.dataset.track || '')); }
function trackPicker(id: string) { const t = T.find(x => x[0] === id) || T[0], parentArea = AREAS.find(a => a.skills.includes(String(t[0])))?.id || 'comunicacao', completed = completedLevelsForSkill(done(), id), recommended = me?.participant.skillLevels?.[id] || me?.participant.level || 'N1', recommendedStage = learningStageForLevel(recommended).id; const cards = LEARNING_STAGES.map((stage, i) => { const pct = learningStageProgress(stage, completed), target = learningStageTargetLevel(stage, completed, recommended), current = recommendedStage === stage.id, action = pct === 100 ? 'Revisar' : current ? 'Continuar' : 'Abrir'; return '<article class="edu-card level-card"><span class="level-badge">' + (i + 1) + '</span><small>' + (current ? 'RECOMENDADO' : pct === 100 ? 'CONCLUÍDO' : 'DISPONÍVEL') + '</small><h3>' + stage.label + '</h3><p><b>' + stage.subtitle + '</b><br>' + stage.description + '</p><div class="edu-progress"><i style="width:' + pct + '%"></i></div><p><small>' + pct + '% concluído</small></p><div class="level-actions"><button data-u="' + id + '-' + target + '" class="' + (current ? 'edu-primary' : 'edu-secondary') + '">' + action + '</button></div></article>'; }).join(''); ui(t[1] + ' · aprendizados', '<div class="edu-page-head"><button id="backArea" class="edu-back">← Voltar à área</button><small>JORNADA DE APRENDIZAGEM</small><h1>' + t[2] + ' ' + t[1] + '</h1><p>Avance em três etapas: Fundamentos, Aplicação e Autonomia. O sistema mantém a progressão interna e recomenda o melhor ponto de entrada para você.</p></div><div class="level-grid">' + cards + '</div>', 'trilhas'); document.getElementById('backArea')?.addEventListener('click', () => area(parentArea)); document.querySelectorAll<HTMLElement>('[data-u]').forEach(x => x.onclick = () => lesson(x.dataset.u || '')); }
async function lesson(id: string) {
    const unit = all().find(x => x.id === id);
    if (!unit) return trilhas();
    const base = CONTENT[id];
    if (!base) return trackPicker(unit.t);
    const learningStage = learningStageForLevel(unit.l);
    const access = lessonAccessViewModel(me?.participant.unitProgress?.[id]?.status);
    if (access.readOnly) {
        const feedback = access.feedback!;
        ui(unit.n + ' · ' + learningStage.label, '<article class="edu-card edu-result" tabindex="-1"><h1>' + feedback.title + '</h1><p>' + feedback.body + '</p><div class="level-actions"><button id="pendingNext" class="edu-primary">Próxima atividade</button><button id="pendingHome" class="edu-secondary">Voltar à jornada</button></div></article>', 'inicio');
        document.getElementById('pendingNext')?.addEventListener('click', tarefas);
        document.getElementById('pendingHome')?.addEventListener('click', home);
        return;
    }
    ui(unit.n + ' · ' + learningStage.label, '<article class="edu-card"><h1>Preparando sua aula…</h1><p>Buscando a composição salva desta tentativa.</p></article>', 'trilhas');
    let attempt: { id: string; seed: number; selectionVersion?: number; mode?: 'lesson'|'review'; questionIds: string[]; reinforcementQuestionIds: string[]; answeredQuestionIds?: string[]; responses?: Array<{questionId:string;response:string;correct:boolean|null;source:'learner'|'tutor-paper';attempts:number;errors:number;firstTryCorrect:boolean|null}> };
    try {
        attempt = (await api.post('/api/edu/attempt/open', { token: tok(), unit: id })).data.attempt;
    } catch (error) { say(message(error)); return trackPicker(unit.t); }
    let composition = buildLessonComposition(id, attempt.seed, attempt.selectionVersion || 1);
    const reviewMode = attempt.mode === 'review';
    if (!reviewMode && !attempt.questionIds?.length) {
        try { attempt = (await api.post('/api/edu/attempt/freeze', { token: tok(), attemptId: attempt.id, questionIds: composition.questionIds, reinforcementQuestionIds: composition.reinforcementQuestionIds })).data.attempt; }
        catch (error) { say(message(error)); return trackPicker(unit.t); }
    }
    if (!reviewMode && (attempt.questionIds.join('|') !== composition.questionIds.join('|') || attempt.reinforcementQuestionIds.join('|') !== composition.reinforcementQuestionIds.join('|'))) {
        say('A composição salva desta aula não corresponde à versão atual.');
        return trackPicker(unit.t);
    }
    const reviewOnly = reviewMode ? questionsByIds(composition, attempt.questionIds) : [], mainQuestions = reviewMode ? [] : composition.mainQuestions, reviewQuestions = reviewMode ? reviewOnly : composition.reviewQuestions, reinforcementQuestions = reviewMode ? [] : composition.reinforcementQuestions, levelNumber = composition.levelNumber, closesStage = reviewMode ? false : composition.closesStage;
    if (reviewMode && reviewOnly.length !== attempt.questionIds.length) { say('Não foi possível recuperar o plano de revisão.'); return trackPicker(unit.t); }
    const teaching = buildTeachingSequence(id, base);
    const blocks = reviewMode
        ? [{ id: 'review', title: 'Revisão do ' + learningStage.label, subtitle: 'Revisar', teaching: { ...teaching.part2, eyebrow: 'REVISÃO ESPAÇADA', title: 'Relembre e aplique', body: 'Esta revisão é curta e prioriza pontos que merecem novo contato. Resolva sem pressa e confira o raciocínio.', check: 'São poucas questões selecionadas a partir do seu histórico.' }, questions: reviewOnly }]
        : [
            { id: 'part1', title: learningStage.label + ' · Parte 1', subtitle: 'Entender', teaching: teaching.part1, questions: mainQuestions.slice(0, 3) },
            { id: 'part2', title: learningStage.label + ' · Parte 2', subtitle: 'Praticar', teaching: teaching.part2, questions: mainQuestions.slice(3, 9) },
            ...(closesStage ? [{ id: 'review', title: levelNumber === 5 ? 'Aplicação e consolidação' : 'Fechamento do ' + learningStage.label, subtitle: 'Revisar', teaching: { ...teaching.part2, eyebrow: 'FECHAMENTO', title: levelNumber === 5 ? 'Aplicação e consolidação' : 'Revise antes de avançar', body: 'Retome os pontos centrais das etapas anteriores. Resolva as questões misturadas usando o mesmo processo: localizar dados, escolher a estratégia, responder e conferir.', check: 'Use o fechamento para verificar o que já consegue fazer com autonomia.' }, questions: reviewQuestions }] : []),
        ];
    const allQuestions = blocks.flatMap(block => block.questions);
    if (reviewMode ? allQuestions.length < 3 || allQuestions.length > 5 : blocks[0].questions.length !== 3 || blocks[1].questions.length !== 6 || closesStage && composition.reviewQuestions.length !== 4 || reinforcementQuestions.length !== 3) {
        say('Não foi possível montar esta atividade agora.');
        return trackPicker(unit.t);
    }
    let blockIndex = 0, questionIndex = 0, startedAt = Date.now(), attempts = 0, errors = 0;
    const openResponses: Array<{ question: string; response: string; itemIndex: number }> = [];
    const itemAttempts = Array(allQuestions.length).fill(0) as number[];
    const itemErrors = Array(allQuestions.length).fill(0) as number[];
    const firstTryResults = Array(allQuestions.length).fill(undefined) as FirstTryResult[];
    const checkpoints: LessonCheckpoint[] = [];
    let reinforcementIndex = 0, reinforcementAttempts = 0, reinforcementErrors = 0;
    const reinforcementFirstTry = Array(reinforcementQuestions.length).fill(undefined) as FirstTryResult[];
    let reinforcementCompleted = false;
    const persistedResponses = new Map((attempt.responses || []).map(response => [response.questionId, response]));
    allQuestions.forEach((item, index) => { const saved = item.meta?.id ? persistedResponses.get(item.meta.id) : undefined; if (!saved) return; itemAttempts[index] = saved.attempts; itemErrors[index] = saved.errors; firstTryResults[index] = saved.firstTryCorrect; attempts += saved.attempts; errors += saved.errors; if (item.kind === 'text') openResponses[index] = { question: item.prompt, response: saved.response, itemIndex: index }; });
    reinforcementQuestions.forEach((item, index) => { const saved = item.meta?.id ? persistedResponses.get(item.meta.id) : undefined; if (!saved) return; reinforcementFirstTry[index] = saved.firstTryCorrect; reinforcementAttempts += saved.attempts; reinforcementErrors += saved.errors; });
    const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
    const status = me?.participant.unitProgress?.[id]?.status;
    const mode = reviewMode ? 'Revisar' : status === 'review' ? 'Revisar' : status === 'practice' ? 'Praticar' : 'Aprender';
    const globalIndex = () => blocks.slice(0, blockIndex).reduce((sum, block) => sum + block.questions.length, 0) + questionIndex;
    const showInline = (feedback: { title: string; body: string; hint: string; action: string; tone: string }, action: () => void) => {
        const region = document.getElementById('lessonFeedback');
        if (!region) return;
        region.className = 'edu-inline-feedback ' + feedback.tone;
        region.innerHTML = '<h3>' + esc(feedback.title) + '</h3><p>' + esc(feedback.body) + '</p>' + (feedback.hint ? '<p><b>Dica:</b> ' + esc(feedback.hint) + '</p>' : '') + '<button id="feedbackAction" class="edu-primary">' + esc(feedback.action) + '</button>';
        region.hidden = false;
        region.focus();
        document.getElementById('answerAction')?.setAttribute('disabled', 'true');
        document.getElementById('feedbackAction')?.addEventListener('click', action);
    };
    const finish = async () => {
        try {
            const saved = await api.post('/api/edu/unit', {
                token: tok(), unit: id, attemptId: attempt.id, attempts, correct: allQuestions.length, errors, hints: errors, expectedItems: allQuestions.length,
                durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
                questionStats: itemAttempts.map((count, index) => ({ attempts: count, errors: itemErrors[index] })),
                checkpoints,
                reinforcement: { attempts: reinforcementAttempts, errors: reinforcementErrors, completed: reinforcementCompleted },
                openResponses,
            });
            me = { participant: { ...me!.participant, completedUnits: saved.data.completedUnits || [], unitProgress: saved.data.unitProgress || {}, skillLevels: saved.data.skillLevels || me!.participant.skillLevels, skillConfidence: saved.data.skillConfidence || me!.participant.skillConfidence, preparedLesson: saved.data.preparedLesson || null } };
            const feedback = lessonFeedbackViewModel(saved.data.status === 'pending_review' ? 'pending_review' : saved.data.consolidated ? 'completed' : 'practice');
            const nextLevel = saved.data.consolidated ? (unit.l === 'N1' ? 'N2' : unit.l === 'N3' ? 'N4' : '') : '';
            ui(feedback.title, '<article class="edu-card edu-result" tabindex="-1"><h1>' + feedback.title + '</h1><p>' + feedback.body + '</p><div class="level-actions"><button id="resultNext" class="edu-primary">' + (nextLevel ? 'Continuar ' + learningStage.label : 'Voltar à jornada') + '</button><button id="resultHome" class="edu-secondary">Ir para o início</button></div></article>', 'inicio');
            document.querySelector<HTMLElement>('.edu-result')?.focus();
            document.getElementById('resultNext')?.addEventListener('click', () => nextLevel ? lesson(unit.t + '-' + nextLevel) : home());
            document.getElementById('resultHome')?.addEventListener('click', home);
        } catch (error) {
            showInline({ title: 'Não foi possível salvar', body: message(error), hint: 'Sua resposta continua nesta tela.', action: 'Tentar novamente', tone: 'error' }, () => void finish());
        }
    };
    const upsertCheckpoint = (checkpoint: LessonCheckpoint) => {
        const found = checkpoints.findIndex(item => item.block === checkpoint.block);
        if (found >= 0) checkpoints[found] = checkpoint; else checkpoints.push(checkpoint);
    };
    const continueAfterBlock = () => {
        if (blockIndex < blocks.length - 1) { blockIndex++; questionIndex = 0; renderSupport(); return; }
        void finish();
    };
    const renderCheckpointSummary = (checkpoint: LessonCheckpoint, next: () => void) => {
        const label = checkpointLabel(checkpoint);
        ui(unit.n + ' · ' + learningStage.label, '<article class="edu-card edu-lesson-card edu-checkpoint"><small>CHECKPOINT</small><h1>' + esc(label.title) + '</h1><p>' + esc(label.body) + '</p><div class="edu-checkpoint-metric"><b>' + (checkpoint.accuracy === null ? 'Resposta registrada' : checkpoint.firstTryCorrect + ' de ' + checkpoint.graded + ' objetivas na primeira tentativa') + '</b></div><button id="checkpointNext" class="edu-primary">Continuar</button></article>', 'trilhas');
        document.getElementById('checkpointNext')?.addEventListener('click', next);
    };
    const renderReinforcementSupport = () => {
        const card = teaching.reinforcement;
        ui(unit.n + ' · ' + learningStage.label, '<article class="edu-card edu-lesson-card edu-reinforcement"><small class="edu-teaching-eyebrow">' + esc(card.eyebrow) + '</small><h1>' + esc(card.title) + '</h1><p>' + esc(card.body) + '</p><div class="edu-example"><b>Exemplo</b><p>' + esc(card.example) + '</p></div><p class="edu-teaching-check">' + esc(card.check) + '</p><div class="edu-callout"><b>Reforço adaptado</b><p>Você receberá 3 questões extras. Elas não apagam suas respostas anteriores.</p></div><button id="startReinforcement" class="edu-primary">Fazer reforço</button></article>', 'trilhas');
        document.getElementById('startReinforcement')?.addEventListener('click', renderReinforcementQuestion);
    };
    const finishReinforcement = () => {
        reinforcementCompleted = true;
        upsertCheckpoint(checkpointEvidence('reinforcement', reinforcementFirstTry, true));
        blockIndex = 1;
        questionIndex = 0;
        renderSupport();
    };
    const renderReinforcementQuestion = () => {
        const item = reinforcementQuestions[reinforcementIndex], support = selectSupportExcerpt({ material: SUPPORT_MATERIALS.jovensAdultos || '', competency: unit.t, level: unit.l, topic: String((item as { topic?: string }).topic || unit.n), maxEssential: 420, maxComplementary: 320 });
        const controls = item.kind === 'short-text'
            ? '<label for="eduAnswer">Sua resposta<input id="eduAnswer" class="edu-text-input" autocomplete="off"></label>'
            : '<fieldset class="edu-options"><legend>Escolha uma alternativa</legend>' + (item.options || []).map(option => '<label class="edu-option"><input name="edu-answer" type="radio" value="' + esc(option) + '"><span>' + esc(option) + '</span></label>').join('') + '</fieldset>';
        ui(unit.n + ' · reforço', '<div class="edu-page-head compact"><small>REFORÇO RÁPIDO · Questão ' + (reinforcementIndex + 1) + ' de ' + reinforcementQuestions.length + '</small><div class="edu-step-progress"><i style="width:' + ((reinforcementIndex + 1) / reinforcementQuestions.length * 100) + '%"></i></div></div><article class="edu-card edu-lesson-card"><div class="edu-question-support"><small>APOIO PARA ESTA QUESTÃO</small><p>' + esc(support.essential).replace(/\n/g, '<br>') + '</p>' + (support.complementary ? '<p class="edu-question-support-extra">' + esc(support.complementary).replace(/\n/g, '<br>') + '</p>' : '') + '</div><h2>' + esc(item.prompt) + '</h2>' + controls + '<div id="lessonFeedback" class="edu-inline-feedback" role="status" aria-live="polite" tabindex="-1" hidden></div><button id="answerAction" class="edu-primary edu-answer-action">Verificar resposta</button></article>', 'trilhas');
        document.getElementById('answerAction')?.addEventListener('click', async () => {
            const radio = document.querySelector('input[name="edu-answer"]:checked') as HTMLInputElement | null, typed = document.getElementById('eduAnswer') as HTMLInputElement | null, value = (radio?.value || typed?.value || '').trim(), evaluation = evaluateLessonAnswer(item, value);
            if (!evaluation.valid) return showInline({ title: 'Complete sua resposta', body: 'Selecione ou escreva uma resposta.', hint: '', action: 'Tentar novamente', tone: 'error' }, renderReinforcementQuestion);
            if (reinforcementFirstTry[reinforcementIndex] === undefined) {
                try { attempt = (await api.post('/api/edu/attempt/respond', { token: tok(), attemptId: attempt.id, questionId: item.meta?.id, response: value, correct: evaluation.correct })).data.attempt; } catch (error) { say(message(error)); return; }
                reinforcementFirstTry[reinforcementIndex] = evaluation.correct;
            }
            reinforcementAttempts++;
            if (evaluation.correct === false) reinforcementErrors++;
            const feedback = lessonAttemptFeedback({ correct: evaluation.correct, hint: item.hint, objective: base.objective });
            showInline(feedback, evaluation.correct === false ? renderReinforcementQuestion : () => {
                if (reinforcementIndex < reinforcementQuestions.length - 1) { reinforcementIndex++; renderReinforcementQuestion(); } else finishReinforcement();
            });
        });
    };
    const advance = () => {
        const block = blocks[blockIndex];
        if (questionIndex < block.questions.length - 1) { questionIndex++; renderQuestion(); return; }
        const start = blocks.slice(0, blockIndex).reduce((sum, current) => sum + current.questions.length, 0), checkpoint = checkpointEvidence(block.id as LessonCheckpoint['block'], firstTryResults.slice(start, start + block.questions.length), reinforcementCompleted);
        upsertCheckpoint(checkpoint);
        if (block.id === 'part1' && shouldReinforce(checkpoint) && !reinforcementCompleted) { renderReinforcementSupport(); return; }
        if (block.id === 'part2') { renderCheckpointSummary(checkpoint, continueAfterBlock); return; }
        continueAfterBlock();
    };
    const renderSupport = () => {
        const block = blocks[blockIndex], deepSupport = selectSupportExcerpt({ material: SUPPORT_MATERIALS.jovensAdultos || '', competency: unit.t, level: unit.l, topic: base.objective, maxEssential: 900, maxComplementary: 1400 }), teachingCard = block.teaching;
        ui(unit.n + ' · ' + learningStage.label, '<div class="edu-page-head compact"><button id="backLevel" class="edu-back">← Voltar</button><small>' + mode.toUpperCase() + ' · Bloco ' + (blockIndex + 1) + ' de ' + blocks.length + '</small></div><article class="edu-card edu-lesson-card edu-block-support"><span class="edu-mode">' + esc(block.subtitle) + '</span><small class="edu-teaching-eyebrow">' + esc(teachingCard.eyebrow) + '</small><h1>' + esc(block.title) + '</h1><h2>' + esc(teachingCard.title) + '</h2><p>' + esc(teachingCard.body) + '</p><div class="edu-example"><b>Exemplo / atenção</b><p>' + esc(teachingCard.example) + '</p></div><p class="edu-teaching-check"><b>Antes de praticar:</b> ' + esc(teachingCard.check) + '</p><details class="edu-support-details"><summary>Ver material de apoio completo</summary><div class="edu-material"><p>' + esc(deepSupport.essential).replace(/\n/g, '<br>') + '</p>' + (deepSupport.complementary ? '<p>' + esc(deepSupport.complementary).replace(/\n/g, '<br>') + '</p>' : '') + '</div></details><div class="edu-callout"><b>Próxima etapa</b><p>' + block.questions.length + ' questões curtas para praticar este conteúdo.</p></div><button id="startBlock" class="edu-primary">Começar ' + block.questions.length + ' questões</button></article>', 'trilhas');
        document.getElementById('backLevel')?.addEventListener('click', () => trackPicker(unit.t));
        document.getElementById('startBlock')?.addEventListener('click', renderQuestion);
    };
    const renderQuestion = () => {
        const block = blocks[blockIndex], item = block.questions[questionIndex], index = globalIndex(), topic = String((item as { topic?: string }).topic || unit.n);
        const support = selectSupportExcerpt({ material: SUPPORT_MATERIALS.jovensAdultos || '', competency: unit.t, level: unit.l, topic, maxEssential: 420, maxComplementary: 320 });
        const controls = item.kind === 'text' || item.kind === 'short-text'
            ? '<label for="eduAnswer">Sua resposta<input id="eduAnswer" class="edu-text-input" autocomplete="off"></label>'
            : '<fieldset class="edu-options"><legend>Escolha uma alternativa</legend>' + (item.options || []).map(option => '<label class="edu-option"><input name="edu-answer" type="radio" value="' + esc(option) + '"><span>' + esc(option) + '</span></label>').join('') + '</fieldset>';
        const visual = hasQuestionVisual(item.prompt) ? '<figure class="edu-question-visual" data-question-visual data-question-prompt="' + esc(item.prompt) + '"><span class="edu-question-visual-loading">Carregando imagem de apoio…</span></figure>' : '';
        ui(unit.n + ' · ' + learningStage.label,
            '<div class="edu-page-head compact"><button id="backLevel" class="edu-back">← Voltar</button><small>' + esc(block.title.toUpperCase()) + ' · Questão ' + (questionIndex + 1) + ' de ' + block.questions.length + '</small><div class="edu-step-progress" aria-label="' + (questionIndex + 1) + ' de ' + block.questions.length + '"><i style="width:' + ((questionIndex + 1) / block.questions.length * 100) + '%"></i></div></div>' +
            '<article class="edu-card edu-lesson-card"><span class="edu-mode">' + mode + '</span><div class="edu-question-support"><small>APOIO PARA ESTA QUESTÃO</small><p>' + esc(support.essential).replace(/\n/g, '<br>') + '</p>' + (support.complementary ? '<p class="edu-question-support-extra">' + esc(support.complementary).replace(/\n/g, '<br>') + '</p>' : '') + '</div>' + visual + '<h2>' + esc(item.prompt) + '</h2>' + controls + '<div id="lessonFeedback" class="edu-inline-feedback" role="status" aria-live="polite" tabindex="-1" hidden></div><button id="answerAction" class="edu-primary edu-answer-action">Verificar resposta</button></article>', 'trilhas');
        document.getElementById('backLevel')?.addEventListener('click', () => trackPicker(unit.t));
        document.getElementById('answerAction')?.addEventListener('click', async () => {
            const radio = document.querySelector('input[name="edu-answer"]:checked') as HTMLInputElement | null;
            const typed = document.getElementById('eduAnswer') as HTMLInputElement | null;
            const value = (radio?.value || typed?.value || '').trim();
            const evaluation = evaluateLessonAnswer(item, value);
            if (!evaluation.valid) {
                showInline({ title: 'Complete sua resposta', body: item.kind === 'text' && item.minLength ? 'Escreva ao menos ' + item.minLength + ' caracteres.' : 'Selecione ou escreva uma resposta.', hint: '', action: 'Tentar novamente', tone: 'error' }, renderQuestion);
                return;
            }
            if (itemAttempts[index] === 0) {
                try { attempt = (await api.post('/api/edu/attempt/respond', { token: tok(), attemptId: attempt.id, questionId: item.meta?.id, response: value, correct: evaluation.correct })).data.attempt; } catch (error) { say(message(error)); return; }
                firstTryResults[index] = evaluation.correct;
            }
            attempts++;
            itemAttempts[index]++;
            if (item.kind === 'text') openResponses[index] = { question: String(item.prompt || ''), response: value, itemIndex: index };
            if (evaluation.correct === false) {
                errors++;
                itemErrors[index]++;
            }
            const feedback = lessonAttemptFeedback({ correct: evaluation.correct, hint: item.hint, objective: base.objective });
            showInline(feedback, evaluation.correct === false ? renderQuestion : advance);
        });
    };
    renderSupport();
}
function tarefas() { const x = all().filter(u => CONTENT[u.id]), d = done(), up = me?.participant.unitProgress || {}, now = Date.now(), skillLevels = me?.participant.skillLevels || {}, fallbackLevel = me?.participant.level || 'N1', nov = x.find(u => !d.has(u.id) && u.l === (skillLevels[u.t] || fallbackLevel)) || x.find(u => !d.has(u.id)) || x[0], due = x.find(u => { const p = up[u.id]; return p && (p.status === 'review' || (p.nextReviewAt && Date.parse(p.nextReviewAt) <= now)); }), rev = due || x.find(u => d.has(u.id)) || nov, label = (id: string) => { const p = up[id]; if (!p)
    return 'Não iniciado'; if (p.status === 'pending_review')
    return 'Aguardando correção'; if (p.status === 'review' || (p.nextReviewAt && Date.parse(p.nextReviewAt) <= now))
    return 'Revisar'; if (p.status === 'consolidated')
    return 'Consolidado'; return 'Em prática'; }, schedule = (id: string) => { const p = up[id]; if (!p?.nextReviewAt)
    return 'a programar'; const days = Math.max(0, Math.ceil((Date.parse(p.nextReviewAt) - now) / 86400000)); return days <= 0 ? 'disponível agora' : 'em ' + days + ' dia(s)'; }; ui('Tarefas diárias', '<div class="edu-page-head"><h1>Prática diária</h1><p>Faça uma sessão curta por vez. A atividade nova ensina e pratica; a revisão recupera poucos pontos importantes no momento certo.</p></div><div class="edu-grid two"><article class="edu-card"><small>NOVA · ' + label(nov.id) + '</small><h2>' + nov.n + ' · ' + learningStageForLevel(nov.l).label + '</h2><p>' + nov.t + '</p><button data-u="' + nov.id + '" class="edu-primary">Fazer agora</button></article><article class="edu-card"><small>REVISÃO · ' + label(rev.id) + '</small><h2>' + rev.n + ' · ' + learningStageForLevel(rev.l).label + '</h2><p>' + rev.t + '</p><p><b>Próxima revisão:</b> ' + schedule(rev.id) + '</p><button data-u="' + rev.id + '" class="edu-secondary">Revisar</button></article></div><article class="edu-card"><h2>Estados de aprendizagem</h2><p><b>Não iniciado</b> · <b>Em prática</b> · <b>Aguardando correção</b> · <b>Consolidado</b> · <b>Revisar</b></p><p>As revisões usam 3 a 5 questões e seguem intervalos progressivos de 1, 3, 7, 14 e 30 dias. Pontos de dificuldade voltam primeiro.</p></article>', 'tarefas'); document.querySelectorAll<HTMLElement>('[data-u]').forEach(x => x.onclick = () => lesson(x.dataset.u || '')); }
async function diagnostico() {
    const flow = await import('./diagnostic-flow');
    let state = flow.diagnosticInitialState();
    const esc = (v: string) => v.replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x] || x));
    const save = async (next = state) => { const draft = flow.diagnosticDraftPayload(next); if (!draft) throw new Error('O estado da sondagem é inválido.'); await api.post('/api/edu/diagnostic/draft/save', { token: tok(), draft }); };
    const showResult = (skillLevels: Record<string, string>) => {
        const summaries = flow.diagnosticAreaSummary(skillLevels);
        ui('Sondagem concluída', '<section class="edu-card edu-onboarding"><small>SEU PONTO DE PARTIDA</small><h1>Sondagem concluída</h1><p>Este resultado é um ponto de partida, não um rótulo. As próprias aulas podem ajustar suas recomendações conforme seu desempenho.</p><div class="edu-signal-grid">' + summaries.map(x => '<article class="edu-card"><small>' + esc(x.title.toUpperCase()) + '</small><h2>' + esc(x.label) + '</h2></article>').join('') + '</div><button id="diagnosticContinue" class="edu-primary">Começar minha jornada</button></section>', 'diagnostico');
        document.getElementById('diagnosticContinue')?.addEventListener('click', () => void mount());
    };
    const submit = async (next: typeof state) => {
        try {
            const assignments = flow.diagnosticAssignments(next);
            const result = await api.post('/api/edu/diagnostic', { token: tok(), context: { instrument: 'Sondagem rápida V2', references: '15 questões-âncora + até 3 confirmações', questionCount: String(Object.keys(next.responses).length) }, answers: assignments });
            showResult(result.data.result?.skillLevels || assignments);
        } catch (error) {
            ui('Concluir sondagem', '<article class="edu-card"><h1>Sua sondagem está pronta</h1><p>Não foi possível concluir o envio agora. Suas respostas continuam salvas.</p><button id="retryDiagnosticSubmit" class="edu-primary">Tentar concluir novamente</button></article>', 'diagnostico');
            document.getElementById('retryDiagnosticSubmit')?.addEventListener('click', () => void submit(next));
            say(message(error));
        }
    };
    const render = () => {
        if (flow.diagnosticIsComplete(state)) return void submit(state);
        const item = flow.currentDiagnosticItem(state);
        if (!item) return void submit(state);
        const progress = flow.diagnosticProgress(state);
        const control = item.kind === 'choice'
            ? (item.options || []).map(option => '<label class="edu-option"><input required type="radio" name="diagnosticAnswer" value="' + esc(option) + '"><span>' + esc(option) + '</span></label>').join('')
            : '<label for="diagnosticAnswer">Sua resposta<textarea id="diagnosticAnswer" required placeholder="Escreva uma resposta curta"></textarea></label>';
        ui('Sondagem inicial', '<form id="quickDiagnostic" class="edu-card edu-quiz"><div class="edu-page-head compact"><small>' + esc(item.areaLabel.toUpperCase()) + '</small><h1>Sondagem rápida</h1><p>' + esc(progress.label) + '</p><div class="edu-step-progress" aria-label="' + esc(progress.label) + '"><i style="width:' + progress.percentage + '%"></i></div></div><h2>' + esc(item.prompt) + '</h2>' + control + '<button class="edu-primary">Responder</button><button id="pauseDiagnostic" type="button" class="edu-secondary">Pausar e continuar depois</button><p><small>Não é necessário acertar tudo. As respostas servem apenas para escolher um bom ponto de partida.</small></p></form>', 'diagnostico');
        document.getElementById('pauseDiagnostic')?.addEventListener('click', async () => { try { await save(state); home(); } catch { say('Não foi possível guardar sua pausa. Tente novamente antes de sair.'); } });
        document.getElementById('quickDiagnostic')?.addEventListener('submit', async ev => {
            ev.preventDefault();
            const form = ev.currentTarget as HTMLFormElement, radio = form.querySelector('input[name="diagnosticAnswer"]:checked') as HTMLInputElement | null, typed = form.querySelector('#diagnosticAnswer') as HTMLTextAreaElement | null, value = (radio?.value || typed?.value || '').trim();
            if (!value) return say('Responda para continuar.');
            const next = flow.recordDiagnosticResponse(state, value);
            try {
                await save(next);
                state = next;
                if (flow.diagnosticIsComplete(state)) return void submit(state);
                render();
            } catch {
                say('Não foi possível salvar seu avanço. Tente responder novamente.');
            }
        });
    };
    const load = async () => {
        ui('Sondagem inicial', '<article class="edu-card"><h1>Retomando sua sondagem…</h1><p>Estamos buscando o ponto em que você parou.</p></article>', 'diagnostico');
        try {
            const response = await api.post('/api/edu/diagnostic/draft/read', { token: tok() });
            const legacy = flow.isLegacyDiagnosticDraft(response.data.draft);
            state = flow.applyLoadedDiagnosticDraft(flow.diagnosticInitialState(), response.data.draft);
            if (legacy) say('A sondagem foi atualizada para um formato mais curto.');
            if (flow.diagnosticIsComplete(state)) return void submit(state);
            render();
        } catch {
            ui('Sondagem inicial', '<article class="edu-card"><h1>Não foi possível retomar sua sondagem</h1><p>Seu progresso não foi alterado. Verifique sua conexão e tente novamente.</p><button id="retryDiagnostic" class="edu-primary">Tentar novamente</button></article>', 'diagnostico');
            document.getElementById('retryDiagnostic')?.addEventListener('click', () => void load());
        }
    };
    await load();
}
function evolucao() {
    const progress = me?.participant.unitProgress || {}, action = currentAction(false);
    const rows = T.map(track => {
        const completed = L.filter(level => done().has(track[0] + '-' + level)).length;
        const state = progress[track[0] + '-N1'];
        const summary = competencySummary({ name: String(track[1]), completed, status: state?.status, hasActivity: !!state });
        const level = me?.participant.skillLevels?.[track[0]] || 'N1', stage = learningStageForLevel(level), pct = Math.round(completed / 5 * 100);
        return '<article class="edu-progress-summary"><h3>' + summary.phrase + '</h3><p>' + summary.label + '</p><details><summary>Ver detalhes</summary><p>' + pct + '% da competência concluída · ' + stage.label + ' · ' + stage.subtitle + '</p></details></article>';
    }).join('');
    ui('Meu desenvolvimento',
        '<section class="edu-card edu-development-head"><small>SEU DESENVOLVIMENTO</small><h1>' + (done().size ? 'Você já concluiu ' + done().size + ' unidades.' : 'Sua jornada está começando.') + '</h1><p>Próxima ação: <b>' + action.label + '</b></p><button id="developmentNext" class="edu-primary">Continuar minha jornada</button></section>' +
        '<section class="edu-development-list">' + rows + '</section>' +
        '<article class="edu-card"><h2>O que significam os estados?</h2><p><b>Começando:</b> primeira atividade. <b>Aprendendo:</b> conteúdo em andamento. <b>Revisando:</b> contato curto programado. <b>Fortalecido:</b> conteúdo concluído. <b>Em correção:</b> resposta aberta enviada ao Tutor.</p><button id="redoDiagnostic" class="edu-secondary">Fazer nova sondagem</button><p><small>Use esta opção para atualizar seu ponto de partida. As conclusões já registradas permanecem.</small></p></article>', 'evolucao');
    document.getElementById('developmentNext')?.addEventListener('click', () => action.unit ? lesson(action.unit.id) : action.kind === 'diagnostic' ? diagnostico() : trilhas());
    document.getElementById('redoDiagnostic')?.addEventListener('click', diagnostico);
}
function rhLoading(){ui('Tutor','<article class="edu-card"><h1>Carregando Tutor…</h1><p>Aguarde enquanto carregamos o acompanhamento dos colaboradores.</p></article>','admin')}
function rhFailure(x:unknown){const detail=adminFailureDetail(x);ui('Tutor','<article class="edu-card"><h1>Não foi possível abrir o Tutor</h1><p>'+detail+'</p><button id="retryRh" class="edu-primary">Tentar novamente</button></article>','admin');document.getElementById('retryRh')?.addEventListener('click',()=>void showRh())}
async function showRh(){rhLoading();try{await rh()}catch(x){rhFailure(x)}}
async function tutorParticipant(participantId:string){
 if(!admin())return home();
 const data=(await api.post('/api/edu/admin/participant',{token:tok(),participantId})).data,person=data.participant;
 const esc=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));
 const tutorUnits=all().filter(unit=>CONTENT[unit.id]).map(unit=>({id:unit.id,competency:unit.t,level:unit.l,title:unit.n})),next=nextTutorUnit(person,tutorUnits);
 const competencies=T.map(track=>{const level=person.skillLevels?.[track[0]]||'N1',confidence=Math.round(Number(person.skillConfidence?.[track[0]]||.55)*100),stage=learningStageForLevel(level);return'<article class="edu-tutor-skill"><b>'+esc(String(track[1]))+'</b><span>'+stage.label+'</span><small>'+esc(level)+' interno · confiança '+confidence+'%</small></article>'}).join('');
 const attempts=(data.lessonAttempts||[]) as Array<{id:string;unit:string;seed:number;questionIds:string[];reinforcementQuestionIds:string[];responseCount:number;status:string;preparedBy:string;createdAt:string;completedAt?:string;rerollCount:number}>,active=attempts.find(item=>item.status!=='completed'),history=attempts.filter(item=>item.status==='completed').slice(0,8);
 let preparedHtml='<p>Nenhuma aula preparada.</p>';
 if(active){let preview='';try{const composition=buildLessonComposition(active.unit,active.seed,active.selectionVersion||1);preview='<details><summary>Ver questões preparadas</summary><ol>'+[...composition.mainQuestions,...composition.reviewQuestions].map(item=>'<li>'+esc(item.prompt)+'</li>').join('')+'</ol></details>'}catch{} preparedHtml='<article class="edu-card edu-prepared-lesson"><small>'+tutorAttemptStatus(active.status,active.responseCount).toUpperCase()+'</small><h3>'+esc(active.unit.replace(/-N[1-5]$/,''))+' · '+learningStageForLevel(active.unit.match(/N[1-5]$/)?.[0]).label+'</h3><p>'+active.questionIds.length+' questões congeladas · '+active.responseCount+' respondida(s)</p>'+preview+'<div class="level-actions"><button class="edu-secondary" data-print-attempt="'+esc(active.id)+'">Imprimir aula</button><button class="edu-secondary" data-paper-attempt="'+esc(active.id)+'">Lançar respostas do papel</button></div>'+(canTutorReroll(active.status,active.responseCount)?'<button class="edu-secondary" data-reroll-attempt="'+esc(active.id)+'">Sortear outra aula</button>':'<p class="edu-lock-note">Sorteio bloqueado após a primeira resposta.</p>')+'</article>'}
 const historyHtml=history.map(item=>'<li><b>'+esc(item.unit.replace(/-N[1-5]$/,''))+'</b> · '+learningStageForLevel(item.unit.match(/N[1-5]$/)?.[0]).label+' · '+(item.completedAt?new Date(item.completedAt).toLocaleDateString('pt-BR'):'concluída')+'</li>').join('');
 ui('Tutor · '+person.name,'<div class="edu-page-head"><button id="backTutor" class="edu-back">← Colaboradores</button><small>ACOMPANHAMENTO INDIVIDUAL</small><h1>'+esc(person.name)+'</h1><p>'+esc(person.email||'')+'</p></div><section class="edu-tutor-overview"><article class="edu-card"><small>PRÓXIMA AULA SUGERIDA</small><h2>'+(next?esc(next.title)+' · '+learningStageForLevel(next.level).label:'Jornada concluída')+'</h2><p>'+(next?'Motor interno: '+esc(next.level)+'. O colaborador continua vendo apenas o Aprendizado.':'Não há nova unidade pendente.')+'</p>'+(next&&!active?'<button id="prepareTutorLesson" class="edu-primary" data-unit="'+esc(next.id)+'">Preparar próxima aula</button>':'')+'</article><article class="edu-card"><small>PROGRESSO</small><h2>'+(person.completedUnits?.length||0)+' de 60 unidades</h2><p>'+(data.pendingReviews?.length||0)+' resposta(s) aguardando correção.</p></article></section><section><h2>Perfil pedagógico</h2><div class="edu-tutor-skills">'+competencies+'</div></section><section><h2>Aula atual / preparada</h2>'+preparedHtml+'</section><details class="edu-admin-section"><summary>Histórico de aulas</summary><ul class="edu-history-list">'+(historyHtml||'<li>Nenhuma aula concluída ainda.</li>')+'</ul></details>','admin');
 document.getElementById('backTutor')?.addEventListener('click',()=>void showRh());
 document.getElementById('prepareTutorLesson')?.addEventListener('click',async event=>{const unit=(event.currentTarget as HTMLElement).dataset.unit||'';try{let attempt=(await api.post('/api/edu/admin/attempt/prepare',{token:tok(),participantId,unit})).data.attempt;const composition=buildLessonComposition(unit,attempt.seed,attempt.selectionVersion||1);attempt=(await api.post('/api/edu/admin/attempt/freeze',{token:tok(),participantId,attemptId:attempt.id,questionIds:composition.questionIds,reinforcementQuestionIds:composition.reinforcementQuestionIds})).data.attempt;say('Aula preparada.');await tutorParticipant(participantId)}catch(error){say(message(error))}});
 document.querySelectorAll<HTMLElement>('[data-print-attempt]').forEach(button=>button.addEventListener('click',()=>{const selected=attempts.find(item=>item.id===button.dataset.printAttempt);if(!selected)return;const composition=buildLessonComposition(selected.unit,selected.seed,selected.selectionVersion||1),questions=[...composition.mainQuestions,...composition.reviewQuestions],stage=learningStageForLevel(selected.unit.match(/N[1-5]$/)?.[0]);ui('Imprimir aula','<section class="edu-print-sheet"><header><h1>Universidade Empresarial</h1><p><b>Colaborador:</b> '+esc(person.name)+' &nbsp; <b>Data:</b> ____/____/______</p><p><b>'+esc(selected.unit.replace(/-N[1-5]$/,''))+'</b> · '+stage.label+'</p></header><ol>'+questions.map((item,index)=>'<li><p>'+esc(item.prompt)+'</p>'+(item.options?.length?'<div class="edu-print-options">'+item.options.map(option=>'□ '+esc(option)).join('<br>')+'</div>':'<div class="edu-print-lines">__________________________________________________<br>__________________________________________________</div>')+'</li>').join('')+'</ol></section><div class="edu-no-print level-actions"><button id="doPrint" class="edu-primary">Imprimir</button><button id="backFromPrint" class="edu-secondary">Voltar</button></div>','admin');document.getElementById('doPrint')?.addEventListener('click',()=>window.print());document.getElementById('backFromPrint')?.addEventListener('click',()=>void tutorParticipant(participantId))}));
 document.querySelectorAll<HTMLElement>('[data-paper-attempt]').forEach(button=>button.addEventListener('click',()=>{const selected=attempts.find(item=>item.id===button.dataset.paperAttempt);if(!selected)return;const composition=buildLessonComposition(selected.unit,selected.seed),questions=[...composition.mainQuestions,...composition.reviewQuestions],answered=new Set((selected.responses||[]).map(item=>item.questionId));ui('Respostas do papel','<div class="edu-page-head"><button id="backPaper" class="edu-back">← Voltar</button><small>PONTE PAPEL → ONLINE</small><h1>Lançar respostas do papel</h1><p>Somente questões ainda sem resposta podem ser registradas.</p></div><form id="paperForm" class="edu-paper-entry">'+questions.map((item,index)=>{const qid=item.meta?.id||'',locked=answered.has(qid);return'<article class="edu-card"><small>QUESTÃO '+(index+1)+'</small><p><b>'+esc(item.prompt)+'</b></p>'+(locked?'<p class="edu-lock-note">Já respondida. Não pode ser sobrescrita.</p>':item.options?.length?'<select data-paper-q="'+esc(qid)+'"><option value="">Selecione a resposta</option>'+item.options.map(option=>'<option>'+esc(option)+'</option>').join('')+'</select>':'<textarea data-paper-q="'+esc(qid)+'" placeholder="Transcreva a resposta do papel"></textarea>')+'</article>'}).join('')+'<button class="edu-primary">Salvar respostas preenchidas</button></form>','admin');document.getElementById('backPaper')?.addEventListener('click',()=>void tutorParticipant(participantId));document.getElementById('paperForm')?.addEventListener('submit',async event=>{event.preventDefault();const controls=Array.from((event.currentTarget as HTMLFormElement).querySelectorAll<HTMLSelectElement|HTMLTextAreaElement>('[data-paper-q]')).filter(control=>control.value.trim());if(!controls.length)return say('Preencha ao menos uma resposta.');try{for(const control of controls){const qid=control.dataset.paperQ||'',item=questions.find(question=>question.meta?.id===qid);if(!item)continue;const evaluation=evaluateLessonAnswer(item,control.value.trim());await api.post('/api/edu/admin/attempt/paper-response',{token:tok(),participantId,attemptId:selected.id,questionId:qid,response:control.value.trim(),correct:evaluation.correct})}say('Respostas do papel registradas.');await tutorParticipant(participantId)}catch(error){say(message(error))}})}));
 document.querySelectorAll<HTMLElement>('[data-reroll-attempt]').forEach(button=>button.addEventListener('click',async()=>{try{let attempt=(await api.post('/api/edu/admin/attempt/reroll',{token:tok(),participantId,attemptId:button.dataset.rerollAttempt})).data.attempt;const composition=buildLessonComposition(attempt.unit,attempt.seed,attempt.selectionVersion||1);await api.post('/api/edu/admin/attempt/freeze',{token:tok(),participantId,attemptId:attempt.id,questionIds:composition.questionIds,reinforcementQuestionIds:composition.reinforcementQuestionIds});say('Nova composição preparada.');await tutorParticipant(participantId)}catch(error){say(message(error))}}))
}
async function rh(){
 if(!admin())return home();
 const data=(await api.post('/api/edu/admin/overview',{token:tok()})).data,esc=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));
 const actions=(data.actionParticipants||[]).map((person:{id:string;name:string;group:string;evidence:string;nextAction:string})=>'<button class="edu-action-card '+esc(person.group)+'" data-tutor-person="'+esc(person.id)+'"><small>'+esc(adminGroupLabel(person.group))+'</small><h3>'+esc(person.name)+'</h3><p>'+esc(person.evidence)+'</p><b>Próxima ação: '+esc(person.nextAction)+'</b></button>').join('');
 const pending=(data.pendingReviews||[]).map((review:{id:string;participantName?:string;skill?:string;level?:string;question?:string;response?:string})=>'<article class="review-item"><div><b>'+esc(review.participantName||'Colaborador')+'</b><small>'+esc(review.skill||'')+' · '+esc(review.level||'')+'</small><p><b>Pergunta:</b> '+esc(review.question||'')+'</p><p><b>Resposta:</b> '+esc(review.response||'')+'</p></div><div class="review-actions"><button class="edu-primary" data-review-id="'+esc(review.id)+'" data-review-action="approve">Aprovar</button><button class="edu-secondary" data-review-id="'+esc(review.id)+'" data-review-action="needs_revision">Solicitar revisão</button></div></article>').join('');
 const people=(data.participants||[]).map((person:{id:string;name:string;email?:string;role?:string;completedUnits?:string[];diagnosticCompletedAt?:string;preparedLesson?:{status:string}|null})=>{const role=String(person.role||'colaborador'),roleControl=canManageRoles()?'<select aria-label="Perfil de '+esc(person.name)+'" data-role-id="'+esc(person.id)+'" data-role-current="'+esc(role)+'">'+['superadmin','admin','rh','gestor','colaborador'].map(value=>'<option value="'+value+'" '+(value===role?'selected':'')+'>'+educationRoleLabel(value)+'</option>').join('')+'</select>':educationRoleLabel(role);return'<tr><td><button class="edu-link-button" data-tutor-person="'+esc(person.id)+'">'+esc(person.name)+'</button></td><td>'+esc(person.email||'—')+'</td><td>'+roleControl+'</td><td>'+(person.completedUnits?.length||0)+'</td><td>'+(person.preparedLesson?'Aula '+esc(person.preparedLesson.status):person.diagnosticCompletedAt?'Pronto para aula':'Sondagem pendente')+'</td></tr>'}).join('');
 ui('Tutor','<section class="edu-page-head"><small>TUTOR</small><h1>Acompanhe cada colaborador</h1><p>Veja dificuldades, prepare a próxima aula, acompanhe tentativas e corrija respostas abertas.</p></section><section class="edu-action-grid">'+(actions||'<article class="edu-card"><p>Nenhuma ação urgente.</p></article>')+'</section><details class="edu-admin-section" open><summary>Respostas para corrigir ('+(data.pendingReviews?.length||0)+')</summary><div class="review-queue">'+(pending||'<p>Nenhuma resposta pendente.</p>')+'</div></details><details class="edu-admin-section" open><summary>Colaboradores</summary><div class="table-scroll"><table class="curriculum-table"><thead><tr><th>Colaborador</th><th>E-mail</th><th>Perfil</th><th>Unidades</th><th>Próxima situação</th></tr></thead><tbody>'+people+'</tbody></table></div></details><details class="edu-admin-section"><summary>Mapa curricular e biblioteca</summary><p>60 unidades · 12 competências · 3 áreas.</p><button id="all" class="edu-secondary">Abrir trilhas</button></details>','admin');
 document.querySelectorAll<HTMLElement>('[data-tutor-person]').forEach(button=>button.addEventListener('click',()=>void tutorParticipant(button.dataset.tutorPerson||'')));
 document.querySelectorAll<HTMLElement>('[data-review-id]').forEach(button=>button.addEventListener('click',async()=>{try{await api.post('/api/edu/admin/review',{token:tok(),reviewId:button.dataset.reviewId,action:button.dataset.reviewAction});await showRh()}catch(error){say(message(error))}}));
 document.getElementById('all')?.addEventListener('click',trilhas);
 document.querySelectorAll<HTMLSelectElement>('[data-role-id]').forEach(select=>select.addEventListener('change',async()=>{const before=select.dataset.roleCurrent||'colaborador';try{const response=await api.post('/api/edu/admin/role',{token:tok(),participantId:select.dataset.roleId,role:select.value});select.dataset.roleCurrent=response.data.participant.role}catch(error){select.value=before;say(message(error))}}))
}
export function mountUniversity() { void mount(); }

