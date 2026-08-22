import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authed = createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { contact, trackingCode, slipImage, paymentMethod, note } = body;

  if (!contact?.xAccount || !contact?.name || !contact?.address || !contact?.phone) {
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
  if (!auction.current_bid) {
    return NextResponse.json({ error: 'ประมูลนี้ไม่มีผู้ชนะ' }, { status: 400 });
  }

  const subtotal = Number(auction.current_bid);
  const paymentSurcharge = validMethod === 'truewallet' ? 20 : 0;
  const shippingFee = Number(auction.shipping_fee) || 0;
  const total = subtotal + shippingFee + paymentSurcharge;

  const { data: orderNumber, error: numErr } = await supabase.rpc('next_order_number');
  if (numErr || !orderNumber) {
    return NextResponse.json({ error: 'สร้างเลขออเดอร์ไม่สำเร็จ' }, { status: 500 });
  }

  // admin is personally vouching for this payment, so this order skips the
  // "pending, needs slip review" step and goes straight to confirmed —
  // ready for the admin to enter shipping info right away
  const { error: insErr } = await supabase.from('orders').insert({
    order_number: orderNumber,
    status: 'confirmed',
    items: [{ productId: null, auctionId: auction.id, name: `[ประมูล] ${auction.name}`, qty: 1, price: subtotal, image: auction.images?.[0] || '' }],
    subtotal, shipping_fee: shippingFee, total,
    contact, tracking_code: trackingCode, slip_image: slipImage || null,
    payment_method: validMethod, payment_surcharge: paymentSurcharge, shipping_area: 'normal',
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await supabase.from('auctions').update({ status: 'completed', order_number: orderNumber }).eq('id', params.id);

  await supabase.from('admin_logs').insert({
    admin_email: user.email,
    message: `ปิดประมูล "${auction.name}" ด้วยตนเอง (จ่ายเงินนอกเว็บ) → ออเดอร์ ${orderNumber}${note ? ` — หมายเหตุ: ${note}` : ''}`,
  });

  return NextResponse.json({ orderNumber });
}
