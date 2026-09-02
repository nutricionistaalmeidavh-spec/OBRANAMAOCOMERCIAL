import { withCompetencyGuidance } from './content-guidance';

type AdditionalVariant={skill:'leitura'|'compreensao'|'escrita'|'adicao'|'multiplicacao'|'divisao'|'porcentagem'|'medidas';level:'N1'|'N2'|'N3'|'N4';topic:string;prompt:string;source:string;kind?:'short-text';answer?:string;accept?:string[]};
const RAW:AdditionalVariant[]=[
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "CONTAGEM E QUANTIDADE",
    "prompt": "Conte e escreva quantos objetos há no desenho.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "CONTAGEM E QUANTIDADE",
    "prompt": "Pinte 5 estrelas entre um grupo de 9.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "CONTAGEM E QUANTIDADE",
    "prompt": "Relacione o número à quantidade: 4 (quatro bolas), 6 (seis lápis), 8 (oito botões).",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "CONTAGEM E QUANTIDADE",
    "prompt": "Desenhe 4 triângulos e 3 círculos.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "CONTAGEM E QUANTIDADE",
    "prompt": "Circule o grupo que tem mais elementos: [grupo com 5 bolinhas] ou [grupo com 8 bolinhas].",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "SEQUÊNCIAS NUMÉRICAS",
    "prompt": "Observe a regularidade de 2, 4 e 6; escreva os dois próximos números antes de 12.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "SEQUÊNCIAS NUMÉRICAS",
    "prompt": "Complete a sequência: 10, 9, 8, __, __, 5.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "SEQUÊNCIAS NUMÉRICAS",
    "prompt": "Escreva os números de 1 a 20 em ordem crescente.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "SEQUÊNCIAS NUMÉRICAS",
    "prompt": "Complete a sequência: 5, 10, 15, __, __, 30.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "SEQUÊNCIAS NUMÉRICAS",
    "prompt": "Circule o número que está fora da sequência: 1, 2, 3, 4, 6, 5.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "COMPARAÇÃO DE NÚMEROS",
    "prompt": "Circule o número maior: 6 ou 9.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "COMPARAÇÃO DE NÚMEROS",
    "prompt": "Circule o número menor: 12 ou 7.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "COMPARAÇÃO DE NÚMEROS",
    "prompt": "Ordene do menor para o maior: 8, 3, 15, 1, 10.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "COMPARAÇÃO DE NÚMEROS",
    "prompt": "Complete com \"maior que\", \"menor que\" ou \"igual a\": 7 ___ 10; 15 ___ 15; 20 ___ 12.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "OPERAÇÕES SIMPLES (ADIÇÃO E SUBTRAÇÃO)",
    "prompt": "Resolva: 3 + 4 = __",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "OPERAÇÕES SIMPLES (ADIÇÃO E SUBTRAÇÃO)",
    "prompt": "Resolva: 9 - 5 = __",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "OPERAÇÕES SIMPLES (ADIÇÃO E SUBTRAÇÃO)",
    "prompt": "Complete os pares: 6 + __ = 10",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "OPERAÇÕES SIMPLES (ADIÇÃO E SUBTRAÇÃO)",
    "prompt": "Complete os pares: 15 - __ = 8",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "OPERAÇÕES SIMPLES (ADIÇÃO E SUBTRAÇÃO)",
    "prompt": "Resolva o problema: Ana tinha 6 balas e ganhou mais 3. Com quantas balas ela ficou?",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "OPERAÇÕES SIMPLES (ADIÇÃO E SUBTRAÇÃO)",
    "prompt": "Resolva o problema: Pedro tinha 12 figurinhas e deu 5 para o amigo. Com quantas ficou?",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "FORMAS GEOMÉTRICAS",
    "prompt": "Observe um piso com quatro lados iguais: descreva a forma que você reconhece.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "FORMAS GEOMÉTRICAS",
    "prompt": "Compare uma placa redonda e uma janela retangular: qual diferença de contorno aparece?",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "FORMAS GEOMÉTRICAS",
    "prompt": "Registre um objeto do trabalho que tenha formato triangular.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "FORMAS GEOMÉTRICAS",
    "prompt": "Conte os lados de um retângulo desenhado e escreva o resultado.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "MEDIDAS E TEMPO (NOÇÕES BÁSICAS)",
    "prompt": "Anote que instrumento você usaria para medir o comprimento de uma bancada.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "MEDIDAS E TEMPO (NOÇÕES BÁSICAS)",
    "prompt": "Leia um relógio marcando 8h e registre o horário por extenso.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "MEDIDAS E TEMPO (NOÇÕES BÁSICAS)",
    "prompt": "Explique qual unidade combina com a duração de um turno.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "MEDIDAS E TEMPO (NOÇÕES BÁSICAS)",
    "prompt": "Organize 7h, 12h e 17h na ordem em que acontecem.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "MEDIDAS E TEMPO (NOÇÕES BÁSICAS)",
    "prompt": "Descreva quando uma trena é mais útil que um relógio.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N2",
    "topic": "DINHEIRO (NOÇÕES BÁSICAS)",
    "prompt": "Registre duas formas de pagar uma compra de R$ 10,00.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N2",
    "topic": "DINHEIRO (NOÇÕES BÁSICAS)",
    "prompt": "Uma compra custa R$ 7,00 e você entrega R$ 10,00: escreva o troco.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N2",
    "topic": "DINHEIRO (NOÇÕES BÁSICAS)",
    "prompt": "Compare uma nota de R$ 5,00 com três moedas de R$ 1,00.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N2",
    "topic": "DINHEIRO (NOÇÕES BÁSICAS)",
    "prompt": "Explique por que conferir o troco evita engano.",
    "source": "1-Banco-Questoes-Matematica-Kumon.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "SISTEMAS DE NUMERAÇÃO",
    "prompt": "Escreva o número 47 em algarismos romanos.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "SISTEMAS DE NUMERAÇÃO",
    "prompt": "Escreva por extenso o número 3.208.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "SISTEMAS DE NUMERAÇÃO",
    "prompt": "Converta para o sistema decimal: XLIV, MCMXC.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "SISTEMAS DE NUMERAÇÃO",
    "prompt": "Explique o que é valor posicional, usando o número 5.253 como exemplo (compare o valor dos dois algarismos \"5\").",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "SISTEMAS DE NUMERAÇÃO",
    "prompt": "Explique por que o sistema de numeração romano não usa o número zero e qual a limitação disso para operações matemáticas.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "OPERAÇÕES COM NÚMEROS NATURAIS",
    "prompt": "Calcule: 245 + 178; 932 - 456; 34 x 12; 144 ÷ 12.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "OPERAÇÕES COM NÚMEROS NATURAIS",
    "prompt": "Resolva a expressão: 25 + 8 x 3 - 10 ÷ 2 =",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "OPERAÇÕES COM NÚMEROS NATURAIS",
    "prompt": "Um comerciante comprou 12 caixas com 24 produtos cada. Quantos produtos ele tem ao todo?",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "OPERAÇÕES COM NÚMEROS NATURAIS",
    "prompt": "Resolva o problema: Uma fábrica produz 350 peças por dia. Se funciona 22 dias por mês, quantas peças produz em um trimestre? Mostre os cálculos.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "DIVISORES E MÚLTIPLOS DE NÚMEROS NATURAIS",
    "prompt": "Liste todos os divisores de 24.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "DIVISORES E MÚLTIPLOS DE NÚMEROS NATURAIS",
    "prompt": "Escreva os cinco primeiros múltiplos de 6.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "DIVISORES E MÚLTIPLOS DE NÚMEROS NATURAIS",
    "prompt": "Calcule o MDC e o MMC entre 18 e 24.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "DIVISORES E MÚLTIPLOS DE NÚMEROS NATURAIS",
    "prompt": "Classifique os números 17, 21, 29 e 35 em primos ou compostos.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "DIVISORES E MÚLTIPLOS DE NÚMEROS NATURAIS",
    "prompt": "Dois ônibus saem juntos de um terminal, um a cada 15 minutos e outro a cada 20 minutos. Depois de quanto tempo eles voltarão a sair juntos? (Use MMC.)",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "NÚMEROS INTEIROS",
    "prompt": "Calcule: (-5) + 8; (+7) - (+12); (-4) x (-3).",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "NÚMEROS INTEIROS",
    "prompt": "Ordene do menor para o maior: -8, 3, -1, 0, 5.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "NÚMEROS INTEIROS",
    "prompt": "Resolva: (-15) + (-7) - (-20) + 6 =",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "NÚMEROS INTEIROS",
    "prompt": "A temperatura era de -3°C pela manhã e subiu 9°C até a tarde. Qual foi a temperatura da tarde?",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "NÚMEROS INTEIROS",
    "prompt": "Resolva a expressão: -3 x (4 - 7) + (-2)³ ÷ 4 =",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N2",
    "topic": "NÚMEROS RACIONAIS - FRAÇÕES",
    "prompt": "Desenhe uma barra dividida em duas partes iguais e nomeie uma parte.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N2",
    "topic": "NÚMEROS RACIONAIS - FRAÇÕES",
    "prompt": "Escreva uma fração que represente três partes de quatro.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N3",
    "topic": "NÚMEROS RACIONAIS - FRAÇÕES",
    "prompt": "Compare metade e um quarto usando palavras simples.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N3",
    "topic": "NÚMEROS RACIONAIS - FRAÇÕES",
    "prompt": "Relacione 1/2 a uma situação de repartir um material.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N4",
    "topic": "NÚMEROS RACIONAIS - FRAÇÕES",
    "prompt": "Explique o que o número de baixo indica em 2/5.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N2",
    "topic": "OPERAÇÕES COM NÚMEROS REAIS",
    "prompt": "Calcule 18 + 7 e registre como conferiu o resultado.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N3",
    "topic": "OPERAÇÕES COM NÚMEROS REAIS",
    "prompt": "Retire 9 de  20 e escreva a conta completa.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N4",
    "topic": "OPERAÇÕES COM NÚMEROS REAIS",
    "prompt": "Escolha uma estratégia para conferir 6 × 4 e descreva-a.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "TEORIA DOS CONJUNTOS",
    "prompt": "Dados A = {1, 2, 3, 4} e B = {3, 4, 5, 6}, escreva A ∪ B e A ∩ B.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "TEORIA DOS CONJUNTOS",
    "prompt": "Dados A = {2, 4, 6, 8} e B = {4, 8, 12}, calcule A - B (diferença) e represente em diagrama de Venn.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "TEORIA DOS CONJUNTOS",
    "prompt": "Em uma pesquisa com 100 pessoas, 60 gostam de futebol, 45 gostam de vôlei e 25 gostam dos dois esportes. Quantas pessoas não gostam de nenhum dos dois? (Use teoria dos conjuntos.)",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "HORA DA REVISÃO - DÍZIMAS PERIÓDICAS",
    "prompt": "Transforme em fração: 0,333...",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "HORA DA REVISÃO - DÍZIMAS PERIÓDICAS",
    "prompt": "Identifique se é dízima periódica simples ou composta: 0,1666... e 0,272727...",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "HORA DA REVISÃO - DÍZIMAS PERIÓDICAS",
    "prompt": "Transforme em fração geratriz: 0,4555...",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "HORA DA REVISÃO - DÍZIMAS PERIÓDICAS",
    "prompt": "Explique, com um exemplo, por que toda dízima periódica é um número racional.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "EXPRESSÕES NUMÉRICAS",
    "prompt": "Resolva: 5 + (3 x 2) - 4 =",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "EXPRESSÕES NUMÉRICAS",
    "prompt": "Resolva: 20 - [8 + (3 x 2)] =",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "EXPRESSÕES NUMÉRICAS",
    "prompt": "Resolva respeitando a ordem das operações: 3² + (10 - 4) ÷ 2 - 5 =",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "EXPRESSÕES NUMÉRICAS",
    "prompt": "Resolva a expressão: {40 - [(6 + 4) x 2 - 5]} ÷ 5 + 3² =",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "SEQUÊNCIAS E REGULARIDADES",
    "prompt": "Encontre os termos que faltam na sequência par até chegar ao 12.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "SEQUÊNCIAS E REGULARIDADES",
    "prompt": "Complete a sequência: 1, 4, 9, 16, __, __.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "SEQUÊNCIAS E REGULARIDADES",
    "prompt": "Descubra a regra e escreva os próximos três termos: 3, 7, 11, 15, __, __, __.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "SEQUÊNCIAS E REGULARIDADES",
    "prompt": "Encontre o termo geral (fórmula) da sequência: 5, 8, 11, 14, 17... e calcule o 20º termo.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "EQUAÇÕES, PROPORCIONALIDADE E REGRA DE TRÊS",
    "prompt": "Resolva a equação: x + 7 = 15.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "EQUAÇÕES, PROPORCIONALIDADE E REGRA DE TRÊS",
    "prompt": "Resolva a equação: 3x - 4 = 11.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "EQUAÇÕES, PROPORCIONALIDADE E REGRA DE TRÊS",
    "prompt": "Resolva por regra de três simples: Se 5 metros de tecido custam R$ 60, quanto custam 8 metros?",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "EQUAÇÕES, PROPORCIONALIDADE E REGRA DE TRÊS",
    "prompt": "Resolva por regra de três composta: 6 operários constroem um muro de 30 metros em 10 dias. Quantos dias 4 operários levarão para construir um muro de 40 metros?",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "PORCENTAGENS",
    "prompt": "Calcule 20% de 150.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "PORCENTAGENS",
    "prompt": "Calcule 45% de 80.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "PORCENTAGENS",
    "prompt": "Um produto de R$ 250 teve desconto de 15%. Qual o preço final?",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "PORCENTAGENS",
    "prompt": "Um salário de R$ 1.800 teve aumento de 8%. Qual o novo valor?",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "PORCENTAGENS",
    "prompt": "Um produto custava R$ 400 e, após dois aumentos sucessivos de 10% cada, qual o preço final? Calcule também o percentual de aumento total.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N2",
    "topic": "A MATEMÁTICA NA COMUNICAÇÃO - ESTATÍSTICA",
    "prompt": "Conte quantas pessoas estão em uma frente e registre o total.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N3",
    "topic": "A MATEMÁTICA NA COMUNICAÇÃO - ESTATÍSTICA",
    "prompt": "Compare dois registros de produção e diga qual é maior.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "porcentagem",
    "level": "N4",
    "topic": "A MATEMÁTICA NA COMUNICAÇÃO - ESTATÍSTICA",
    "prompt": "Explique por que anotar dados ajuda a decidir no trabalho.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "ÂNGULOS",
    "prompt": "Classifique os ângulos: 30°, 90°, 120°, 180°.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "ÂNGULOS",
    "prompt": "Meça (ou desenhe) um ângulo de 45°.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "ÂNGULOS",
    "prompt": "Dois ângulos são complementares. Um deles mede 35°. Qual a medida do outro?",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "ÂNGULOS",
    "prompt": "Dois ângulos são suplementares. Um deles mede 110°. Qual a medida do outro?",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "ÂNGULOS",
    "prompt": "Em um triângulo, dois ângulos internos medem 55° e 65°. Calcule o terceiro ângulo e classifique o triângulo quanto aos ângulos.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "ÁREA DE RETÂNGULOS E QUADRADOS",
    "prompt": "Calcule a área de um retângulo com base 8 cm e altura 5 cm.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N2",
    "topic": "ÁREA DE RETÂNGULOS E QUADRADOS",
    "prompt": "Calcule a área de um quadrado de lado 6 cm.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N3",
    "topic": "ÁREA DE RETÂNGULOS E QUADRADOS",
    "prompt": "Um terreno retangular mede 15 m de comprimento por 10 m de largura. Calcule a área e o valor total se o metro quadrado custa R$ 350.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "adicao",
    "level": "N4",
    "topic": "ÁREA DE RETÂNGULOS E QUADRADOS",
    "prompt": "Uma sala retangular de 6 m x 4 m terá o piso revestido por cerâmicas quadradas de 40 cm de lado. Quantas cerâmicas serão necessárias (sem considerar perdas)?",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "medidas",
    "level": "N2",
    "topic": "CONVERSÃO DE UNIDADES DE MEDIDA",
    "prompt": "Converta 2 metros em centímetros e escreva o cálculo.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "medidas",
    "level": "N3",
    "topic": "CONVERSÃO DE UNIDADES DE MEDIDA",
    "prompt": "Explique quando trocar metros por centímetros facilita a medição.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "medidas",
    "level": "N4",
    "topic": "CONVERSÃO DE UNIDADES DE MEDIDA",
    "prompt": "Registre uma medida de 1 quilômetro em metros.",
    "source": "5-Lista-de-Exercicios-Matematica-EF.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RECONHECIMENTO DE LETRAS",
    "prompt": "Circule, na linha abaixo, todas as letras \"P\": T P B P D P L P R P",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RECONHECIMENTO DE LETRAS",
    "prompt": "Observe o alfabeto e escreva a letra que vem depois de \"J\" e antes de \"N\".",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RECONHECIMENTO DE LETRAS",
    "prompt": "Complete a sequência de letras: F, G, H, __, __, K.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RECONHECIMENTO DE LETRAS",
    "prompt": "Pinte de vermelho as letras maiúsculas e de azul as minúsculas: A e I o T u.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RECONHECIMENTO DE LETRAS",
    "prompt": "Escreva seu sobrenome e circule todas as vogais que aparecem nele.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RECONHECIMENTO DE LETRAS",
    "prompt": "Ligue cada letra maiúscula à sua correspondente minúscula: E - Q - N /// n - q - e.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "SONS E SÍLABAS INICIAIS",
    "prompt": "Escreva três palavras que comecem com a sílaba \"BA\" (ex.: bala).",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "SONS E SÍLABAS INICIAIS",
    "prompt": "Separe em sílabas: janela, sapato, computador, relógio.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "SONS E SÍLABAS INICIAIS",
    "prompt": "Circule a palavra que NÃO começa com o mesmo som das outras: pente, panela, sofá, pipoca.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "SONS E SÍLABAS INICIAIS",
    "prompt": "Complete com a sílaba que falta: __TO (gato), __SA (mesa), __LA (bola).",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "SONS E SÍLABAS INICIAIS",
    "prompt": "Forme cinco palavras diferentes usando as sílabas: TA, TE, TI, TO, TU.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "SONS E SÍLABAS INICIAIS",
    "prompt": "Quantas sílabas tem a palavra \"hospital\"? Separe-a para conferir.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RIMAS E SONS FINAIS",
    "prompt": "Encontre, entre as palavras a seguir, duas que rimam: janela, panela, sapato, cadeira.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RIMAS E SONS FINAIS",
    "prompt": "O gato subiu no muro, e o rato ficou no escuro",
    "kind": "short-text",
    "answer": "escuro",
    "accept": [
      "escuro"
    ],
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RIMAS E SONS FINAIS",
    "prompt": "Escreva uma palavra que rime com \"flor\".",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "RIMAS E SONS FINAIS",
    "prompt": "Escreva uma palavra que rime com \"pão\".",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "FORMAÇÃO E COMPLETAÇÃO DE PALAVRAS",
    "prompt": "Complete as palavras com a letra que falta: _AIXA, _ORTA, _RATO.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "FORMAÇÃO E COMPLETAÇÃO DE PALAVRAS",
    "prompt": "Observe o desenho de um objeto (ex.: relógio, chave, garrafa) e escreva o nome dele.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "FORMAÇÃO E COMPLETAÇÃO DE PALAVRAS",
    "prompt": "Reorganize as letras para formar uma palavra: O-V-R-I-L (livro).",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "FORMAÇÃO E COMPLETAÇÃO DE PALAVRAS",
    "prompt": "Escreva o plural de: flor, animal, papel, limão.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "leitura",
    "level": "N1",
    "topic": "FORMAÇÃO E COMPLETAÇÃO DE PALAVRAS",
    "prompt": "Complete a cruzadinha temática \"Meios de transporte\", usando as palavras: CARRO, MOTO, TREM, AVIÃO, BARCO.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "escrita",
    "level": "N1",
    "topic": "LEITURA E CÓPIA DE FRASES SIMPLES",
    "prompt": "Copie a frase “Use o capacete” e destaque a primeira palavra.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "escrita",
    "level": "N1",
    "topic": "LEITURA E CÓPIA DE FRASES SIMPLES",
    "prompt": "Escreva uma frase curta avisando que a tarefa terminou.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "escrita",
    "level": "N1",
    "topic": "LEITURA E CÓPIA DE FRASES SIMPLES",
    "prompt": "Leia “Pausa às dez” e registre o horário indicado.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "escrita",
    "level": "N1",
    "topic": "LEITURA E CÓPIA DE FRASES SIMPLES",
    "prompt": "Monte uma mensagem simples para chamar um colega.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "compreensao",
    "level": "N1",
    "topic": "INTERPRETAÇÃO E VOCABULÁRIO",
    "prompt": "Leia a palavra “entrada” e escreva uma situação em que ela aparece.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "compreensao",
    "level": "N1",
    "topic": "INTERPRETAÇÃO E VOCABULÁRIO",
    "prompt": "Escolha um aviso do trabalho e explique o que ele quer dizer.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "compreensao",
    "level": "N1",
    "topic": "INTERPRETAÇÃO E VOCABULÁRIO",
    "prompt": "Registre uma palavra que indique ação em uma instrução.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "compreensao",
    "level": "N1",
    "topic": "INTERPRETAÇÃO E VOCABULÁRIO",
    "prompt": "Descreva como uma imagem pode ajudar a entender um aviso.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "escrita",
    "level": "N1",
    "topic": "PRODUÇÃO DE TEXTO CURTA",
    "prompt": "Escreva um aviso curto sobre uma área molhada.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "escrita",
    "level": "N1",
    "topic": "PRODUÇÃO DE TEXTO CURTA",
    "prompt": "Registre uma mensagem informando que faltou material.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  },
  {
    "skill": "escrita",
    "level": "N1",
    "topic": "PRODUÇÃO DE TEXTO CURTA",
    "prompt": "Escreva duas frases contando o que foi feito no turno.",
    "source": "6-Banco-Questoes-Portugues-Alfabetizacao.txt"
  }
];
export const ADDITIONAL_VARIANTS=RAW.map(x=>withCompetencyGuidance(x.kind==='short-text'?{...x,kind:'short-text' as const,answer:x.answer||'',accept:x.accept||[],options:[]}:{...x,kind:'text' as const,answer:'',accept:[],options:[]}));
