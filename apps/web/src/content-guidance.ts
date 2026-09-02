type VariantSkill = 'leitura' | 'compreensao' | 'escrita' | 'adicao' | 'multiplicacao' | 'divisao' | 'porcentagem' | 'medidas';
type VariantKind = 'choice' | 'short-text' | 'text';

type VariantForGuidance = {
  skill: VariantSkill;
  topic: string;
  prompt: string;
  kind: VariantKind;
  answer: string;
  accept?: string[];
  options?: string[];
};

const GUIDANCE: Record<VariantSkill, { hint: string; reviewCriteria: string; minLength: number }> = {
  leitura: {
    hint: 'Leia com atenção e registre a palavra ou informação solicitada.',
    reviewCriteria: 'Confere a leitura e a resposta solicitada pelo enunciado.',
    minLength: 2,
  },
  compreensao: {
    hint: 'Explique a ideia central com o exemplo ou a relação pedida.',
    reviewCriteria: 'Confere compreensão do conteúdo e pertinência da explicação.',
    minLength: 12,
  },
  escrita: {
    hint: 'Escreva uma resposta clara, direta e adequada à situação apresentada.',
    reviewCriteria: 'Confere clareza, completude e adequação da produção escrita.',
    minLength: 12,
  },
  adicao: {
    hint: 'Use os dados apresentados e registre o resultado ou a estratégia solicitada.',
    reviewCriteria: 'Confere o uso dos dados e a coerência do resultado ou da estratégia.',
    minLength: 2,
  },
  multiplicacao: {
    hint: 'Organize os grupos ou dados apresentados antes de registrar a resposta.',
    reviewCriteria: 'Confere a relação entre grupos, dados e resposta apresentada.',
    minLength: 2,
  },
  divisao: {
    hint: 'Considere a repartição indicada e registre o resultado solicitado.',
    reviewCriteria: 'Confere a repartição dos dados e a coerência do resultado.',
    minLength: 2,
  },
  porcentagem: {
    hint: 'Use os valores informados para calcular ou justificar a resposta solicitada.',
    reviewCriteria: 'Confere a relação entre valores, percentual e resposta apresentada.',
    minLength: 2,
  },
  medidas: {
    hint: 'Identifique a medida, unidade ou instrumento adequado à situação.',
    reviewCriteria: 'Confere a adequação da medida, unidade ou instrumento informado.',
    minLength: 3,
  },
};

// Calibração editorial explícita. Só respostas unitárias já revisadas recebem 1;
// tarefas de lista, sequência ou produção mantêm o mínimo compatível com a entrega.
const OPEN_RESPONSE_MIN_LENGTH: Record<string, number> = {
  'Escreva os números de 1 a 20 em ordem crescente.': 40,
  'Escreva três palavras que comecem com a sílaba "BA" (ex.: bala).': 12,
  'Separe em sílabas: janela, sapato, computador, relógio.': 20,
  'Forme cinco palavras diferentes usando as sílabas: TA, TE, TI, TO, TU.': 20,
  'Escreva duas frases contando o que foi feito no turno.': 40,
  'Circule o número que está fora da sequência: 1, 2, 3, 4, 6, 5.': 1,
  'Circule o número maior: 6 ou 9.': 1,
  'Circule o número menor: 12 ou 7.': 1,
  'Resolva: 3 + 4 = __': 1,
  'Resolva: 9 - 5 = __': 1,
  'Complete os pares: 6 + __ = 10': 1,
  'Complete os pares: 15 - __ = 8': 1,
  'Escreva uma palavra que rime com "flor".': 1,
  'Escreva uma palavra que rime com "pão".': 1,
  'Observe o desenho de um objeto (ex.: relógio, chave, garrafa) e escreva o nome dele.': 1,
  'Registre uma palavra que indique ação em uma instrução.': 1,
  'Cite uma palavra ou expressão que indique tempo.': 1,
};

const optionForAnswer = (answer: string, options: string[] = []) => {
  const label = answer.match(/^([a-e])(?:\)|\.)?\s*/i)?.[1];
  if (!label) return answer;
  return options[label.toLowerCase().charCodeAt(0) - 97] || answer;
};

export const withCompetencyGuidance = <T extends VariantForGuidance>(variant: T) => {
  const guidance = GUIDANCE[variant.skill];
  const minLength = OPEN_RESPONSE_MIN_LENGTH[variant.prompt] ?? guidance.minLength;
  const answer = variant.kind === 'choice' ? optionForAnswer(variant.answer, variant.options) : variant.answer;
  const accept = variant.kind === 'choice'
    ? (variant.accept || []).map(value => optionForAnswer(value, variant.options))
    : variant.accept;
  const base = {
    ...variant,
    answer,
    ...(accept ? { accept } : {}),
    hint: `${guidance.hint} Tema: ${variant.topic}.`,
  };

  return variant.kind === 'text'
    ? {
      ...base,
      minLength,
      reviewCriteria: `${guidance.reviewCriteria} Tema declarado: ${variant.topic}.`,
    }
    : base;
};
