export type Promotion = {
  active: boolean;
  discount_active: boolean;
  discount_percent: number;
  discount_scope: 'all' | 'selected';
  discount_product_ids: string[];
  free_shipping_active: boolean;
  free_shipping_min_amount: number;
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

// Is free shipping switched on at all, regardless of any minimum-spend
// threshold? Use this for badges/copy that don't know the cart subtotal yet.
export function isFreeShippingEnabled(promo: Promotion | null | undefined): boolean {
  return isPromotionLive(promo) && !!promo?.free_shipping_active;
}

// Is free shipping switched on AND has no minimum-spend requirement?
// Safe to use for per-product "free shipping" badges (no cart context needed).
export function isFreeShippingUnconditional(promo: Promotion | null | undefined): boolean {
  return isFreeShippingEnabled(promo) && !((promo?.free_shipping_min_amount || 0) > 0);
}

// Does free shipping actually apply RIGHT NOW, given this cart subtotal?
// (accounts for the minimum-spend threshold, if one is set)
export function isFreeShippingLive(promo: Promotion | null | undefined, subtotal: number): boolean {
  if (!isFreeShippingEnabled(promo)) return false;
  const minAmount = promo?.free_shipping_min_amount || 0;
  if (minAmount > 0 && subtotal < minAmount) return false;
  return true;
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

export function effectiveShippingFee(fee: number, promo: Promotion | null | undefined, subtotal: number): number {
  if (isFreeShippingLive(promo, subtotal)) return 0;
  return fee;
}
