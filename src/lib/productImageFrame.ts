export const MIN_PRODUCT_ASPECT = 3 / 4;
export const MAX_PRODUCT_ASPECT = 4 / 3;

export function productImageAspect(width: number, height: number, rotation = 0): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
  const sideways = Math.abs(rotation % 180) === 90;
  const ratio = sideways ? height / width : width / height;
  return Math.max(MIN_PRODUCT_ASPECT, Math.min(MAX_PRODUCT_ASPECT, ratio));
}