import { api } from './cloudflare-client';

type Participant = {
  name:string;
  email?:string|null;
  skillLevels?:Record<string,string>;
  skillConfidence?:Record<string,number>;
  unitProgress?:Record<string,{attempts?:number;correct?:number;errors?:number}>;
};
type Deps = {
  token:()=>string;
  participant:()=>Participant|null;
  render:(title:string,html:string,nav:string)=>void;
  notify:(message:string)=>void;
  errorMessage:(error:unknown)=>string;
};
type SkillId =
  | 'reading.alphabet'
  | 'reading.instructions'
  | 'reading.messages'
  | 'comprehension.fact-opinion-consequence'
  | 'comprehension.instructions-responsibility'
  | 'comprehension.critical-reading'
  | 'math.addition'
  | 'math.multiplication'
  | 'math.division'
  | 'math.percentage'
  | 'math.measurements';
type GameType =
  | 'crossword'|'domino-math'|'word-search'|'matching'|'ordering'|'memory'
  | 'fill-blank'|'true-false'|'quick-quiz'|'classification'|'decision'
  | 'simulation'|'calculation'|'budget'|'cash-classification'|'word-map'
  | 'sentence-puzzle'|'dictation'|'image-discovery'|'daily-problem'|'mission';
type Activity={id:string;title:string;skillId:SkillId;gameType:GameType;difficulty:1|2|3|4|5};
type PracticeRun={
  runId:string;activityId:string;baseActivityId:string;variantId:string;variantSeed:number;variantFingerprint:string;
  contentKeys:string[];skillId:SkillId;difficulty:1|2|3|4|5;curriculumRefs:string[];
  originUnitId:string;unitId:string;gameType:GameType;score:number;correctAnswers:number;mistakes:number;
  hintsUsed:number;durationSec:number;completedAt:string;
};
type ChallengeItem={activityId:string;skillId:SkillId;gameType:GameType;difficulty:number;completed?:boolean;score?:number};
type DailyChallenge={id:string;date:string;status:'planned'|'started'|'completed';items:ChallengeItem[];createdAt:string;frozenAt:string};
type Question={prompt:string;options:string[];answer:string;explanation:string};

const ACTIVITIES:Activity[]=[
  ['crossword-leitura-N1','Palavras cruzadas de leitura','reading.alphabet','crossword',1],
  ['crossword-compreensao-N2','Palavras cruzadas de compreensão','comprehension.fact-opinion-consequence','crossword',2],
  ['crossword-medidas-N2','Cruzadinha de medidas','math.measurements','crossword',2],
  ['crossword-porcentagem-N1','Cruzadinha de porcentagem','math.percentage','crossword',1],
  ['domino-adicao-n2','Dominó da adição','math.addition','domino-math',2],
  ['domino-multiplicacao-n2','Dominó da multiplicação','math.multiplication','domino-math',2],
  ['domino-divisao-n2','Dominó da divisão','math.division','domino-math',2],
  ['domino-porcentagem-n2','Dominó de porcentagem','math.percentage','domino-math',2],
  ['domino-porcentagem-n3','Dominó de porcentagem avançado','math.percentage','domino-math',3],
  ['domino-porcentagem-n5','Desafio mestre de porcentagem','math.percentage','domino-math',5],
  ['domino-medidas-n2','Dominó de medidas','math.measurements','domino-math',2],
  ['word-search-reading-n1','Caça-palavras','reading.alphabet','word-search',1],
  ['matching-comprehension-n2','Ligue a informação','comprehension.fact-opinion-consequence','matching',2],
  ['ordering-reading-n3','Organize a mensagem','reading.messages','ordering',3],
  ['memory-percent-n1','Memória de porcentagens','math.percentage','memory',1],
  ['fill-blank-reading-n2','Complete a instrução','reading.instructions','fill-blank',2],
  ['true-false-comprehension-n2','Fato ou opinião','comprehension.fact-opinion-consequence','true-false',2],
  ['quick-quiz-percent-n2','Quiz rápido de porcentagem','math.percentage','quick-quiz',2],
  ['classification-comprehension-n2','Classifique a informação','comprehension.fact-opinion-consequence','classification',2],
  ['decision-comprehension-n5','Decisão e leitura crítica','comprehension.critical-reading','decision',5],
  ['simulation-comprehension-n3','Simulação de instruções','comprehension.instructions-responsibility','simulation',3],
  ['calculation-adicao-n3','Cálculo rápido','math.addition','calculation',3],
  ['budget-percent-n3','Desafio de orçamento','math.percentage','budget',3],
  ['stock-flow-adicao-n2','Fluxo de estoque','math.addition','cash-classification',2],
  ['word-map-comprehension-n3','Mapa de palavras','comprehension.instructions-responsibility','word-map',3],
  ['sentence-puzzle-reading-n3','Quebra-cabeça de frases','reading.messages','sentence-puzzle',3],
  ['dictation-reading-n1','Ditado visual','reading.alphabet','dictation',1],
  ['image-discovery-measures-n1','Descubra a medida','math.measurements','image-discovery',1],
  ['daily-problem-measures-n2','Problema do dia','math.measurements','daily-problem',2],
  ['mission-multiplication-n3','Missão multiplicação','math.multiplication','mission',3],
].map(([id,title,skillId,gameType,difficulty])=>({id,title,skillId,gameType,difficulty} as Activity));

