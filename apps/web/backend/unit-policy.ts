export type ObjectiveStat = { attempts: number; errors: number };

export type ConsolidationResult = {
  totalItems: number;
  correctItems: number;
  consolidated: boolean;
};

export function evaluateObjectiveConsolidation(
  stats: ObjectiveStat[],
  expectedItems = 3,
): ConsolidationResult {
  const expected = Math.max(1, Math.min(20, Math.floor(expectedItems)));
  const items = stats.slice(0, expected);
  const correctItems = items.filter((item) => item.attempts >= 1 && item.attempts > item.errors).length;
  return {
    totalItems: expected,
    correctItems,
    consolidated: items.length === expected && correctItems === expected,
  };
}
