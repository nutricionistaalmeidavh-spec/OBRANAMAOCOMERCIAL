import { api } from '@appdeploy/client';
import { getLearningGamesRuntime, type PracticeLearningSignal, type DailyPracticeChallenge } from './learning-games-loader';

type Participant = { name: string; email?: string | null; skillLevels?: Record<string, string>; skillConfidence?: Record<string, number>; unitProgress?: Record<string, { attempts?: number; correct?: number; errors?: number }> };
type Deps = {
  token: () => string;
  participant: () => Participant | null;
  render: (title: string, html: string, nav: string) => void;
  notify: (message: string) => void;
  errorMessage: (error: unknown) => string;
};

export function createPracticeUi(deps: Deps) {
  const signals = (): PracticeLearningSignal[] => {
    const participant = deps.participant();
    const result: PracticeLearningSignal[] = [];
    for (const [unitId, state] of Object.entries(participant?.unitProgress || {})) {
      const attempts = Number(state.attempts || 0), correct = Number(state.correct || 0), errors = Number(state.errors || 0);
      if (attempts || errors) result.push({ source: 'lesson', unitId, score: attempts ? Math.round(correct / attempts * 100) : undefined, errors });
    }
    for (const [skill, level] of Object.entries(participant?.skillLevels || {})) {
      const confidence = Number(participant?.skillConfidence?.[skill]);
      if (Number.isFinite(confidence)) result.push({ source: 'diagnostic', unitId: skill + '-' + level, score: Math.round(confidence * 100) });
    }
    return result;
  };
  const areaOf = (skillId: string) => skillId.startsWith('reading.') ? 'reading' : skillId.startsWith('comprehension.') ? 'comprehension' : 'math';
  const today = () => { const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); };

  async function openActivity(activityId: string, challenge?: DailyPracticeChallenge | null) {
    const LG = await getLearningGamesRuntime();
    const baseActivity = LG.ALL_LEARNING_GAME_ACTIVITIES.find((item: any) => item.id === activityId);
    if (!baseActivity) return deps.notify('Atividade de prática não encontrada.');
    deps.render(baseActivity.title, '<div class="edu-page-head"><button id="backPractice" class="edu-back">← Prática & Desafios</button><small>' + LG.learningGameKindLabel(baseActivity.type) + '</small><h1>' + baseActivity.title + '</h1><p>Preparando uma combinação diferente para esta habilidade.</p></div><div id="learningGameMount"></div>', 'pratica');
    document.getElementById('backPractice')?.addEventListener('click', () => void open());
    const container = document.getElementById('learningGameMount'); if (!container) return;
    const repository = new LG.ApiPracticeRunRepository(api, deps.token);
    try {
      const generated = await LG.mountGeneratedLearningActivity(container, baseActivity, {
        progressRepository: repository, candidateCount: 18, recentWindow: 12,
        onProgressSaved: (summary: { score: number }) => {
          deps.notify('Prática concluída · ' + summary.score + ' pontos.');
          if (!challenge?.items.some(item => item.activityId === baseActivity.id)) return;
          const updated = LG.completeDailyChallengeItem(challenge, baseActivity.id, summary.score);
          if (updated) void api.post('/api/edu/practice/challenge/save', { token: deps.token(), challenge: updated });
        },
        onContinue: () => void open(),
      });
      const header = document.querySelector<HTMLElement>('.edu-page-head p');
      if (header) header.textContent = generated.resumedGeneration ? 'Você retomou exatamente a prática que estava em andamento.' : 'Nova combinação gerada para esta habilidade.';
    } catch (error) { deps.notify(deps.errorMessage(error)); }
  }

  async function open() {
    deps.render('Prática & Desafios', '<article class="edu-card"><h1>Preparando sua prática…</h1><p>Selecionando atividades de acordo com seu histórico.</p></article>', 'pratica');
    const LG = await getLearningGamesRuntime();
    const repository = new LG.ApiPracticeRunRepository(api, deps.token);
    try {
      const participant = deps.participant();
      const runs = await repository.list();
      const profile = LG.buildPracticeProfile(runs);
      const recommendations = LG.recommendPractice({ activities: LG.ALL_LEARNING_GAME_ACTIVITIES, runs, signals: signals(), limit: 8 });
      const date = today();
      const saved = (await api.post('/api/edu/practice/challenge/read', { token: deps.token(), date })).data.challenge as DailyPracticeChallenge | null;
      let challenge = saved;
      if (!challenge) {
        const proposed = LG.buildDailyPracticeChallenge({ participantKey: participant?.email || participant?.name || 'participant', date, recommendations });
        challenge = (await api.post('/api/edu/practice/challenge/save', { token: deps.token(), challenge: proposed })).data.challenge;
      }
      const hub = LG.buildPracticeHubViewModel({ activities: LG.ALL_LEARNING_GAME_ACTIVITIES, profile, recommendations, challenge });
      const recommended = hub.recommended.map((item: any) => '<article class="edu-card"><small>RECOMENDADO · ' + LG.learningGameKindLabel(item.activity.type) + '</small><h2>' + item.activity.title + '</h2><p>' + item.reason + '</p><button class="edu-primary" data-practice="' + item.activity.id + '">Começar</button></article>').join('');
      const challengeHtml = challenge ? challenge.items.map(item => { const activity = LG.ALL_LEARNING_GAME_ACTIVITIES.find((candidate: any) => candidate.id === item.activityId); return activity ? '<article class="edu-card"><small>' + (item.completed ? 'CONCLUÍDO' : 'DESAFIO DE HOJE') + '</small><h3>' + activity.title + '</h3><p>' + LG.learningGameKindLabel(activity.type) + (item.score != null ? ' · ' + item.score + ' pontos' : '') + '</p><button class="edu-secondary" data-practice="' + activity.id + '">' + (item.completed ? 'Praticar novamente' : 'Fazer desafio') + '</button></article>' : ''; }).join('') : '';
      const areas = hub.areas.map((area: any) => '<button class="edu-secondary" data-practice-area="' + area.id + '">' + area.label + ' · ' + area.activityCount + '</button>').join('');
      const catalog = LG.ALL_LEARNING_GAME_ACTIVITIES.map((activity: any) => '<article class="edu-card" data-practice-card data-area="' + areaOf(activity.skillId) + '"><small>' + LG.learningGameKindLabel(activity.type) + '</small><h3>' + activity.title + '</h3><button class="edu-secondary" data-practice="' + activity.id + '">Praticar</button></article>').join('');
      const reviews = hub.reviews.map((card: any) => '<article class="edu-card"><small>REVISÃO RÁPIDA</small><h3>' + card.title + '</h3><p>' + card.summary + '</p><p><b>Exemplo:</b> ' + card.example + '</p><div class="level-actions"><button class="edu-secondary" data-review-ok>Entendi</button><button class="edu-primary" data-review-practice="' + card.skillId + '">Quero praticar</button></div></article>').join('');
      deps.render('Prática & Desafios', '<section class="edu-page-head"><small>PRÁTICA & DESAFIOS</small><h1>Treine no seu ritmo</h1><p>Jogos e revisões reforçam habilidades, mas não concluem lições nem alteram o percentual da sua trilha.</p></section><div class="edu-signal-grid"><article class="edu-card"><b>' + hub.stats.runs + ' práticas concluídas</b></article><article class="edu-card"><b>' + hub.stats.minutes + ' minutos praticados</b></article><article class="edu-card"><b>' + hub.stats.streakDays + ' dia(s) de sequência</b></article></div><h2>Recomendado para você</h2><div class="edu-grid two">' + recommended + '</div><h2>Desafio de hoje</h2><div class="edu-grid two">' + challengeHtml + '</div><h2>Revisar em poucos minutos</h2><div class="edu-grid two">' + reviews + '</div><h2>Praticar por área</h2><div class="level-actions"><button class="edu-secondary" data-practice-area="all">Todas</button>' + areas + '</div><div class="edu-grid two">' + catalog + '</div><details class="edu-card"><summary>Modos disponíveis</summary><p>' + hub.modes.map((mode: any) => mode.label).join(' · ') + '</p></details>', 'pratica');
      document.querySelectorAll<HTMLElement>('[data-practice]').forEach(button => button.addEventListener('click', () => void openActivity(button.dataset.practice || '', challenge)));
      document.querySelectorAll<HTMLElement>('[data-review-ok]').forEach(button => button.addEventListener('click', () => { button.textContent = 'Revisado'; button.setAttribute('disabled', 'true'); }));
      document.querySelectorAll<HTMLElement>('[data-review-practice]').forEach(button => button.addEventListener('click', () => { const skillId = button.dataset.reviewPractice; const target = recommendations.find((item: any) => item.activity.skillId === skillId)?.activity || LG.ALL_LEARNING_GAME_ACTIVITIES.find((item: any) => item.skillId === skillId); if (target) void openActivity(target.id, challenge); }));
      document.querySelectorAll<HTMLElement>('[data-practice-area]').forEach(button => button.addEventListener('click', () => { const area = button.dataset.practiceArea; document.querySelectorAll<HTMLElement>('[data-practice-card]').forEach(card => card.style.display = area === 'all' || card.dataset.area === area ? '' : 'none'); }));
    } catch (error) {
      deps.render('Prática & Desafios', '<article class="edu-card"><h1>Não foi possível carregar sua prática</h1><p>Seu progresso não foi alterado.</p><button id="retryPractice" class="edu-primary">Tentar novamente</button></article>', 'pratica');
      document.getElementById('retryPractice')?.addEventListener('click', () => void open());
      deps.notify(deps.errorMessage(error));
    }
  }

  async function decorateProgress() {
    const anchor = document.querySelector<HTMLElement>('.track-levels');
    if (!anchor || document.querySelector('[data-practice-progress-summary]')) return;
    try {
      const LG = await getLearningGamesRuntime();
      const runs = await new LG.ApiPracticeRunRepository(api, deps.token).list();
      const profile = LG.buildPracticeProfile(runs);
      const practicedSkills = profile.skills.filter((skill: any) => skill.runs > 0).sort((a: any, b: any) => b.confidence - a.confidence).slice(0, 5);
      const section = document.createElement('section');
      section.setAttribute('data-practice-progress-summary', 'true');
      section.className = 'edu-card';
      section.innerHTML = '<div class="edu-section-title"><div><small>PRÁTICA</small><h2>Prática & Desafios</h2></div><p>Indicadores separados da conclusão das trilhas.</p></div><div class="edu-signal-grid"><article class="edu-card"><b>' + profile.totalRuns + ' práticas</b></article><article class="edu-card"><b>' + Math.round(profile.totalDurationSec / 60) + ' minutos</b></article><article class="edu-card"><b>' + profile.streakDays + ' dia(s) de sequência</b></article></div>' + (practicedSkills.length ? '<div class="edu-development-list">' + practicedSkills.map((skill: any) => '<article class="edu-progress-summary"><h3>' + skill.label + '</h3><p>' + (skill.band === 'solid' ? 'Consolidando' : skill.band === 'developing' ? 'Em desenvolvimento' : 'Precisa de prática') + ' · confiança ' + skill.confidence + '%</p></article>').join('') + '</div>' : '<p>Quando você praticar, seu desempenho aparecerá aqui sem alterar o percentual das lições.</p>') + '<button id="openPracticeFromProgress" class="edu-secondary">Abrir Prática & Desafios</button>';
      anchor.insertAdjacentElement('afterend', section);
      document.getElementById('openPracticeFromProgress')?.addEventListener('click', () => void open());
    } catch { }
  }

  return { open, decorateProgress };
}