const LABELS:Record<GameType,string>={
  crossword:'Cruzadinha','domino-math':'Dominó matemático','word-search':'Caça-palavras',matching:'Associação',
  ordering:'Ordenação',memory:'Memória','fill-blank':'Complete', 'true-false':'Verdadeiro ou falso',
  'quick-quiz':'Quiz rápido',classification:'Classificação',decision:'Decisão',simulation:'Simulação',
  calculation:'Cálculo',budget:'Orçamento','cash-classification':'Fluxo de estoque','word-map':'Mapa de palavras',
  'sentence-puzzle':'Frase embaralhada',dictation:'Ditado','image-discovery':'Descoberta visual',
  'daily-problem':'Problema do dia',mission:'Missão'
};
const SKILL_LABELS:Record<SkillId,string>={
  'reading.alphabet':'Leitura básica','reading.instructions':'Leitura de instruções','reading.messages':'Leitura de mensagens',
  'comprehension.fact-opinion-consequence':'Compreensão','comprehension.instructions-responsibility':'Instruções e responsabilidade',
  'comprehension.critical-reading':'Leitura crítica','math.addition':'Adição','math.multiplication':'Multiplicação',
  'math.division':'Divisão','math.percentage':'Porcentagem','math.measurements':'Medidas'
};
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));
const hash=(value:string)=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const pick=<T>(items:T[],seed:number)=>items[Math.abs(seed)%items.length];
const shuffle=<T>(items:T[],seed:number)=>items.map((v,i)=>({v,k:hash(seed+':'+i+':'+String(v))})).sort((a,b)=>a.k-b.k).map(x=>x.v);
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};

function unitFor(activity:Activity){
  const d=Math.max(1,Math.min(5,activity.difficulty));
  switch(activity.skillId){
    case 'reading.alphabet':return 'leitura-N1';
    case 'reading.instructions':return 'leitura-N2';
    case 'reading.messages':return 'leitura-N3';
    case 'comprehension.fact-opinion-consequence':return 'compreensao-N2';
    case 'comprehension.instructions-responsibility':return 'compreensao-N3';
    case 'comprehension.critical-reading':return 'compreensao-N5';
    case 'math.addition':return d>=3?'adicao-N3':'adicao-N2';
    case 'math.multiplication':return d>=3?'multiplicacao-N3':'multiplicacao-N2';
    case 'math.division':return 'divisao-N2';
    case 'math.percentage':return d>=5?'porcentagem-N5':d>=3?'porcentagem-N3':d>=2?'porcentagem-N2':'porcentagem-N1';
    case 'math.measurements':return d>=2?'medidas-N2':'medidas-N1';
  }
}
function area(skill:SkillId){return skill.startsWith('reading.')?'reading':skill.startsWith('comprehension.')?'comprehension':'math'}
function areaLabel(id:string){return id==='reading'?'Leitura':id==='comprehension'?'Compreensão':'Matemática'}

