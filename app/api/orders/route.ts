import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { sendAdminTelegramMessage } from '@/lib/telegram';
import { discountedPrice, effectiveShippingFee, productHasDiscount } from '@/lib/promotion';

export async function POST(req: Request) {
  const body = await req.json();
  const { items, contact, trackingCode, slipImage, sessionId, paymentMethod, shippingArea } = body;

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
  const baseShippingFee = effectiveShippingFee(rawShippingFee, promo, subtotal);
  const areaSurcharge = validArea === 'special' ? 20 : 0;
  const shippingFee = baseShippingFee + areaSurcharge;
  const paymentSurcharge = validMethod === 'truewallet' ? 20 : 0;
  const total = subtotal + shippingFee + paymentSurcharge;

  // 2. atomically get the next PW-YYMMxxx order number
  const { data: orderNumber, error: numErr } = await supabase.rpc('next_order_number');
  if (numErr || !orderNumber) {
    return NextResponse.json({ error: 'สร้างเลขออเดอร์ไม่สำเร็จ' }, { status: 500 });
  }

  // 3. insert the order
  const { error: insErr } = await supabase.from('orders').insert({
    order_number: orderNumber,
    status: 'pending',
    items: orderItems, subtotal, shipping_fee: shippingFee, total,
    contact, tracking_code: trackingCode, slip_image: slipImage,
    payment_method: validMethod, payment_surcharge: paymentSurcharge, shipping_area: validArea,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
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
    `มีคำสั่งซื้อใหม่รอตรวจสอบสลิป\nเลขออเดอร์: ${orderNumber}\nยอดรวม: ฿${total.toLocaleString('th-TH')}\nช่องทางชำระเงิน: ${validMethod === 'qr' ? 'QR' : validMethod === 'wise' ? 'Wise' : 'TrueWallet'}\nพื้นที่ขนส่ง: ${validArea === 'special' ? 'พิเศษ' : 'ปกติ'}\nลูกค้า: ${contact.name} (${contact.phone})`
  );

  return NextResponse.json({ orderNumber });
}
