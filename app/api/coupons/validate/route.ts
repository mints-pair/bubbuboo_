import { NextResponse } from 'next/server';
import { checkCoupon } from '@/lib/coupons';

export async function POST(req: Request) {
  const { code, subtotal } = await req.json().catch(() => ({}));
  const result = await checkCoupon(code, Number(subtotal) || 0);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, discountAmount: result.discountAmount, code: result.coupon.code });
}