function mathQuestion(activity:Activity,seed:number):Question{
  const level=activity.difficulty;
  if(activity.skillId==='math.addition'){
    const a=20+(seed%80)+level*13,b=10+((seed>>>3)%70)+level*7,answer=a+b;
    const options=shuffle([answer,answer+10,answer-5,answer+1].map(String),seed);
    return{prompt:`${a} + ${b} = ?`,options,answer:String(answer),explanation:`Somando as duas parcelas, o resultado é ${answer}.`};
  }
  if(activity.skillId==='math.multiplication'){
    const a=2+(seed%8)+Math.min(3,level),b=2+((seed>>>4)%9),answer=a*b;
    const options=shuffle([answer,answer+a,answer-b,answer+2].map(String),seed);
    return{prompt:`${a} × ${b} = ?`,options,answer:String(answer),explanation:`${a} grupos de ${b} totalizam ${answer}.`};
  }
  if(activity.skillId==='math.division'){
    const b=2+(seed%8),answer=2+((seed>>>4)%10),a=b*answer;
    const options=shuffle([answer,answer+1,Math.max(1,answer-1),answer+2].map(String),seed);
    return{prompt:`${a} ÷ ${b} = ?`,options,answer:String(answer),explanation:`${a} dividido em ${b} grupos iguais dá ${answer} em cada grupo.`};
  }
  if(activity.skillId==='math.percentage'){
    const pct=pick([10,20,25,50],seed),base=pick([40,80,100,120,200,240],seed>>>4),answer=base*pct/100;
    const options=shuffle([answer,base-answer,answer+10,Math.max(1,answer-10)].map(v=>String(v)),seed);
    return{prompt:`Quanto é ${pct}% de ${base}?`,options,answer:String(answer),explanation:`${pct}% de ${base} corresponde a ${answer}.`};
  }
  const kind=pick(['comprimento','massa','tempo'],seed);
  if(kind==='comprimento')return{prompt:'Qual unidade é mais adequada para medir o comprimento de uma sala?',options:shuffle(['metro','quilograma','litro','hora'],seed),answer:'metro',explanation:'Comprimentos de ambientes são normalmente medidos em metros.'};
  if(kind==='massa')return{prompt:'Qual unidade é adequada para indicar a massa de um saco de material?',options:shuffle(['quilograma','metro','litro','minuto'],seed),answer:'quilograma',explanation:'Massa é medida em quilogramas nesse contexto.'};
  return{prompt:'Uma atividade dura 60 minutos. Isso corresponde a:',options:shuffle(['1 hora','2 horas','30 minutos','1 dia'],seed),answer:'1 hora',explanation:'60 minutos equivalem a 1 hora.'};
}

