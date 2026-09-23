import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { sendAdminTelegramMessage } from '@/lib/telegram';
import { discountedPrice, effectiveShippingFee, productHasDiscount } from '@/lib/promotion';
import { checkCoupon } from '@/lib/coupons';

export async function POST(req: Request) {
  const body = await req.json();
  const { items, contact, trackingCode, slipImage, sessionId, paymentMethod, shippingArea, couponCode } = body;

  if (!items?.length || !contact?.xAccount || !contact?.name || !contact?.address || !contact?.phone) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(trackingCode)) {
    return NextResponse.json({ error: 'รหัสติดตามต้องเป็นตัวเลข 6 หลัก' }, { status: 400 });
  }
  const validMethod = ['qr', 'wise', 'truewallet'].includes(paymentMethod) ? paymentMethod : 'qr';
  const validArea = shippingArea === 'special' ? 'special' : 'normal';

  const supabase = createAdminSupabase();

  // 1. fetch live product data + active promotion — never trust prices sent
  //    from the browser, always recompute from the source of truth here.
  const productIds = items.map((i: any) => i.productId);
  const { data: products } = await supabase.from('products').select('*').in('id', productIds);
  const { data: promo } = await supabase.from('promotion').select('*').single();

  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ error: 'พบสินค้าที่ไม่ถูกต้องในตะกร้า' }, { status: 400 });
  }

  // basic sanity floor — never let an order ask for more than physically
  // exists, independent of anyone's hold (the /api/reservations step is
  // what actually arbitrates contention between shoppers before this point)
  for (const item of items) {
    const p = products.find((x: any) => x.id === item.productId)!;
    if (item.qty > p.stock) {
      return NextResponse.json({ error: `สินค้า "${p.name}" มีไม่เพียงพอแล้ว` }, { status: 409 });
    }
  }

  // giveaway items are capped at 1 total (across ALL giveaway products
  // combined) per order — never trust the client to have enforced this
  const totalGiveawayQty = items.reduce((a: number, item: any) => {
    const p = products.find((x: any) => x.id === item.productId)!;
    return a + (p.is_giveaway ? item.qty : 0);
  }, 0);
  if (totalGiveawayQty > 1) {
    return NextResponse.json({ error: 'สามารถเลือกของแจกได้สูงสุด 1 ชิ้นต่อออเดอร์' }, { status: 400 });
  }

  const orderItems = items.map((item: any) => {
    const p = products.find((x: any) => x.id === item.productId)!;
    const unitPrice = productHasDiscount(p.id, promo) ? discountedPrice(p.id, p.price, promo) : p.price;
    return { productId: p.id, name: p.name, qty: item.qty, price: unitPrice, image: p.images?.[0] || '' };
  });

  const subtotal = orderItems.reduce((a: number, it: any) => a + it.price * it.qty, 0);
  const rawShippingFee = products.reduce((max: number, p: any) => Math.max(max, p.shipping_fee || 0), 0);
  // free-shipping threshold is checked against the pre-coupon subtotal —
  // a coupon code shouldn't retroactively disqualify a free-shipping tier
  const baseShippingFee = effectiveShippingFee(rawShippingFee, promo, subtotal);
  const areaSurcharge = validArea === 'special' ? 20 : 0;
  const shippingFee = baseShippingFee + areaSurcharge;
  const paymentSurcharge = validMethod === 'truewallet' ? 20 : 0;

  // coupon codes stack on top of the automatic promotion discount, applied
  // to the item subtotal only (not shipping/surcharges) — re-validated here
  // authoritatively regardless of what the client showed as a preview
  let discountAmount = 0;
  let appliedCouponCode: string | null = null;
  let couponRow: any = null;
  if (couponCode) {
    const couponResult = await checkCoupon(couponCode, subtotal);
    if (!couponResult.ok) {
      return NextResponse.json({ error: couponResult.error }, { status: 400 });
    }
    discountAmount = couponResult.discountAmount;
    appliedCouponCode = couponResult.coupon.code;
    couponRow = couponResult.coupon;
  }

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const total = discountedSubtotal + shippingFee + paymentSurcharge;

  // 2. atomically get the next PW-YYMMxxx order number
  const { data: orderNumber, error: numErr } = await supabase.rpc('next_order_number');
  if (numErr || !orderNumber) {
    return NextResponse.json({ error: 'สร้างเลขออเดอร์ไม่สำเร็จ' }, { status: 500 });
  }

  // 3. insert the order (subtotal stays the pre-coupon amount for a clear
  //    audit trail — the coupon's effect is recorded separately)
  const { error: insErr } = await supabase.from('orders').insert({
    order_number: orderNumber,
    status: 'pending',
    items: orderItems, subtotal, shipping_fee: shippingFee, total,
    contact, tracking_code: trackingCode, slip_image: slipImage,
    payment_method: validMethod, payment_surcharge: paymentSurcharge, shipping_area: validArea,
    discount_code: appliedCouponCode, discount_amount: discountAmount,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // claim this use of the coupon — guarded so two simultaneous last-uses
  // of a limited coupon can't both succeed
  if (couponRow) {
    if (couponRow.max_uses != null) {
      await supabase.from('coupons').update({ used_count: couponRow.used_count + 1 }).eq('id', couponRow.id).lt('used_count', couponRow.max_uses);
    } else {
      await supabase.from('coupons').update({ used_count: couponRow.used_count + 1 }).eq('id', couponRow.id);
    }
  }

  // this session's temporary hold is now superseded by the real order's
  // own hold (via orders.status = 'pending'), so release it immediately
  // rather than waiting for the 10-minute reservation to expire on its own
  if (sessionId) {
    await supabase.from('cart_reservations').delete().eq('session_id', sessionId);
  }

  // 4. notify the admin on Telegram
  // (stock is intentionally NOT decremented here — it's deducted only when
  //  the admin confirms the order, see /api/orders/[orderNumber]/confirm)
  await sendAdminTelegramMessage(
    `มีคำสั่งซื้อใหม่รอตรวจสอบสลิป\nเลขออเดอร์: ${orderNumber}\nยอดรวม: ฿${total.toLocaleString('th-TH')}${appliedCouponCode ? `\nโค้ดส่วนลด: ${appliedCouponCode} (-฿${discountAmount.toLocaleString('th-TH')})` : ''}\nช่องทางชำระเงิน: ${validMethod === 'qr' ? 'QR' : validMethod === 'wise' ? 'Wise' : 'TrueWallet'}\nพื้นที่ขนส่ง: ${validArea === 'special' ? 'พิเศษ' : 'ปกติ'}\nลูกค้า: ${contact.name} (${contact.phone})`
  );

  return NextResponse.json({ orderNumber });
}
