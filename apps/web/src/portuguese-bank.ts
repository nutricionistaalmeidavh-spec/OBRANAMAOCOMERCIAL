import { withCompetencyGuidance } from './content-guidance';

type PortugueseVariant={skill:'leitura'|'compreensao'|'escrita';level:'N2'|'N3'|'N4';topic:string;prompt:string};
const RAW:PortugueseVariant[]=[
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "LINGUAGEM",
    "prompt": "Cite três formas diferentes de linguagem usadas no dia a dia (ex.: fala, gestos, imagens)."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "LINGUAGEM",
    "prompt": "O que é linguagem verbal? Dê um exemplo."
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "LINGUAGEM",
    "prompt": "Diferencie linguagem verbal de linguagem não verbal, citando um exemplo de cada."
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "LINGUAGEM",
    "prompt": "Explique, com suas palavras, a função da linguagem em uma conversa entre amigos e em um discurso formal."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "LINGUAGEM",
    "prompt": "Analise uma propaganda (real ou inventada) e explique como ela combina linguagem verbal e não verbal para convencer o público."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "SIGNIFICAÇÃO DAS PALAVRAS: SINÔNIMOS, ANTÔNIMOS E HOMÔNIMOS",
    "prompt": "Escreva um sinônimo para: alegre, veloz, formoso, triste."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "SIGNIFICAÇÃO DAS PALAVRAS: SINÔNIMOS, ANTÔNIMOS E HOMÔNIMOS",
    "prompt": "Escreva um antônimo para: claro, generoso, fácil, cheio."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "SIGNIFICAÇÃO DAS PALAVRAS: SINÔNIMOS, ANTÔNIMOS E HOMÔNIMOS",
    "prompt": "Dê um exemplo de palavra homônima e explique seu duplo sentido."
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "SIGNIFICAÇÃO DAS PALAVRAS: SINÔNIMOS, ANTÔNIMOS E HOMÔNIMOS",
    "prompt": "Reescreva a frase substituindo a palavra destacada por um sinônimo adequado: \"O diretor foi intransigente com os prazos.\""
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "SIGNIFICAÇÃO DAS PALAVRAS: SINÔNIMOS, ANTÔNIMOS E HOMÔNIMOS",
    "prompt": "Explique a diferença entre homônimos homógrafos e homófonos, com um exemplo de cada."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "SIGNIFICAÇÃO DAS PALAVRAS: SINÔNIMOS, ANTÔNIMOS E HOMÔNIMOS",
    "prompt": "Construa duas frases em que a mesma palavra homônima assuma sentidos diferentes."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "SIGNIFICAÇÃO DAS PALAVRAS: SINÔNIMOS, ANTÔNIMOS E HOMÔNIMOS",
    "prompt": "Analise a ambiguidade gerada pelo uso de uma palavra homônima em: \"O jogo terminou cedo.\""
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "PARÔNIMOS",
    "prompt": "O que são parônimos? Dê um exemplo de par de palavras parônimas."
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "PARÔNIMOS",
    "prompt": "Diferencie, usando uma frase para cada: cumprimento / comprimento; comprimir / cumprir."
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "PARÔNIMOS",
    "prompt": "Construa um parágrafo curto usando corretamente os parônimos: cessão, sessão e seção."
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "VERBOS",
    "prompt": "Classifique como regular ou irregular: cantar, fazer, comer, ir."
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "VERBOS",
    "prompt": "Conjugue o verbo \"estudar\" no presente do indicativo (eu, tu, ele, nós, vós, eles)."
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "VERBOS",
    "prompt": "Passe para o pretérito perfeito e depois para o futuro do presente: \"Eu como frutas todos os dias.\""
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "VERBOS",
    "prompt": "Identifique o modo verbal em: \"Se ele chegasse mais cedo, pegaria o ônibus.\""
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "VERBOS",
    "prompt": "Reescreva corrigindo os erros de tempo e modo verbal: \"Nós assistimos o filme ontem e gostou muito, mas ela preferia que nós fossemos embora antes.\""
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "VERBOS",
    "prompt": "Explique a diferença de sentido entre \"Ele foi ao médico\" e \"Ele iria ao médico\"."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "ADVÉRBIOS",
    "prompt": "Sublinhe os advérbios: \"Ele correu rapidamente e chegou tarde.\""
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "ADVÉRBIOS",
    "prompt": "Classifique os advérbios abaixo quanto à circunstância: aqui, hoje, muito, talvez."
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "ADVÉRBIOS",
    "prompt": "Reescreva a frase trocando a posição do advérbio e explique se o sentido mudou: \"Só ele resolveu o problema.\""
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "ADVÉRBIOS",
    "prompt": "Explique a diferença de sentido entre: \"Ele não fala bem\" e \"Ele fala não bem\" (ou situações semelhantes de posição do advérbio de negação)."
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "SUBSTANTIVOS",
    "prompt": "Classifique os substantivos quanto ao tipo (próprio, comum, concreto, abstrato): Brasil, cadeira, amor, cidade."
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "SUBSTANTIVOS",
    "prompt": "Passe para o plural: cidadão, pão, hífen, cônsul."
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "SUBSTANTIVOS",
    "prompt": "Explique a diferença entre substantivo coletivo e substantivo comum, dando três exemplos de coletivos pouco usuais."
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "ADJETIVOS",
    "prompt": "Sublinhe os adjetivos: \"A casa grande e antiga pertencia a um homem generoso.\""
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "ADJETIVOS",
    "prompt": "Passe os adjetivos para o grau comparativo e superlativo: bom, mau, grande."
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "ADJETIVOS",
    "prompt": "Reescreva o texto substituindo os adjetivos por locuções adjetivas equivalentes: \"amor paterno, dor de cabeça, atitude covarde.\""
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "ARTIGO",
    "prompt": "Complete com artigo definido ou indefinido: \"___ menino comprou ___ livro interessante.\""
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "ARTIGO",
    "prompt": "Explique a diferença de sentido entre: \"Comprei um carro\" e \"Comprei o carro.\""
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "ARTIGO",
    "prompt": "Identifique os casos de ausência de artigo (uso \"zero\") no texto: \"Criança gosta de brincar\" — explique o efeito de sentido."
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "CRASE",
    "prompt": "Marque onde há crase: \"Vou a a escola / Refiro-me a o assunto / Cheguei a as três horas.\""
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "CRASE",
    "prompt": "Corrija: \"Entreguei o trabalho a professora\" e justifique a regra aplicada."
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "CRASE",
    "prompt": "Identifique e corrija os erros: \"Ela chegou à uma hora atrasada, andando à pé, à procura do endereço.\""
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "CRASE",
    "prompt": "Escreva três frases que exemplifiquem crase facultativa (antes de nome próprio feminino, pronome possessivo e \"até\")."
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "PREPOSIÇÃO",
    "prompt": "Sublinhe as preposições: \"Ela foi para casa depois do trabalho, sem pressa.\""
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "PREPOSIÇÃO",
    "prompt": "Complete com a preposição adequada, considerando a regência do verbo: \"Ele gosta ___ música; assistimos ___ filme; obedecemos ___ regras.\""
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "PREPOSIÇÃO",
    "prompt": "Explique o erro de regência em: \"Prefiro carne do que peixe\" e reescreva corretamente."
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "EMPREGO DOS PORQUÊS",
    "prompt": "Complete com \"por que\", \"porque\", \"por quê\" ou \"porquê\": \"___ você não veio à festa? ___ estava doente.\""
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "EMPREGO DOS PORQUÊS",
    "prompt": "Escreva uma frase correta para cada uma das quatro formas do \"porquê\"."
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "EMPREGO DOS PORQUÊS",
    "prompt": "Corrija o texto: \"Não sei o porque disso, mas por quê ele fez assim eu não entendo, porquê nunca me explicou.\""
  },
  {
    "skill": "leitura",
    "level": "N2",
    "topic": "FONEMA",
    "prompt": "Separe em fonemas a palavra \"casa\" e a palavra \"chuva\"."
  },
  {
    "skill": "leitura",
    "level": "N3",
    "topic": "FONEMA",
    "prompt": "Explique a diferença entre letra e fonema, usando a palavra \"táxi\" como exemplo."
  },
  {
    "skill": "leitura",
    "level": "N4",
    "topic": "FONEMA",
    "prompt": "Identifique dígrafos e encontros consonantais nas palavras: chuva, prato, guerra, exceto."
  },
  {
    "skill": "leitura",
    "level": "N2",
    "topic": "PALAVRAS OXÍTONAS, PAROXÍTONAS E PROPAROXÍTONAS",
    "prompt": "Classifique quanto à tonicidade: café, árvore, médico, jabuti."
  },
  {
    "skill": "leitura",
    "level": "N3",
    "topic": "PALAVRAS OXÍTONAS, PAROXÍTONAS E PROPAROXÍTONAS",
    "prompt": "Aplique a regra de acentuação e explique por que \"família\" e \"história\" são acentuadas."
  },
  {
    "skill": "leitura",
    "level": "N4",
    "topic": "PALAVRAS OXÍTONAS, PAROXÍTONAS E PROPAROXÍTONAS",
    "prompt": "Corrija a acentuação e explique a regra em cada caso: \"arvore, oculos, dificil, ultimo, agua.\""
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "SINTAXE DE CONCORDÂNCIA",
    "prompt": "Corrija a concordância: \"Os menino chegou cedo.\" / \"A maioria dos alunos foram aprovado.\""
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "SINTAXE DE CONCORDÂNCIA",
    "prompt": "Corrija: \"Fazem dois anos que ele se formou.\" / \"Vinte por cento dos moradores votou contra.\""
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "SINTAXE DE CONCORDÂNCIA",
    "prompt": "Explique a regra de concordância em: \"Aluga-se casas\" x \"Alugam-se casas\" — qual é a forma correta e por quê?"
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "PRONOMES",
    "prompt": "Classifique os pronomes destacados: \"Eu te disse que isso não é meu problema.\""
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "PRONOMES",
    "prompt": "Corrija o uso do pronome: \"Fazer um favor a mim mesmo\" / \"Entre eu e você não há segredos.\""
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "PRONOMES",
    "prompt": "Explique a diferença de sentido/formalidade entre: \"Vi ela na rua\" e \"Vi-a na rua.\""
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "NUMERAIS",
    "prompt": "Classifique os numerais: dois, segundo, dobro, dezena."
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "NUMERAIS",
    "prompt": "Escreva por extenso: 15º, 1/3, 200."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "NUMERAIS",
    "prompt": "Explique a diferença de uso entre numeral cardinal e ordinal em referências a séculos e capítulos de livros."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "INTERJEIÇÕES",
    "prompt": "Identifique as interjeições e o sentimento que expressam: \"Ai! Que dor!\" / \"Oba! Consegui!\""
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "INTERJEIÇÕES",
    "prompt": "Escreva um pequeno diálogo (4 falas) usando ao menos três interjeições diferentes."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "INTERJEIÇÕES",
    "prompt": "Explique como a interjeição contribui para o sentido de um texto publicitário, dando um exemplo."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "CONJUNÇÕES",
    "prompt": "Classifique as conjunções: \"e\", \"mas\", \"porque\", \"se\"."
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "CONJUNÇÕES",
    "prompt": "Una as frases usando a conjunção adequada: \"Estudei muito. / Não fui bem na prova.\""
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "CONJUNÇÕES",
    "prompt": "Reescreva o parágrafo substituindo as conjunções repetidas por sinônimos conjuntivos, mantendo a coesão: \"Ele estudou, mas não passou. Mas continuou tentando, mas sem sucesso.\""
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "FRASE, ORAÇÃO E PERÍODO",
    "prompt": "Classifique como frase, oração ou período: \"Socorro!\" / \"Ele chegou.\" / \"Ele chegou e saiu.\""
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "FRASE, ORAÇÃO E PERÍODO",
    "prompt": "Identifique o número de orações no período: \"Quando ele chegou, todos já haviam saído, pois estava muito tarde.\""
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "FRASE, ORAÇÃO E PERÍODO",
    "prompt": "Reescreva o período composto abaixo como duas frases simples, sem perder o sentido original: \"Embora estivesse cansado, ele continuou trabalhando até terminar o projeto.\""
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "SUJEITO E PREDICADO",
    "prompt": "Identifique sujeito e predicado: \"Os alunos estudaram para a prova.\""
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "SUJEITO E PREDICADO",
    "prompt": "Classifique o sujeito: \"Choveu muito ontem.\" / \"Vendem-se casas.\" / \"Fala-se inglês aqui.\""
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "SUJEITO E PREDICADO",
    "prompt": "Identifique e classifique o sujeito em orações sem sujeito e com sujeito indeterminado, explicando a diferença."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "FIGURAS DE LINGUAGEM",
    "prompt": "Identifique a figura de linguagem: \"Chorei rios de lágrimas.\" (hipérbole)"
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "FIGURAS DE LINGUAGEM",
    "prompt": "Identifique a figura de linguagem em cada frase: \"O sol beijava as montanhas\" / \"Ele é um leão em campo\" / \"Que silêncio ensurdecedor.\""
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "FIGURAS DE LINGUAGEM",
    "prompt": "Escreva um pequeno texto (5-6 linhas) empregando pelo menos três figuras de linguagem diferentes e identifique-as."
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "ESTRUTURA DE UMA DISSERTAÇÃO",
    "prompt": "Cite as três partes básicas de uma dissertação."
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "ESTRUTURA DE UMA DISSERTAÇÃO",
    "prompt": "Elabore uma introdução (3-4 linhas) para o tema \"O uso das redes sociais entre jovens\"."
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "ESTRUTURA DE UMA DISSERTAÇÃO",
    "prompt": "Escreva um parágrafo de desenvolvimento com argumento e exemplo sobre o tema acima, seguido de uma conclusão coerente."
  },
  {
    "skill": "escrita",
    "level": "N2",
    "topic": "DICAS PARA FAZER UMA BOA REDAÇÃO",
    "prompt": "Cite três cuidados importantes ao escrever uma redação (ex.: fugir do tema, coesão, ortografia)."
  },
  {
    "skill": "escrita",
    "level": "N3",
    "topic": "DICAS PARA FAZER UMA BOA REDAÇÃO",
    "prompt": "Reescreva o parágrafo abaixo corrigindo problemas de coesão e repetição de palavras (o professor pode fornecer um parágrafo de exemplo)."
  },
  {
    "skill": "escrita",
    "level": "N4",
    "topic": "DICAS PARA FAZER UMA BOA REDAÇÃO",
    "prompt": "Produza uma redação dissertativa completa (20-25 linhas) sobre um tema social atual, seguindo a estrutura introdução-desenvolvimento-conclusão."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "LITERATURA E GÊNEROS LITERÁRIOS",
    "prompt": "Cite os três gêneros literários e um exemplo de obra para cada."
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "LITERATURA E GÊNEROS LITERÁRIOS",
    "prompt": "Diferencie gênero lírico, épico e dramático quanto à forma e à finalidade."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "LITERATURA E GÊNEROS LITERÁRIOS",
    "prompt": "Escolha uma obra conhecida e classifique-a quanto ao gênero literário, justificando com características do texto."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "CLASSICISMO",
    "prompt": "Em que período histórico surgiu o Classicismo?"
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "CLASSICISMO",
    "prompt": "Cite duas características do Classicismo."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "CLASSICISMO",
    "prompt": "Compare os valores do Classicismo com os do Barroco, destacando uma diferença central de visão de mundo."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "BARROCO",
    "prompt": "O que caracteriza o conflito barroco entre corpo e alma?"
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "BARROCO",
    "prompt": "Cite dois recursos estilísticos comuns na literatura barroca."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "BARROCO",
    "prompt": "Explique como o contexto histórico (Contrarreforma) influenciou os temas do Barroco."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "ROMANTISMO",
    "prompt": "Cite duas características do Romantismo (ex.: subjetivismo, idealização)."
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "ROMANTISMO",
    "prompt": "Diferencie as três gerações do Romantismo brasileiro em poesia."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "ROMANTISMO",
    "prompt": "Analise como o nacionalismo romântico se manifesta na construção do herói indígena."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "REALISMO",
    "prompt": "Cite uma diferença entre Romantismo e Realismo."
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "REALISMO",
    "prompt": "Explique o conceito de \"crítica social\" no Realismo, com um exemplo de tema abordado."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "REALISMO",
    "prompt": "Compare a visão da mulher no Romantismo e no Realismo, citando as mudanças de retrato literário."
  },
  {
    "skill": "compreensao",
    "level": "N2",
    "topic": "MODERNISMO",
    "prompt": "Em que ano ocorreu a Semana de Arte Moderna e onde?"
  },
  {
    "skill": "compreensao",
    "level": "N3",
    "topic": "MODERNISMO",
    "prompt": "Cite duas rupturas que o Modernismo trouxe em relação à literatura anterior."
  },
  {
    "skill": "compreensao",
    "level": "N4",
    "topic": "MODERNISMO",
    "prompt": "Escolha um poema modernista (ou escreva um trecho no estilo modernista) e analise seus recursos de linguagem coloquial e verso livre."
  }
];
export const PORTUGUESE_VARIANTS=RAW.map(x=>withCompetencyGuidance({...x,kind:'text' as const,answer:'',accept:[],options:[],source:'Lista de Exercícios Português EM'}));