function languageQuestion(activity:Activity,seed:number):Question{
  const skill=activity.skillId;
  if(skill==='reading.alphabet'){
    const bank=[
      {p:'Qual palavra começa com a letra M?',a:'mesa',o:['mesa','casa','pato','bola'],e:'Mesa começa com M.'},
      {p:'Qual palavra termina com a letra A?',a:'obra',o:['obra','papel','motor','azul'],e:'Obra termina com A.'},
      {p:'Qual palavra está escrita corretamente?',a:'equipe',o:['equipe','ekipe','equepi','iquipe'],e:'A forma correta é “equipe”.'},
      {p:'Qual palavra tem 4 letras?',a:'obra',o:['obra','equipe','trabalho','material'],e:'O-B-R-A tem quatro letras.'}
    ];const q=pick(bank,seed);return{prompt:q.p,options:shuffle(q.o,seed),answer:q.a,explanation:q.e};
  }
  if(skill==='reading.instructions'){
    const bank=[
      {p:'A instrução diz: “Feche o registro antes de iniciar o reparo.” O que deve acontecer primeiro?',a:'Fechar o registro',o:['Fechar o registro','Iniciar o reparo','Guardar as ferramentas','Abrir a torneira'],e:'A palavra “antes” define a ordem.'},
      {p:'“Confira as medidas e depois corte a peça.” Qual é a segunda ação?',a:'Cortar a peça',o:['Cortar a peça','Conferir as medidas','Medir novamente amanhã','Descartar a peça'],e:'“Depois” indica que o corte vem após a conferência.'},
      {p:'“Use duas peças iguais.” Quantas peças são necessárias?',a:'2',o:['1','2','3','4'],e:'A instrução pede duas peças.'}
    ];const q=pick(bank,seed);return{prompt:q.p,options:shuffle(q.o,seed),answer:q.a,explanation:q.e};
  }
  if(skill==='reading.messages'){
    const bank=[
      {p:'Mensagem: “Material chega às 14h. Separe a área antes.” Qual informação principal?',a:'O material chega às 14h',o:['O material chega às 14h','A equipe encerra às 14h','A área já está pronta','O material foi cancelado'],e:'A mensagem informa explicitamente o horário de chegada.'},
      {p:'Mensagem: “Hoje o serviço será no 12º pavimento.” Onde será o serviço?',a:'12º pavimento',o:['10º pavimento','11º pavimento','12º pavimento','Térreo'],e:'O local está escrito diretamente na mensagem.'},
      {p:'Mensagem: “Avisar o encarregado ao concluir.” Quando avisar?',a:'Depois de concluir',o:['Antes de começar','Depois de concluir','No dia seguinte','Somente se faltar material'],e:'A expressão “ao concluir” indica o momento do aviso.'}
    ];const q=pick(bank,seed);return{prompt:q.p,options:shuffle(q.o,seed),answer:q.a,explanation:q.e};
  }
  if(skill==='comprehension.fact-opinion-consequence'){
    const bank=[
      {p:'“A equipe concluiu 3 apartamentos hoje.” Essa frase apresenta:',a:'Um fato verificável',o:['Um fato verificável','Uma opinião','Uma promessa','Uma dúvida'],e:'A frase descreve um resultado que pode ser conferido.'},
      {p:'“Este é o melhor método de todos.” Essa frase é:',a:'Uma opinião',o:['Uma opinião','Um horário','Uma medida','Uma quantidade'],e:'“Melhor” expressa avaliação.'},
      {p:'Se uma peça necessária não chegou, qual consequência mais direta?',a:'A atividade pode ficar impedida de continuar',o:['A atividade pode ficar impedida de continuar','A peça aparece automaticamente','O serviço já está concluído','O estoque aumenta'],e:'A falta do recurso pode impedir a continuidade.'}
    ];const q=pick(bank,seed);return{prompt:q.p,options:shuffle(q.o,seed),answer:q.a,explanation:q.e};
  }
  if(skill==='comprehension.instructions-responsibility'){
    const bank=[
      {p:'Instrução: “João confere as medidas; Carlos registra o resultado.” Quem deve registrar?',a:'Carlos',o:['João','Carlos','Os dois obrigatoriamente','Ninguém'],e:'A responsabilidade de registrar foi atribuída a Carlos.'},
      {p:'“Se houver divergência, pare e avise o responsável.” O que fazer ao encontrar divergência?',a:'Parar e avisar',o:['Continuar normalmente','Parar e avisar','Apagar o registro','Ignorar a diferença'],e:'A instrução define duas ações: parar e avisar.'},
      {p:'“Após terminar, fotografe e marque como concluído.” Qual ação vem antes de marcar como concluído?',a:'Fotografar',o:['Fotografar','Excluir a tarefa','Trocar a equipe','Abrir outra frente'],e:'A ordem indicada é terminar, fotografar e então marcar.'}
    ];const q=pick(bank,seed);return{prompt:q.p,options:shuffle(q.o,seed),answer:q.a,explanation:q.e};
  }
  const bank=[
    {p:'Uma mensagem diz “100% concluído”, mas também informa “faltam 2 apartamentos”. Qual leitura é mais cuidadosa?',a:'As informações entram em conflito e precisam ser verificadas',o:['As informações entram em conflito e precisam ser verificadas','Está tudo concluído sem dúvida','Os 2 apartamentos não importam','100% sempre é correto'],e:'Quando duas informações se contradizem, o correto é verificar a fonte.'},
    {p:'Um relatório afirma que houve avanço, mas não apresenta data nem quantidade. Qual é a principal limitação?',a:'Falta evidência suficiente para avaliar o avanço',o:['Falta evidência suficiente para avaliar o avanço','Todo relatório sem foto é falso','O avanço necessariamente foi zero','A data nunca é necessária'],e:'Sem referência de tempo e quantidade, a afirmação fica difícil de conferir.'},
    {p:'Duas fontes mostram valores diferentes para o mesmo item. O que fazer?',a:'Comparar origem, data e contexto antes de decidir',o:['Escolher o maior valor','Escolher o menor valor','Comparar origem, data e contexto antes de decidir','Ignorar as duas'],e:'Leitura crítica exige conferir origem, data e contexto.'}
  ];const q=pick(bank,seed);return{prompt:q.p,options:shuffle(q.o,seed),answer:q.a,explanation:q.e};
}

