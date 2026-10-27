export const PRODUCT_BATCH_SIZE = 40;
export type ProductCursor = { created_at: string; id: string };

export function productFeedCondition(city: string | null | undefined, cursor: ProductCursor | null): string | null {
  const clauses: string[] = [];
  if (city) clauses.push(`or(city.eq.${city},city.is.null)`);
  if (cursor) clauses.push(`or(created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id}))`);
  return clauses.length ? `and(${clauses.join(",")})` : null;
}

export function uniqueProducts<T extends { id: string }>(batches: T[][]): T[] {
  const seen = new Set<string>();
  return batches.flat().filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}