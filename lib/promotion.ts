export type Promotion = {
  active: boolean;
  discount_active: boolean;
  discount_percent: number;
  discount_scope: 'all' | 'selected';
  discount_product_ids: string[];
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

// Is the discount feature switched on at all (regardless of which products
// it applies to)? Useful for banners/badges that don't need a specific product.
export function isDiscountLive(promo: Promotion | null | undefined): boolean {
  return isPromotionLive(promo) && !!promo?.discount_active && (promo?.discount_percent || 0) > 0;
}

export function isFreeShippingLive(promo: Promotion | null | undefined): boolean {
  return isPromotionLive(promo) && !!promo?.free_shipping_active;
}

// Does THIS specific product currently get the discount?
// (accounts for the "only selected products" scope)
export function productHasDiscount(productId: string, promo: Promotion | null | undefined): boolean {
  if (!isDiscountLive(promo)) return false;
  if (promo!.discount_scope === 'selected') {
    return (promo!.discount_product_ids || []).includes(productId);
  }
  return true; // scope === 'all'
}

export function discountedPrice(productId: string, price: number, promo: Promotion | null | undefined): number {
  if (!productHasDiscount(productId, promo)) return price;
  const pct = promo!.discount_percent;
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}

export function effectiveShippingFee(fee: number, promo: Promotion | null | undefined): number {
  if (isFreeShippingLive(promo)) return 0;
  return fee;
}
