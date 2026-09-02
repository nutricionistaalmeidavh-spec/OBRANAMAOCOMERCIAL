export type PracticeSkillId =
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

export type GameProgressRecord = {
  runId: string;
  activityId: string;
  baseActivityId?: string;
  variantId?: string;
  variantSeed?: number;
  variantFingerprint?: string;
  contentKeys?: string[];
  skillId: PracticeSkillId;
  difficulty: 1 | 2 | 3 | 4 | 5;
  curriculumRefs: string[];
  originUnitId?: string;
  unitId?: string;
  gameType: 'crossword' | 'domino-math' | 'word-search' | 'matching' | 'ordering' | 'memory' | 'quiz' | 'fill-blank' | 'true-false' | 'quick-quiz' | 'classification' | 'decision' | 'simulation' | 'calculation' | 'budget' | 'cash-classification' | 'word-map' | 'sentence-puzzle' | 'dictation' | 'image-discovery' | 'daily-problem' | 'mission';
  score: number;
  correctAnswers: number;
  mistakes: number;
  hintsUsed: number;
  durationSec: number;
  completedAt: string;
};

const UNIT = /^(leitura|compreensao|adicao|multiplicacao|divisao|porcentagem|medidas)-N[1-5]$/;
const UNIT_TO_SKILL = {
  'leitura-N1': 'reading.alphabet',
  'leitura-N2': 'reading.instructions',
  'leitura-N3': 'reading.messages',
  'compreensao-N2': 'comprehension.fact-opinion-consequence',
  'compreensao-N3': 'comprehension.instructions-responsibility',
  'compreensao-N5': 'comprehension.critical-reading',
  'adicao-N2': 'math.addition',
  'adicao-N3': 'math.addition',
  'multiplicacao-N2': 'math.multiplication',
  'multiplicacao-N3': 'math.multiplication',
  'divisao-N2': 'math.division',
  'porcentagem-N1': 'math.percentage',
  'porcentagem-N2': 'math.percentage',
  'porcentagem-N3': 'math.percentage',
  'porcentagem-N5': 'math.percentage',
  'medidas-N1': 'math.measurements',
  'medidas-N2': 'math.measurements',
} as const;
const PRACTICE_SKILLS = new Set<PracticeSkillId>(Object.values(UNIT_TO_SKILL));
const ALLOWED_GAME_TYPES: GameProgressRecord['gameType'][] = ['crossword','domino-math','word-search','matching','ordering','memory','quiz','fill-blank','true-false','quick-quiz','classification','decision','simulation','calculation','budget','cash-classification','word-map','sentence-puzzle','dictation','image-discovery','daily-problem','mission'];
const rec = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

export function isEducationUnitId(value: string) { return UNIT.test(value); }
export function isPracticeSkillId(value: string): value is PracticeSkillId { return PRACTICE_SKILLS.has(value as PracticeSkillId); }

export function practiceSkillForEducationUnit(unitId: string): PracticeSkillId | undefined {
  const reviewed = UNIT_TO_SKILL[unitId as keyof typeof UNIT_TO_SKILL];
  if (reviewed) return reviewed;
  const domain = unitId.split('-N')[0];
  if (domain === 'adicao') return 'math.addition';
  if (domain === 'multiplicacao') return 'math.multiplication';
  if (domain === 'divisao') return 'math.division';
  if (domain === 'porcentagem') return 'math.percentage';
  if (domain === 'medidas') return 'math.measurements';
  if (domain === 'leitura') {
    const level = levelFromUnit(unitId) || 1;
    return level === 1 ? 'reading.alphabet' : level === 2 ? 'reading.instructions' : 'reading.messages';
  }
  if (domain === 'compreensao') {
    const level = levelFromUnit(unitId) || 1;
    return level <= 2 ? 'comprehension.fact-opinion-consequence' : level === 3 ? 'comprehension.instructions-responsibility' : 'comprehension.critical-reading';
  }
  return undefined;
}

