export type ProductDiscount = {
  originalPrice: number;
  discountPercent: number;
};

export function getProductDiscount(
  currentPrice: number,
  originalPrice: number | null | undefined,
): ProductDiscount | null {
  const current = Number(currentPrice);
  const original = Number(originalPrice);

  if (!Number.isFinite(current) || !Number.isFinite(original) || current < 0 || original <= current) {
    return null;
  }

  return {
    originalPrice: original,
    discountPercent: Math.round(((original - current) / original) * 100),
  };
}