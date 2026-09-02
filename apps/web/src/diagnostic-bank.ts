export const DIAGNOSTIC_SKILLS=['leitura','compreensao','escrita','adicao','multiplicacao','divisao','porcentagem','medidas','seguranca','direitos','saude','tecnologia'] as const;
export type DiagnosticSkill=(typeof DIAGNOSTIC_SKILLS)[number];
export type DiagnosticArea='comunicacao'|'matematica'|'trabalho';
export type DiagnosticItem={
  id:string;
  area:DiagnosticArea;
  areaLabel:string;
  skills:DiagnosticSkill[];
  kind:'choice'|'short-text';
  prompt:string;
  options?:string[];
  answer?:string;
  minLength?:number;
  requiredTerms?:string[];
  passLevel:1|2|3|4|5;
  missLevel:1|2|3|4|5;
  confirmation?:boolean;
};
const choice=(input:Omit<DiagnosticItem,'kind'>):DiagnosticItem=>({...input,kind:'choice'});
const short=(input:Omit<DiagnosticItem,'kind'>):DiagnosticItem=>({...input,kind:'short-text'});
export const PRIMARY_DIAGNOSTIC_ITEMS:DiagnosticItem[]=[
choice({id:'diag-com-01',area:'comunicacao',areaLabel:'Capacitação em Comunicação',skills:['leitura','compreensao'],prompt:'O aviso diz: “A reunião será às 14h, na sala 2.” Qual informação ele traz?',options:['Horário e local','Quantidade de materiais','Nome do responsável'],answer:'Horário e local',passLevel:3,missLevel:1}),
choice({id:'diag-com-02',area:'comunicacao',areaLabel:'Capacitação em Comunicação',skills:['leitura'],prompt:'Na instrução “Antes de ligar a máquina, confira o cabo”, o que deve acontecer primeiro?',options:['Conferir o cabo','Ligar a máquina','Guardar o cabo'],answer:'Conferir o cabo',passLevel:4,missLevel:2}),
short({id:'diag-com-03',area:'comunicacao',areaLabel:'Capacitação em Comunicação',skills:['escrita'],prompt:'Escreva uma frase curta avisando que faltou material.',minLength:12,requiredTerms:['material'],passLevel:3,missLevel:1}),
choice({id:'diag-com-04',area:'comunicacao',areaLabel:'Capacitação em Comunicação',skills:['compreensao'],prompt:'A equipe terminou o serviço às 16h e deixou a área limpa. O que podemos afirmar?',options:['O serviço terminou às 16h e a área foi organizada','A equipe chegou às 16h','O serviço ficou para o dia seguinte'],answer:'O serviço terminou às 16h e a área foi organizada',passLevel:4,missLevel:2}),
short({id:'diag-com-05',area:'comunicacao',areaLabel:'Capacitação em Comunicação',skills:['escrita','compreensao'],prompt:'Escreva um aviso curto informando que haverá reunião amanhã às 8h.',minLength:14,requiredTerms:['reuni','8'],passLevel:4,missLevel:2}),
choice({id:'diag-mat-01',area:'matematica',areaLabel:'Capacitação Matemática',skills:['adicao'],prompt:'Havia 18 peças e chegaram mais 7. Quantas peças há agora?',options:['25','24','11'],answer:'25',passLevel:3,missLevel:2}),
choice({id:'diag-mat-02',area:'matematica',areaLabel:'Capacitação Matemática',skills:['multiplicacao'],prompt:'Quatro caixas têm 6 peças cada. Quantas peças há ao todo?',options:['24','10','18'],answer:'24',passLevel:3,missLevel:2}),
choice({id:'diag-mat-03',area:'matematica',areaLabel:'Capacitação Matemática',skills:['divisao'],prompt:'24 peças serão divididas igualmente entre 6 pessoas. Quantas peças cada pessoa recebe?',options:['4','6','18'],answer:'4',passLevel:3,missLevel:2}),
choice({id:'diag-mat-04',area:'matematica',areaLabel:'Capacitação Matemática',skills:['porcentagem'],prompt:'Quanto é 10% de 200?',options:['20','10','40'],answer:'20',passLevel:3,missLevel:2}),
choice({id:'diag-mat-05',area:'matematica',areaLabel:'Capacitação Matemática',skills:['medidas'],prompt:'2 metros correspondem a quantos centímetros?',options:['200 cm','20 cm','2.000 cm'],answer:'200 cm',passLevel:3,missLevel:2}),
choice({id:'diag-mat-06',area:'matematica',areaLabel:'Capacitação Matemática',skills:['adicao','medidas'],prompt:'Um rolo tinha 12 m. Foram usados 3,5 m e depois 2,5 m. Quantos metros restaram?',options:['6 m','7 m','5 m'],answer:'6 m',passLevel:4,missLevel:2}),
choice({id:'diag-work-01',area:'trabalho',areaLabel:'Capacitação para o Trabalho',skills:['seguranca'],prompt:'Você encontra uma área molhada e escorregadia no caminho da equipe. Qual é a melhor primeira ação?',options:['Sinalizar a área e comunicar o responsável','Ignorar porque ainda ninguém caiu','Cobrir a água com papel'],answer:'Sinalizar a área e comunicar o responsável',passLevel:3,missLevel:2}),
choice({id:'diag-work-02',area:'trabalho',areaLabel:'Capacitação para o Trabalho',skills:['direitos'],prompt:'Uma orientação de trabalho ficou confusa. O que ajuda a evitar erro?',options:['Pedir que a orientação seja repetida e confirmar o entendimento','Fingir que entendeu','Inventar uma instrução parecida'],answer:'Pedir que a orientação seja repetida e confirmar o entendimento',passLevel:3,missLevel:2}),
choice({id:'diag-work-03',area:'trabalho',areaLabel:'Capacitação para o Trabalho',skills:['saude'],prompt:'Após esforço intenso no calor, uma pessoa relata tontura. Qual conduta é mais adequada?',options:['Parar com segurança, oferecer apoio e avisar o responsável','Mandar continuar até terminar','Esconder o sintoma'],answer:'Parar com segurança, oferecer apoio e avisar o responsável',passLevel:3,missLevel:2}),
choice({id:'diag-work-04',area:'trabalho',areaLabel:'Capacitação para o Trabalho',skills:['tecnologia'],prompt:'Você recebe um link desconhecido pedindo sua senha. O que deve fazer?',options:['Não informar a senha e confirmar a origem do pedido','Enviar a senha porque o pedido parece urgente','Repassar o link ao grupo'],answer:'Não informar a senha e confirmar a origem do pedido',passLevel:3,missLevel:2}),
];
export const CONFIRMATION_DIAGNOSTIC_ITEMS:DiagnosticItem[]=[
choice({id:'diag-com-confirm',area:'comunicacao',areaLabel:'Capacitação em Comunicação',skills:['leitura','compreensao'],prompt:'O aviso “ENTREGA ÀS 9H” informa principalmente o quê?',options:['O horário da entrega','O valor da entrega','A quantidade entregue'],answer:'O horário da entrega',passLevel:3,missLevel:1,confirmation:true}),
choice({id:'diag-mat-confirm',area:'matematica',areaLabel:'Capacitação Matemática',skills:['adicao'],prompt:'Havia 10 peças e 3 foram usadas. Quantas restaram?',options:['7','13','3'],answer:'7',passLevel:3,missLevel:1,confirmation:true}),
choice({id:'diag-work-confirm',area:'trabalho',areaLabel:'Capacitação para o Trabalho',skills:['direitos','tecnologia'],prompt:'Uma mensagem de origem desconhecida pede um dado pessoal de trabalho. Qual atitude é mais adequada?',options:['Confirmar a origem antes de responder','Enviar o dado imediatamente','Publicar a mensagem em um grupo aberto'],answer:'Confirmar a origem antes de responder',passLevel:3,missLevel:1,confirmation:true}),
];
export const ALL_DIAGNOSTIC_ITEMS=[...PRIMARY_DIAGNOSTIC_ITEMS,...CONFIRMATION_DIAGNOSTIC_ITEMS];
export const DIAGNOSTIC_PRIMARY_COUNT=PRIMARY_DIAGNOSTIC_ITEMS.length;
export const DIAGNOSTIC_MAX_COUNT=18;
export const diagnosticItemById=(id:string)=>ALL_DIAGNOSTIC_ITEMS.find(item=>item.id===id);
