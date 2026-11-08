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

/* ---------------- Roleta Derdalax ----------------
 * Mirrors public.roleta_apply_to_order on the server (server is the source of truth).
 * Roleta % applies to the reference price (original_price when the unit is the
 * base price and a valid promotion exists, otherwise the unit price), capped by
 * the campaign MT limit. Never stacked: the lower of promo price vs roleta price wins.
 */
export type RoletaReward = { percent: number; max_discount_mt: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export type RoletaLineResult = {
  applies: boolean;
  unitBefore: number;
  unitFinal: number;
  lineDiscount: number; // vs current price
  capUsed: number;
};

export function getRoletaLine(
  unitPrice: number,
  basePrice: number,
  originalPrice: number | null | undefined,
  quantity: number,
  reward: RoletaReward | null | undefined,
  remainingCap?: number,
): RoletaLineResult {
  const unit = Number(unitPrice);
  const none = { applies: false, unitBefore: unit, unitFinal: unit, lineDiscount: 0, capUsed: 0 };
  if (!reward || reward.percent <= 0 || !(unit > 0) || quantity <= 0) return none;
  const cap = remainingCap ?? Number(reward.max_discount_mt);
  if (cap <= 0) return none;
  const orig = Number(originalPrice ?? 0);
  const ref = unit === Number(basePrice) && orig > Number(basePrice) ? orig : unit;
  const amt = Math.min(r2((ref * reward.percent) / 100 * quantity), cap);
  const line = ref * quantity - amt;
  if (line >= unit * quantity) return none;
  const unitFinal = r2(line / quantity);
  return { applies: true, unitBefore: unit, unitFinal, lineDiscount: r2((unit - unitFinal) * quantity), capUsed: amt };
}

export type RoletaCartLine = { key: string; unitPrice: number; basePrice: number; originalPrice: number | null; quantity: number; eligible: boolean };

export function getRoletaCart(lines: RoletaCartLine[], reward: RoletaReward | null | undefined) {
  const byKey = new Map<string, RoletaLineResult>();
  let remaining = reward ? Number(reward.max_discount_mt) : 0;
  let total = 0;
  const sorted = [...lines].filter((l) => l.eligible).sort((a, b) => b.unitPrice - a.unitPrice);
  for (const l of sorted) {
    if (remaining <= 0) break;
    const res = getRoletaLine(l.unitPrice, l.basePrice, l.originalPrice, l.quantity, reward, remaining);
    if (res.applies) {
      remaining -= res.capUsed;
      total += res.lineDiscount;
      byKey.set(l.key, res);
    }
  }
  return { byKey, discount: r2(total) };
}
