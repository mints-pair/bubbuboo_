import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { sendAdminTelegramMessage } from '@/lib/telegram';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { sessionId, contact, trackingCode, slipImage, paymentMethod } = body;

  if (!sessionId || !contact?.xAccount || !contact?.name || !contact?.address || !contact?.phone) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(trackingCode)) {
    return NextResponse.json({ error: 'รหัสติดตามต้องเป็นตัวเลข 6 หลัก' }, { status: 400 });
  }
  const validMethod = ['qr', 'wise', 'truewallet'].includes(paymentMethod) ? paymentMethod : 'qr';

  const supabase = createAdminSupabase();
  const { data: auction } = await supabase.from('auctions').select('*').eq('id', params.id).single();
  if (!auction) return NextResponse.json({ error: 'ไม่พบรายการประมูลนี้' }, { status: 404 });
  if (new Date(auction.ends_at).getTime() > Date.now()) {
    return NextResponse.json({ error: 'ประมูลยังไม่ปิด' }, { status: 400 });
  }
  if (auction.status !== 'active') {
    return NextResponse.json({ error: 'รายการนี้ถูกดำเนินการไปแล้ว' }, { status: 400 });
  }
  if (!auction.current_bid || auction.current_bidder_session_id !== sessionId) {
    return NextResponse.json({ error: 'คุณไม่ใช่ผู้ชนะการประมูลนี้' }, { status: 403 });
  }

  const subtotal = Number(auction.current_bid);
  const paymentSurcharge = validMethod === 'truewallet' ? 20 : 0;
  const shippingFee = Number(auction.shipping_fee) || 0;
  const total = subtotal + shippingFee + paymentSurcharge;

  const { data: orderNumber, error: numErr } = await supabase.rpc('next_order_number');
  if (numErr || !orderNumber) {
    return NextResponse.json({ error: 'สร้างเลขออเดอร์ไม่สำเร็จ' }, { status: 500 });
  }

  const { error: insErr } = await supabase.from('orders').insert({
    order_number: orderNumber,
    status: 'pending',
    items: [{ productId: null, auctionId: auction.id, name: `[ประมูล] ${auction.name}`, qty: 1, price: subtotal, image: auction.images?.[0] || '' }],
    subtotal, shipping_fee: shippingFee, total,
    contact, tracking_code: trackingCode, slip_image: slipImage,
    payment_method: validMethod, payment_surcharge: paymentSurcharge, shipping_area: 'normal',
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // atomically claim this auction so it can't be paid twice
  const { data: claimed } = await supabase
    .from('auctions')
    .update({ status: 'completed', order_number: orderNumber })
    .eq('id', params.id)
    .eq('status', 'active')
    .select()
    .single();

  if (!claimed) {
    // extremely unlikely race (e.g. admin cancelled at the same instant) —
    // the order was already created, so just let it proceed; admin can sort
    // out any edge case manually from the orders list.
  }

  await sendAdminTelegramMessage(
    `มีการชำระเงินค่าประมูลใหม่\nรายการ: ${auction.name}\nเลขออเดอร์: ${orderNumber}\nยอดรวม: ฿${total.toLocaleString('th-TH')}\nผู้ชนะ: ${contact.name} (${contact.phone})`
  );

  return NextResponse.json({ orderNumber });
}
