import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { sendAdminTelegramMessage } from '@/lib/telegram';
import { isDiscountLive, isFreeShippingLive, discountedPrice, effectiveShippingFee } from '@/lib/promotion';

export async function POST(req: Request) {
  const body = await req.json();
  const { items, contact, trackingCode, slipImage } = body;

  if (!items?.length || !contact?.xAccount || !contact?.name || !contact?.address || !contact?.phone) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(trackingCode)) {
    return NextResponse.json({ error: 'รหัสติดตามต้องเป็นตัวเลข 6 หลัก' }, { status: 400 });
  }

  const supabase = createAdminSupabase();

  // 1. fetch live product data + active promotion — never trust prices sent
  //    from the browser, always recompute from the source of truth here.
  const productIds = items.map((i: any) => i.productId);
  const { data: products } = await supabase.from('products').select('*').in('id', productIds);
  const { data: promo } = await supabase.from('promotion').select('*').single();

  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ error: 'พบสินค้าที่ไม่ถูกต้องในตะกร้า' }, { status: 400 });
  }

  const discountLive = isDiscountLive(promo);
  const orderItems = items.map((item: any) => {
    const p = products.find((x) => x.id === item.productId)!;
    const unitPrice = discountLive ? discountedPrice(p.price, promo) : p.price;
    return { productId: p.id, name: p.name, qty: item.qty, price: unitPrice, image: p.images?.[0] || '' };
  });

  const subtotal = orderItems.reduce((a: number, it: any) => a + it.price * it.qty, 0);
  const rawShippingFee = products.reduce((max: number, p: any) => Math.max(max, p.shipping_fee || 0), 0);
  const shippingFee = effectiveShippingFee(rawShippingFee, promo);
  const total = subtotal + shippingFee;

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
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // 4. notify the admin on Telegram
  // (stock is intentionally NOT decremented here — it's deducted only when
  //  the admin confirms the order, see /api/orders/[orderNumber]/confirm)
  await sendAdminTelegramMessage(
    `มีคำสั่งซื้อใหม่รอตรวจสอบสลิป\nเลขออเดอร์: ${orderNumber}\nยอดรวม: ฿${total.toLocaleString('th-TH')}\nลูกค้า: ${contact.name} (${contact.phone})`
  );

  return NextResponse.json({ orderNumber });
}
