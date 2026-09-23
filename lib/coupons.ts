import { createAdminSupabase } from './supabase/admin';

export type CouponCheckResult =
  | { ok: true; coupon: any; discountAmount: number }
  | { ok: false; error: string };

// subtotal here should be the subtotal AFTER the automatic storewide
// promotion discount (if any) has already been applied — coupon codes
// stack on top of that, not on the original pre-promotion price.
export async function checkCoupon(codeRaw: string, subtotal: number): Promise<CouponCheckResult> {
  const code = (codeRaw || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'กรุณาใส่โค้ดส่วนลด' };

  const supabase = createAdminSupabase();
  const { data: coupon } = await supabase.from('coupons').select('*').eq('code', code).single();
  if (!coupon) return { ok: false, error: 'ไม่พบโค้ดนี้' };
  if (!coupon.active) return { ok: false, error: 'โค้ดนี้ถูกปิดใช้งานแล้ว' };

  const now = Date.now();
  if (coupon.starts_at && now < new Date(coupon.starts_at).getTime()) return { ok: false, error: 'โค้ดนี้ยังไม่เริ่มใช้งาน' };
  if (coupon.ends_at && now > new Date(coupon.ends_at).getTime()) return { ok: false, error: 'โค้ดนี้หมดอายุแล้ว' };
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) return { ok: false, error: 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว' };
  if (subtotal < Number(coupon.min_order_amount || 0)) {
    return { ok: false, error: `ยอดสั่งซื้อต้องถึง ฿${Number(coupon.min_order_amount).toLocaleString('th-TH')} ขึ้นไปถึงจะใช้โค้ดนี้ได้` };
  }

  const discountAmount = coupon.discount_type === 'percent'
    ? Math.round(subtotal * (Number(coupon.discount_value) / 100) * 100) / 100
    : Math.min(Number(coupon.discount_value), subtotal);

  return { ok: true, coupon, discountAmount };
}
