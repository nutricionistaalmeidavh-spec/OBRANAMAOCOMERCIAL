export type SupportExcerpt = { essential: string; complementary: string };

const normalize = (value: string) => value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
const FALLBACK: Record<string, string> = {
  divisao: 'Dividir é repartir uma quantidade em grupos iguais. Confira multiplicando o resultado pelo número de grupos.',
  multiplicacao: 'Multiplicar é somar grupos iguais. Identifique a quantidade de grupos e quantos itens há em cada grupo.',
  porcentagem: 'Porcentagem representa uma parte de 100. Identifique o valor total e a porcentagem solicitada.',
  medidas: 'Observe a grandeza e a unidade pedida antes de converter ou comparar valores.',
  adicao: 'Organize as quantidades, identifique entradas e saídas e confira a operação escolhida.',
  leitura: 'Leia uma informação por vez e localize no texto exatamente o que foi solicitado.',
  compreensao: 'Localize a ideia principal e use uma informação do texto para justificar sua resposta.',
  escrita: 'Planeje a mensagem, escreva uma ideia por frase e revise clareza e pontuação.',
  seguranca: 'Identifique o risco, confira a orientação da atividade e escolha a ação que protege as pessoas.',
  direitos: 'Compare os fatos e registros antes de escolher o canal ou encaminhamento adequado.',
  saude: 'Observe os sinais, interrompa a exposição quando necessário e comunique o responsável.',
  tecnologia: 'Confira a origem da informação, proteja os dados e confirme a ação antes de continuar.',
};

export function selectSupportExcerpt(input: { material: string; competency: string; level: string; topic: string; maxEssential?: number; maxComplementary?: number }): SupportExcerpt {
  const maxEssential = input.maxEssential ?? 560, maxComplementary = input.maxComplementary ?? 760;
  const lines = String(input.material || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  // Restringe a busca ao bloco do nível antes de procurar o tema. Isso evita
  // que uma palavra comum encontre explicação de outro nível/competência.
  const levelMatch = String(input.level || '').match(/N([1-5])/i);
  const levelIndex = levelMatch ? lines.findIndex(line => new RegExp('NÍVEL\\s*' + levelMatch[1] + '\\b', 'i').test(line)) : -1;
  const nextLevelIndex = levelIndex >= 0 ? lines.findIndex((line, index) => index > levelIndex && /NÍVEL\s*[1-5]\b/i.test(line)) : -1;
  const scopedLines = levelIndex >= 0 ? lines.slice(levelIndex, nextLevelIndex >= 0 ? nextLevelIndex : lines.length) : lines;
  const terms = normalize(input.topic).split(' ').filter(x => x.length >= 4);
  const start = scopedLines.findIndex(line => terms.some(term => normalize(line).includes(term)));
  if (start < 0) return { essential: (FALLBACK[input.competency] || FALLBACK.leitura).slice(0, maxEssential), complementary: '' };
  const section = scopedLines.slice(start, start + 10);
  const nextHeading = section.slice(1).findIndex(line => /^\d+\.\s/.test(line));
  const selected = section.slice(0, nextHeading >= 0 ? nextHeading + 1 : section.length);
  const essential = selected.slice(0, 4).join('\n').slice(0, maxEssential);
  const complementary = selected.slice(4).join('\n').slice(0, maxComplementary);
  return { essential, complementary };
}