function generateQuestions(activity:Activity,seed:number){
  return Array.from({length:5},(_,i)=>activity.skillId.startsWith('math.')
    ?mathQuestion(activity,hash(seed+':math:'+i))
    :languageQuestion(activity,hash(seed+':lang:'+i)));
}

function recommendationOrder(participant:Participant|null,runs:PracticeRun[]){
  const confidences=participant?.skillConfidence||{};
  const runCounts=new Map<string,number>();
  runs.forEach(run=>runCounts.set(run.skillId,(runCounts.get(run.skillId)||0)+1));
  return [...ACTIVITIES].sort((a,b)=>{
    const ca=Number(confidences[a.skillId]??0.5),cb=Number(confidences[b.skillId]??0.5);
    const ra=runCounts.get(a.skillId)||0,rb=runCounts.get(b.skillId)||0;
    return (ca+ra*0.04)-(cb+rb*0.04);
  });
}
function practiceStats(runs:PracticeRun[]){
  const days=[...new Set(runs.map(r=>r.completedAt.slice(0,10)))].sort().reverse();
  return{
    runs:runs.length,
    minutes:Math.round(runs.reduce((s,r)=>s+Number(r.durationSec||0),0)/60),
    streakDays:days.length?Math.min(days.length,30):0
  };
}
function dailyChallenge(date:string,recommendations:Activity[],key:string):DailyChallenge{
  const seed=hash(date+':'+key);
  const pool=shuffle(recommendations.length?recommendations:ACTIVITIES,seed);
  const items=pool.slice(0,3).map(a=>({activityId:a.id,skillId:a.skillId,gameType:a.gameType,difficulty:a.difficulty}));
  const stamp=new Date().toISOString();
  return{id:'daily-'+date+'-'+seed.toString(16),date,status:'planned',items,createdAt:stamp,frozenAt:stamp};
}
function completedChallenge(challenge:DailyChallenge,activityId:string,score:number){
  const items=challenge.items.map(item=>item.activityId===activityId?{...item,completed:true,score}:item);
  const done=items.filter(i=>i.completed).length;
  return{...challenge,items,status:(done===items.length?'completed':done?'started':'planned') as DailyChallenge['status']};
}

