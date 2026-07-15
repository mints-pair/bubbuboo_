import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { sendAdminTelegramMessage } from '@/lib/telegram';

export async function POST(req: Request) {
  const body = await req.json();
  const { items, subtotal, shippingFee, total, contact, trackingCode, slipImage } = body;

  if (!items?.length || !contact?.name || !contact?.address || !contact?.phone) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(trackingCode)) {
    return NextResponse.json({ error: 'รหัสติดตามต้องเป็นตัวเลข 6 หลัก' }, { status: 400 });
  }

  const supabase = createAdminSupabase();

  // 1. atomically get the next PW-YYMMxxx order number
  const { data: orderNumber, error: numErr } = await supabase.rpc('next_order_number');
  if (numErr || !orderNumber) {
    return NextResponse.json({ error: 'สร้างเลขออเดอร์ไม่สำเร็จ' }, { status: 500 });
  }

  // 2. insert the order
  const { error: insErr } = await supabase.from('orders').insert({
    order_number: orderNumber,
    status: 'pending',
    items, subtotal, shipping_fee: shippingFee, total,
    contact, tracking_code: trackingCode, slip_image: slipImage,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // 3. notify the admin on Telegram
  // (stock is intentionally NOT decremented here — it's deducted only when
  //  the admin confirms the order, see /api/orders/[orderNumber]/confirm)
  await sendAdminTelegramMessage(
    `มีคำสั่งซื้อใหม่รอตรวจสอบสลิป\nเลขออเดอร์: ${orderNumber}\nยอดรวม: ฿${total.toLocaleString('th-TH')}\nลูกค้า: ${contact.name} (${contact.phone})`
  );

  return NextResponse.json({ orderNumber });
}