function text(value: unknown, max: number) { return String(value || '').trim().slice(0, max); }
function keys(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => text(item, 100)).filter(Boolean))].slice(0, 48);
}
function units(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => text(item, 80)).filter(item => UNIT.test(item)))].slice(0, 24);
}
function levelFromUnit(unitId: string) {
  const match = /-N([1-5])$/.exec(unitId);
  return match ? Number(match[1]) as 1 | 2 | 3 | 4 | 5 : undefined;
}

export function normalizeGameProgress(input: unknown): GameProgressRecord | null {
  const value = rec(input);
  const activityId = text(value.activityId, 120);
  const baseActivityId = text(value.baseActivityId, 120) || activityId;
  const variantId = text(value.variantId, 180) || undefined;
  const variantFingerprint = text(value.variantFingerprint, 120) || undefined;
  const unitIdRaw = text(value.unitId, 80);
  const unitId = UNIT.test(unitIdRaw) ? unitIdRaw : undefined;
  const originRaw = text(value.originUnitId, 80);
  const originUnitId = originRaw ? (UNIT.test(originRaw) ? originRaw : undefined) : unitId;
  if (originRaw && !originUnitId) return null;
  const curriculumRefs = units(value.curriculumRefs);
  if (Array.isArray(value.curriculumRefs) && curriculumRefs.length !== value.curriculumRefs.filter(Boolean).length) return null;
  const refs = curriculumRefs.length ? curriculumRefs : originUnitId ? [originUnitId] : unitId ? [unitId] : [];
  const explicitSkill = text(value.skillId, 100);
  const inferredSkill = unitId ? practiceSkillForEducationUnit(unitId) : originUnitId ? practiceSkillForEducationUnit(originUnitId) : refs[0] ? practiceSkillForEducationUnit(refs[0]) : undefined;
  const skillId = explicitSkill ? (isPracticeSkillId(explicitSkill) ? explicitSkill : undefined) : inferredSkill;
  if (!skillId) return null;
  if (explicitSkill && inferredSkill && explicitSkill !== inferredSkill) return null;
  if (refs.some(ref => practiceSkillForEducationUnit(ref) !== skillId)) return null;
  if (originUnitId && practiceSkillForEducationUnit(originUnitId) !== skillId) return null;
  if (unitId && practiceSkillForEducationUnit(unitId) !== skillId) return null;
  const difficultyRaw = Number(value.difficulty);
  const inferredDifficulty = unitId ? levelFromUnit(unitId) : originUnitId ? levelFromUnit(originUnitId) : refs[0] ? levelFromUnit(refs[0]) : undefined;
  const difficulty = Number.isInteger(difficultyRaw) && difficultyRaw >= 1 && difficultyRaw <= 5 ? difficultyRaw as 1 | 2 | 3 | 4 | 5 : inferredDifficulty;
  const gameType = text(value.gameType, 60) as GameProgressRecord['gameType'];
  const completedAt = text(value.completedAt, 80);
  if (!activityId || !difficulty || !ALLOWED_GAME_TYPES.includes(gameType) || !Number.isFinite(Date.parse(completedAt))) return null;
  const variantSeedRaw = Number(value.variantSeed);
  const variantSeed = Number.isFinite(variantSeedRaw) ? Math.max(1, Math.min(4294967295, Math.floor(variantSeedRaw))) : undefined;
  const runId = text(value.runId, 220) || `${baseActivityId}:${variantFingerprint || 'fixed'}:${completedAt}`.slice(0, 220);
  return {
    runId, activityId, baseActivityId, variantId, variantSeed, variantFingerprint, contentKeys: keys(value.contentKeys),
    skillId, difficulty, curriculumRefs: refs, originUnitId, unitId, gameType,
    score: Math.max(0, Math.min(100, Math.round(Number(value.score || 0)))),
    correctAnswers: Math.max(0, Math.min(100, Math.floor(Number(value.correctAnswers || 0)))),
    mistakes: Math.max(0, Math.min(999, Math.floor(Number(value.mistakes || 0)))),
    hintsUsed: Math.max(0, Math.min(99, Math.floor(Number(value.hintsUsed || 0)))),
    durationSec: Math.max(1, Math.min(14400, Math.floor(Number(value.durationSec || 1)))),
    completedAt,
  };
}
