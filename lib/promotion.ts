export type Promotion = {
  active: boolean;
  discount_active: boolean;
  discount_percent: number;
  free_shipping_active: boolean;
  label: string;
  start_at: string | null;
  end_at: string | null;
};

// Whether the promotion is currently in effect right now, accounting for
// the manual "active" switch AND the optional schedule window.
export function isPromotionLive(promo: Promotion | null | undefined): boolean {
  if (!promo || !promo.active) return false;
  const now = Date.now();
  if (promo.start_at && now < new Date(promo.start_at).getTime()) return false;
  if (promo.end_at && now > new Date(promo.end_at).getTime()) return false;
  return true;
}

export function isDiscountLive(promo: Promotion | null | undefined): boolean {
  return isPromotionLive(promo) && !!promo?.discount_active && (promo?.discount_percent || 0) > 0;
}

export function isFreeShippingLive(promo: Promotion | null | undefined): boolean {
  return isPromotionLive(promo) && !!promo?.free_shipping_active;
}

export function discountedPrice(price: number, promo: Promotion | null | undefined): number {
  if (!isDiscountLive(promo)) return price;
  const pct = promo!.discount_percent;
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}

export function effectiveShippingFee(fee: number, promo: Promotion | null | undefined): number {
  if (isFreeShippingLive(promo)) return 0;
  return fee;
}