export function createPracticeUi(deps:Deps){
  async function listRuns():Promise<PracticeRun[]>{
    const response=await api.post<{records:PracticeRun[]}>('/api/edu/practice/runs',{token:deps.token(),limit:200});
    return Array.isArray(response.data.records)?response.data.records:[];
  }
  async function saveRun(record:PracticeRun){
    await api.post('/api/edu/practice/run',{token:deps.token(),record});
  }

  async function openActivity(activityId:string,challenge?:DailyChallenge|null){
    const activity=ACTIVITIES.find(item=>item.id===activityId);
    if(!activity)return deps.notify('Atividade de prática não encontrada.');
    const seed=(Date.now()^hash(activity.id))>>>0,questions=generateQuestions(activity,seed),started=Date.now();
    let index=0,correct=0,mistakes=0,locked=false;
    const renderQuestion=()=>{
      const q=questions[index];
      const progress=Math.round(index/questions.length*100);
      deps.render(activity.title,
        '<section class="edu-page-head"><button id="backPractice" class="edu-back">← Prática & Desafios</button><small>'+escapeHtml(LABELS[activity.gameType])+' · '+escapeHtml(SKILL_LABELS[activity.skillId])+'</small><h1>'+escapeHtml(activity.title)+'</h1><p>Questão '+(index+1)+' de '+questions.length+'</p></section>'+
        '<div class="edu-card"><div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-bottom:20px"><div style="height:100%;width:'+progress+'%;background:currentColor"></div></div>'+
        '<h2>'+escapeHtml(q.prompt)+'</h2><div class="edu-grid two" id="practiceAnswers">'+q.options.map((option,i)=>'<button class="edu-secondary" data-answer="'+i+'" data-value="'+escapeHtml(option)+'">'+escapeHtml(option)+'</button>').join('')+'</div><div id="practiceFeedback" style="margin-top:16px"></div></div>',
        'pratica');
      document.getElementById('backPractice')?.addEventListener('click',()=>void open());
      document.querySelectorAll<HTMLElement>('[data-answer]').forEach(button=>button.addEventListener('click',async()=>{
        if(locked)return;locked=true;
        const selected=button.dataset.value||'',ok=selected===q.answer;
        if(ok)correct++;else mistakes++;
        document.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(b=>{b.disabled=true;if((b.dataset.value||'')===q.answer)b.style.outline='3px solid #2e7d32'});
        const feedback=document.getElementById('practiceFeedback');
        if(feedback)feedback.innerHTML='<p><b>'+(ok?'Correto.':'Resposta correta: '+escapeHtml(q.answer))+'</b></p><p>'+escapeHtml(q.explanation)+'</p><button id="nextPractice" class="edu-primary">'+(index===questions.length-1?'Concluir':'Próxima')+'</button>';
        document.getElementById('nextPractice')?.addEventListener('click',async()=>{
          if(index<questions.length-1){index++;locked=false;renderQuestion();return}
          const score=Math.round(correct/questions.length*100),completedAt=new Date().toISOString(),unit=unitFor(activity);
          const record:PracticeRun={
            runId:activity.id+':'+completedAt,
            activityId:activity.id,baseActivityId:activity.id,
            variantId:activity.id+':'+seed.toString(16),variantSeed:Math.max(1,seed),variantFingerprint:seed.toString(16),
            contentKeys:questions.map((_,i)=>activity.id+':q'+i),skillId:activity.skillId,difficulty:activity.difficulty,
            curriculumRefs:[unit],originUnitId:unit,unitId:unit,gameType:activity.gameType,score,
            correctAnswers:correct,mistakes,hintsUsed:0,durationSec:Math.max(1,Math.round((Date.now()-started)/1000)),completedAt
          };
          try{
            await saveRun(record);
            if(challenge?.items.some(item=>item.activityId===activity.id)){
              const updated=completedChallenge(challenge,activity.id,score);
              await api.post('/api/edu/practice/challenge/save',{token:deps.token(),challenge:updated});
            }
          }catch(error){deps.notify(deps.errorMessage(error))}
          deps.render('Prática concluída',
            '<article class="edu-card"><small>RESULTADO</small><h1>'+score+' pontos</h1><p>'+correct+' de '+questions.length+' respostas corretas.</p><div class="level-actions"><button id="practiceAgain" class="edu-secondary">Praticar novamente</button><button id="backPracticeHub" class="edu-primary">Voltar aos desafios</button></div></article>',
            'pratica');
          document.getElementById('practiceAgain')?.addEventListener('click',()=>void openActivity(activity.id,challenge));
          document.getElementById('backPracticeHub')?.addEventListener('click',()=>void open());
        });
      }));
    };
    renderQuestion();
  }

  async function open(){
    deps.render('Prática & Desafios','<article class="edu-card"><h1>Preparando sua prática…</h1><p>Selecionando atividades de acordo com seu histórico.</p></article>','pratica');
    try{
      const participant=deps.participant(),runs=await listRuns(),ordered=recommendationOrder(participant,runs),recommendations=ordered.slice(0,8),date=today();
      const saved=(await api.post<{challenge:DailyChallenge|null}>('/api/edu/practice/challenge/read',{token:deps.token(),date})).data.challenge;
      let challenge=saved;
      if(!challenge){
        const proposed=dailyChallenge(date,recommendations,participant?.email||participant?.name||'participant');
        challenge=(await api.post<{challenge:DailyChallenge}>('/api/edu/practice/challenge/save',{token:deps.token(),challenge:proposed})).data.challenge;
      }
      const stats=practiceStats(runs);
      const recommended=recommendations.map(item=>'<article class="edu-card"><small>RECOMENDADO · '+escapeHtml(LABELS[item.gameType])+'</small><h2>'+escapeHtml(item.title)+'</h2><p>'+escapeHtml(SKILL_LABELS[item.skillId])+'</p><button class="edu-primary" data-practice="'+escapeHtml(item.id)+'">Começar</button></article>').join('');
      const challengeHtml=challenge.items.map(item=>{const activity=ACTIVITIES.find(a=>a.id===item.activityId);return activity?'<article class="edu-card"><small>'+(item.completed?'CONCLUÍDO':'DESAFIO DE HOJE')+'</small><h3>'+escapeHtml(activity.title)+'</h3><p>'+escapeHtml(LABELS[activity.gameType])+(item.score!=null?' · '+item.score+' pontos':'')+'</p><button class="edu-secondary" data-practice="'+escapeHtml(activity.id)+'">'+(item.completed?'Praticar novamente':'Fazer desafio')+'</button></article>':''}).join('');
      const areaButtons=['reading','comprehension','math'].map(id=>'<button class="edu-secondary" data-practice-area="'+id+'">'+areaLabel(id)+'</button>').join('');
      const catalog=ACTIVITIES.map(activity=>'<article class="edu-card" data-practice-card data-area="'+area(activity.skillId)+'"><small>'+escapeHtml(LABELS[activity.gameType])+'</small><h3>'+escapeHtml(activity.title)+'</h3><p>'+escapeHtml(SKILL_LABELS[activity.skillId])+'</p><button class="edu-secondary" data-practice="'+escapeHtml(activity.id)+'">Praticar</button></article>').join('');
      const weakSkills=[...new Set(recommendations.map(r=>r.skillId))].slice(0,4);
      const reviews=weakSkills.map(skill=>'<article class="edu-card"><small>REVISÃO RÁPIDA</small><h3>'+escapeHtml(SKILL_LABELS[skill])+'</h3><p>Revise o conceito e faça uma atividade curta para reforçar esta habilidade.</p><button class="edu-primary" data-review-skill="'+escapeHtml(skill)+'">Quero praticar</button></article>').join('');
      deps.render('Prática & Desafios',
        '<section class="edu-page-head"><small>PRÁTICA & DESAFIOS</small><h1>Treine no seu ritmo</h1><p>Jogos e revisões reforçam habilidades sem alterar artificialmente o percentual das trilhas.</p></section>'+
        '<div class="edu-signal-grid"><article class="edu-card"><b>'+stats.runs+' práticas concluídas</b></article><article class="edu-card"><b>'+stats.minutes+' minutos praticados</b></article><article class="edu-card"><b>'+stats.streakDays+' dia(s) de sequência</b></article></div>'+
        '<h2>Recomendado para você</h2><div class="edu-grid two">'+recommended+'</div>'+
        '<h2>Desafio de hoje</h2><div class="edu-grid two">'+challengeHtml+'</div>'+
        '<h2>Revisar em poucos minutos</h2><div class="edu-grid two">'+reviews+'</div>'+
        '<h2>Praticar por área</h2><div class="level-actions"><button class="edu-secondary" data-practice-area="all">Todas</button>'+areaButtons+'</div>'+
        '<div class="edu-grid two">'+catalog+'</div>',
        'pratica');
      document.querySelectorAll<HTMLElement>('[data-practice]').forEach(button=>button.addEventListener('click',()=>void openActivity(button.dataset.practice||'',challenge)));
      document.querySelectorAll<HTMLElement>('[data-review-skill]').forEach(button=>button.addEventListener('click',()=>{const skill=button.dataset.reviewSkill as SkillId;const target=recommendations.find(a=>a.skillId===skill)||ACTIVITIES.find(a=>a.skillId===skill);if(target)void openActivity(target.id,challenge)}));
      document.querySelectorAll<HTMLElement>('[data-practice-area]').forEach(button=>button.addEventListener('click',()=>{const selected=button.dataset.practiceArea;document.querySelectorAll<HTMLElement>('[data-practice-card]').forEach(card=>card.style.display=selected==='all'||card.dataset.area===selected?'':'none')}));
    }catch(error){
      deps.render('Prática & Desafios','<article class="edu-card"><h1>Não foi possível carregar sua prática</h1><p>'+escapeHtml(deps.errorMessage(error))+'</p><button id="retryPractice" class="edu-primary">Tentar novamente</button></article>','pratica');
      document.getElementById('retryPractice')?.addEventListener('click',()=>void open());
      deps.notify(deps.errorMessage(error));
    }
  }

  async function decorateProgress(){
    const anchor=document.querySelector<HTMLElement>('.track-levels');
    if(!anchor||document.querySelector('[data-practice-progress-summary]'))return;
    try{
      const runs=await listRuns(),stats=practiceStats(runs),recent=[...new Set(runs.slice(0,12).map(r=>r.skillId))].slice(0,5);
      const section=document.createElement('section');
      section.setAttribute('data-practice-progress-summary','true');section.className='edu-card';
      section.innerHTML='<div class="edu-section-title"><div><small>PRÁTICA</small><h2>Prática & Desafios</h2></div><p>Indicadores separados da conclusão das trilhas.</p></div>'+
        '<div class="edu-signal-grid"><article class="edu-card"><b>'+stats.runs+' práticas</b></article><article class="edu-card"><b>'+stats.minutes+' minutos</b></article><article class="edu-card"><b>'+stats.streakDays+' dia(s) de sequência</b></article></div>'+
        (recent.length?'<p>Habilidades recentes: '+recent.map(s=>escapeHtml(SKILL_LABELS[s])).join(' · ')+'</p>':'<p>Quando você praticar, seu desempenho aparecerá aqui.</p>')+
        '<button id="openPracticeFromProgress" class="edu-secondary">Abrir Prática & Desafios</button>';
      anchor.insertAdjacentElement('afterend',section);
      document.getElementById('openPracticeFromProgress')?.addEventListener('click',()=>void open());
    }catch{}
  }
  return{open,decorateProgress};
}
