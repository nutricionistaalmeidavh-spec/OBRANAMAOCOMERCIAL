export type OpenResponse = {
  question: string;
  response: string;
  itemIndex: number;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function normalizeOpenResponses(value: unknown): OpenResponse[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(entry => {
      const item = record(entry);
      return {
        question: String(item.question || '').trim().slice(0, 1000),
        response: String(item.response || '').trim().slice(0, 4000),
        itemIndex: Math.max(0, Math.floor(Number(item.itemIndex || 0))),
      };
    })
    .filter(entry => entry.response.length > 0)
    .slice(0, 10);
}

export function hasActivePendingReview(status: unknown, reviews: unknown, unit: string) {
  return status === 'pending_review'
    && Array.isArray(reviews)
    && reviews.some(review => String(record(review).unit || '') === unit);
}
